import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import type { Abi, Address, Hex } from "viem";
import { useAccount, useReadContracts, useSwitchChain } from "wagmi";
import { baseSepolia } from "../config/chains";
import testUsdcAbi from "../contracts/abi/TestUSDC.json";
import type { ContractAddresses } from "../contracts/addresses";
import { useSponsoredCalls } from "../hooks/useSponsoredCalls";
import {
  buildDepositCalls,
  buildFaucetCalls,
  buildWithdrawCalls,
  type WithdrawPermit,
} from "../lib/calls";
import { fromBaseUnits } from "../lib/units";
import {
  paymentControllerRequestWithdrawal,
  useAccountControllerGetBalance,
} from "../services/queries";
import { useGameStore } from "../store";
import {
  formatCooldown,
  notifyWalletError,
  parseUsdcInput,
  resolveContractAddresses,
  toSafeBaseUnits,
} from "./walletUtils";

export type WalletTab = "deposit" | "withdraw";
export type PendingAction = "faucet" | "deposit" | "withdraw" | null;

const TUSDC_ABI = testUsdcAbi as Abi;

function useFaucetCountdown(nextClaimAtSec: number) {
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  const cooldownSec = Math.max(0, nextClaimAtSec - nowSec);

  useEffect(() => {
    if (nextClaimAtSec <= Math.floor(Date.now() / 1000)) return;
    const timer = setInterval(() => {
      setNowSec(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [nextClaimAtSec]);

  return { cooldownSec, cooldownLabel: formatCooldown(cooldownSec) };
}

function useOnChainTokenState(
  contracts: ContractAddresses | null,
  address: Address | undefined,
) {
  const { data: reads, refetch } = useReadContracts({
    contracts:
      contracts && address
        ? [
            {
              address: contracts.tUSDC,
              abi: TUSDC_ABI,
              functionName: "balanceOf",
              args: [address],
              chainId: baseSepolia.id,
            },
            {
              address: contracts.tUSDC,
              abi: TUSDC_ABI,
              functionName: "nextClaimAt",
              args: [address],
              chainId: baseSepolia.id,
            },
          ]
        : [],
    query: { enabled: Boolean(contracts && address) },
  });

  const walletBalanceBase =
    reads?.[0]?.status === "success" ? (reads[0].result as bigint) : undefined;
  const nextClaimAtSec =
    reads?.[1]?.status === "success" ? Number(reads[1].result as bigint) : 0;
  return { walletBalanceBase, nextClaimAtSec, refetchReads: refetch };
}

function parsePermitResponse(raw: unknown): WithdrawPermit {
  const data = raw as Partial<WithdrawPermit> | null;
  if (
    !data ||
    typeof data.amountBase !== "string" ||
    typeof data.deadline !== "number" ||
    typeof data.signature !== "string"
  ) {
    throw new Error("Invalid withdrawal permit response");
  }
  return {
    amountBase: data.amountBase,
    deadline: data.deadline,
    signature: data.signature as Hex,
  };
}

export function useWallet() {
  const contracts = resolveContractAddresses();
  const { address, isConnected, chain } = useAccount();
  const { switchChainAsync, isPending: isPendingSwitch } = useSwitchChain();
  const { send, sponsored } = useSponsoredCalls();
  const [activeTab, setActiveTab] = useState<WalletTab>("deposit");
  const [amountStr, setAmountStr] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const storeBalance = useGameStore((s) => s.balance);
  const { data: offChainData, refetch: refetchOffChain } =
    useAccountControllerGetBalance();
  const freeStr = (offChainData as { free?: string } | undefined)?.free;
  const offChainBalance = freeStr !== undefined ? Number(freeStr) : storeBalance;
  const offChainBase = toSafeBaseUnits(freeStr ?? String(storeBalance));

  const { walletBalanceBase, nextClaimAtSec, refetchReads } =
    useOnChainTokenState(contracts, address);
  const { cooldownSec, cooldownLabel } = useFaucetCountdown(nextClaimAtSec);

  const refreshAll = useCallback(() => {
    void refetchReads();
    void refetchOffChain();
  }, [refetchReads, refetchOffChain]);

  const chainMismatch = Boolean(isConnected && chain?.id !== baseSepolia.id);
  const isDepositFlow = activeTab === "deposit";
  const maxBase = isDepositFlow ? (walletBalanceBase ?? 0n) : offChainBase;
  const parsed = parseUsdcInput(amountStr, isConnected ? maxBase : null);

  const handleSwitchChain = useCallback(async () => {
    if (!switchChainAsync) return;
    try {
      await switchChainAsync({ chainId: baseSepolia.id });
    } catch (error) {
      notifyWalletError(error, `Switch to ${baseSepolia.name} failed`);
    }
  }, [switchChainAsync]);

  const runAction = useCallback(
    async (
      action: Exclude<PendingAction, null>,
      fn: () => Promise<void>,
      fallback: string,
    ) => {
      if (chainMismatch) {
        await handleSwitchChain();
        return;
      }
      if (!contracts || !isConnected || pendingAction) return;
      setPendingAction(action);
      try {
        await fn();
      } catch (error) {
        notifyWalletError(error, fallback);
      } finally {
        setPendingAction(null);
      }
    },
    [chainMismatch, contracts, handleSwitchChain, isConnected, pendingAction],
  );

  const handleFaucet = useCallback(
    () =>
      runAction(
        "faucet",
        async () => {
          if (cooldownSec > 0) return;
          await send(buildFaucetCalls());
          toast.success("Claimed 100 tUSDC");
          refreshAll();
        },
        "Faucet claim failed",
      ),
    [cooldownSec, refreshAll, runAction, send],
  );

  const handleDeposit = useCallback(
    () =>
      runAction(
        "deposit",
        async () => {
          if (!parsed.valid) return;
          await send(buildDepositCalls(parsed.base));
          toast.success("Deposit confirmed");
          setAmountStr("");
          refreshAll();
        },
        "Deposit failed",
      ),
    [parsed.base, parsed.valid, refreshAll, runAction, send],
  );

  const handleWithdraw = useCallback(
    () =>
      runAction(
        "withdraw",
        async () => {
          if (!parsed.valid) return;
          if (!localStorage.getItem("token")) {
            toast.error("Sign in with your wallet to withdraw");
            return;
          }
          const permitRaw = await paymentControllerRequestWithdrawal({
            amount: parsed.normalized,
          });
          await send(buildWithdrawCalls(parsePermitResponse(permitRaw)));
          toast.success("Withdrawal confirmed");
          setAmountStr("");
          refreshAll();
        },
        "Withdrawal failed",
      ),
    [parsed.normalized, parsed.valid, refreshAll, runAction, send],
  );

  const handleMax = useCallback(() => {
    if (maxBase > 0n) setAmountStr(fromBaseUnits(maxBase));
  }, [maxBase]);

  const handleToggleDirection = useCallback(() => {
    setActiveTab((cur) => (cur === "deposit" ? "withdraw" : "deposit"));
    setAmountStr("");
  }, []);

  return {
    contracts,
    isConnected,
    chain,
    shortAddress: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected",
    chainMismatch,
    isPendingSwitch,
    sponsored,
    activeTab,
    isDepositFlow,
    amountStr,
    setAmountStr,
    parsed,
    walletBalanceBase,
    offChainBalance,
    cooldownSec,
    cooldownLabel,
    pendingAction,
    refreshAll,
    handleSwitchChain,
    handleFaucet,
    handleDeposit,
    handleWithdraw,
    handleMax,
    handleToggleDirection,
  };
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useBalance, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { type Abi, formatUnits, parseUnits } from "viem";
import { toast } from "react-hot-toast";
import { baseSepolia } from "../config/chains";
import tap2StacksVaultAbi from "../contracts/abi/Tap2StacksVault.json";
import { TOKEN_DECIMALS, TOKEN_SYMBOL, showTransactionSubmittedToast } from "../utils/chain";
import {
  paymentControllerDebugDeposit, paymentControllerDebugFinalizeWithdrawal,
  paymentControllerGetActiveWithdrawalSession, paymentControllerRequestWithdrawal,
  useAccountControllerGetBalance,
} from "../services/queries";
import { formatAmount, formatCompactNumber, resolveContractAddresses, safeParseUnits } from "./walletUtils";

const IN_APP_PER_TOKEN = 10;
const NATIVE_SYMBOL = TOKEN_SYMBOL;
const NATIVE_DECIMALS = TOKEN_DECIMALS;
const VAULT_ABI = tap2StacksVaultAbi as Abi;
type TabKey = "deposit" | "withdraw";

export function useWallet() {
  const contracts = resolveContractAddresses();
  const { address, isConnected, chain } = useAccount();
  const { switchChainAsync, isPending: isPendingSwitch } = useSwitchChain();
  const [activeTab, setActiveTab] = useState<TabKey>("deposit");
  const [depositAmountStr, setDepositAmountStr] = useState("");
  const [withdrawInAppStr, setWithdrawInAppStr] = useState("");
  const pendingDepositAmountRef = useRef<string | null>(null);
  const handledDepositTxHashRef = useRef<string | null>(null);

  const { data: nativeBalance, refetch: refetchNativeBalance } = useBalance({
    address,
    chainId: baseSepolia.id,
    query: { enabled: !!address },
  });

  const { data: offChainBalanceData, refetch: refetchOffChainBalance } =
    useAccountControllerGetBalance();
  const offChainBalance = Number(
    (offChainBalanceData as { free?: string } | undefined)?.free ?? 0,
  );

  const {
    writeContract: writeDepositTrader,
    data: depositTxHash,
    isPending: isDepositingOnChain,
  } = useWriteContract();

  const {
    writeContract: writeClaimTrader,
    data: claimTxHash,
    isPending: isClaimingTrader,
  } = useWriteContract();
  const { isLoading: isWaitingClaim, isSuccess: isClaimSuccess } =
    useWaitForTransactionReceipt({ hash: claimTxHash });

  const [isSubmittingApi, setIsSubmittingApi] = useState(false);

  const depositTokenAmountRaw = safeParseUnits(
    depositAmountStr,
    NATIVE_DECIMALS,
  );
  const rawDepositAmount = depositAmountStr
    ? Number.parseFloat(depositAmountStr)
    : 0;
  const isValidDepositAmount =
    Number.isFinite(rawDepositAmount) &&
    rawDepositAmount > 0 &&
    depositTokenAmountRaw > 0n;

  const depositInAppEquivalent = depositAmountStr
    ? formatCompactNumber(rawDepositAmount * IN_APP_PER_TOKEN, 0)
    : "0";

  const rawWithdrawInApp = withdrawInAppStr
    ? Number.parseFloat(withdrawInAppStr)
    : 0;
  const isValidWithdrawAmount =
    Number.isFinite(rawWithdrawInApp) && rawWithdrawInApp > 0;
  const withdrawTokenFloat = rawWithdrawInApp / IN_APP_PER_TOKEN;
  const withdrawTokenStr = withdrawTokenFloat.toFixed(18);
  const withdrawTokenAmountRaw = isValidWithdrawAmount
    ? parseUnits(withdrawTokenStr, NATIVE_DECIMALS)
    : 0n;
  const withdrawTokenEquivalent = isValidWithdrawAmount
    ? withdrawTokenFloat.toFixed(6)
    : "0";

  const refreshAll = useCallback(() => {
    refetchNativeBalance();
    refetchOffChainBalance();
  }, [refetchNativeBalance, refetchOffChainBalance]);

  const ensureBaseSepolia = useCallback(async () => {
    if (!isConnected) {
      toast.error("Connect wallet to continue.");
      return false;
    }

    if (chain?.id === baseSepolia.id) {
      return true;
    }

    if (!switchChainAsync) {
      toast.error(`Switch to ${baseSepolia.name} to continue.`);
      return false;
    }

    try {
      await switchChainAsync({ chainId: baseSepolia.id });
      return true;
    } catch (error) {
      console.error("Network switch failed", error);
      toast.error(`Please switch to ${baseSepolia.name} before continuing.`);
      return false;
    }
  }, [chain?.id, isConnected, switchChainAsync]);

  useEffect(() => {
    if (!depositTxHash) return;

    showTransactionSubmittedToast({
      hash: depositTxHash,
      title: "Deposit transaction submitted",
      description: "Your wallet has broadcast the deposit transaction.",
    });
  }, [depositTxHash]);

  useEffect(() => {
    if (!claimTxHash) return;

    showTransactionSubmittedToast({
      hash: claimTxHash,
      title: "Withdrawal claim transaction submitted",
      description:
        "Your wallet has broadcast the withdrawal claim transaction.",
    });
  }, [claimTxHash]);

  useEffect(() => {
    const handleDepositApi = async () => {
      if (!depositTxHash || handledDepositTxHashRef.current === depositTxHash) {
        return;
      }

      const submittedAmountStr = pendingDepositAmountRef.current;
      const tokenAmountFloat = submittedAmountStr
        ? Number.parseFloat(submittedAmountStr)
        : NaN;

      if (!Number.isFinite(tokenAmountFloat) || tokenAmountFloat <= 0) {
        pendingDepositAmountRef.current = null;
        handledDepositTxHashRef.current = depositTxHash;
        return;
      }

      handledDepositTxHashRef.current = depositTxHash;

      try {
        setIsSubmittingApi(true);

        const apiAmount = Math.floor(
          tokenAmountFloat * IN_APP_PER_TOKEN,
        ).toString();

        const token = localStorage.getItem("token");

        await paymentControllerDebugDeposit(
          {
            amount: apiAmount,
            txHash: depositTxHash,
            logIndex: 0,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        refreshAll();
        setDepositAmountStr("");
        pendingDepositAmountRef.current = null;
      } catch (error) {
        console.error("API error", error);
        toast.error("Transaction sent but API call failed.");
      } finally {
        setIsSubmittingApi(false);
      }
    };

    handleDepositApi();
  }, [depositTxHash, refreshAll]);

  useEffect(() => {
    if (!isClaimSuccess || !claimTxHash) return;

    const handleFinalizeWithdrawal = async () => {
      try {
        setIsSubmittingApi(true);

        const token = localStorage.getItem("token");
        const authHeader = { Authorization: `Bearer ${token}` };

        const sessionResponse =
          await paymentControllerGetActiveWithdrawalSession({
            headers: authHeader,
          });

        const sessionData = sessionResponse as unknown as
          | { sessionId: string }
          | null
          | undefined;

        if (!sessionData?.sessionId) {
          toast.error("Could not retrieve withdrawal session ID.");
          return;
        }

        await paymentControllerDebugFinalizeWithdrawal(
          {
            sessionId: sessionData.sessionId,
            txHash: claimTxHash,
            logIndex: 0,
          },
          {
            headers: {
              ...authHeader,
              "Content-Type": "application/json",
            },
          },
        );

        toast.success("Withdrawal finalized successfully!");
        refreshAll();
        setWithdrawInAppStr("");
      } catch (error) {
        console.error("Finalize withdrawal error", error);
        toast.error("On-chain claim sent but finalization failed.");
      } finally {
        setIsSubmittingApi(false);
      }
    };

    handleFinalizeWithdrawal();
  }, [claimTxHash, isClaimSuccess, refreshAll]);

  const handleDeposit = async () => {
    if (!contracts) {
      toast.error("Contracts not deployed yet");
      return;
    }

    const onBaseSepolia = await ensureBaseSepolia();
    if (!onBaseSepolia) return;

    if (!depositAmountStr || !isValidDepositAmount) {
      toast.error("Enter a valid amount");
      return;
    }

    if ((nativeBalance?.value ?? 0n) < depositTokenAmountRaw) {
      toast.error("Insufficient balance");
      return;
    }

    pendingDepositAmountRef.current = depositAmountStr;

    writeDepositTrader({
      address: contracts.vault,
      abi: VAULT_ABI,
      functionName: "depositTrader",
      value: depositTokenAmountRaw,
    });
  };

  const handleWithdraw = async () => {
    if (!contracts) {
      toast.error("Contracts not deployed yet");
      return;
    }

    const onBaseSepolia = await ensureBaseSepolia();
    if (!onBaseSepolia) return;

    if (!withdrawInAppStr || !isValidWithdrawAmount) {
      toast.error("Enter a valid in-app balance amount");
      return;
    }

    const token = localStorage.getItem("token");
    const authHeader = { Authorization: `Bearer ${token}` };

    try {
      setIsSubmittingApi(true);

      await paymentControllerRequestWithdrawal(
        { amount: withdrawInAppStr },
        { headers: { ...authHeader, "Content-Type": "application/json" } },
      );

      toast.success("Withdrawal request submitted. Processing on-chain...");
    } catch (error) {
      console.error("Request withdrawal error", error);
      toast.error("Failed to initiate withdrawal request.");
      setIsSubmittingApi(false);
      return;
    } finally {
      setIsSubmittingApi(false);
    }

    writeClaimTrader({
      address: contracts.vault,
      abi: VAULT_ABI,
      functionName: "claimTrader",
      args: [withdrawTokenAmountRaw],
    });
  };

  const handleMaxDeposit = () => {
    if (!nativeBalance?.value) return;

    setDepositAmountStr(formatUnits(nativeBalance.value, NATIVE_DECIMALS));
  };

  const handleMaxWithdraw = () => {
    if (offChainBalance <= 0) return;

    setWithdrawInAppStr(offChainBalance.toString());
  };

  const chainMismatch = isConnected && chain?.id !== baseSepolia.id;
  const isInsufficientDeposit =
    depositTokenAmountRaw > (nativeBalance?.value ?? 0n);
  const isInsufficientWithdraw = rawWithdrawInApp > offChainBalance;

  const depositPending = isDepositingOnChain || isSubmittingApi;
  const withdrawPending = isSubmittingApi || isClaimingTrader || isWaitingClaim;
  const isDepositFlow = activeTab === "deposit";
  const fromAmount = isDepositFlow ? depositAmountStr : withdrawInAppStr;
  const toAmount = isDepositFlow
    ? depositInAppEquivalent
    : withdrawTokenEquivalent;
  const fromAsset = isDepositFlow ? NATIVE_SYMBOL : "APP";
  const toAsset = isDepositFlow ? "APP" : NATIVE_SYMBOL;
  const fromAssetBalance = isDepositFlow
    ? `${formatAmount(nativeBalance?.value, NATIVE_DECIMALS)} ${NATIVE_SYMBOL}`
    : `${formatCompactNumber(offChainBalance, 0)} APP`;
  const toAssetBalance = isDepositFlow
    ? `${formatCompactNumber(offChainBalance, 0)} APP`
    : `${formatAmount(nativeBalance?.value, NATIVE_DECIMALS)} ${NATIVE_SYMBOL}`;

  const activeRailLabel = useMemo(
    () =>
      activeTab === "deposit" ? "Chain → App balance" : "App balance → Chain",
    [activeTab],
  );

  const handleToggleDirection = () => {
    setActiveTab((current) => (current === "deposit" ? "withdraw" : "deposit"));
    setDepositAmountStr("");
    setWithdrawInAppStr("");
  };

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "Not connected";

  return {
    contracts, address, isConnected, chain,
    switchChainAsync, isPendingSwitch, activeTab, setDepositAmountStr,
    setWithdrawInAppStr, nativeBalance, offChainBalance, isValidDepositAmount,
    isValidWithdrawAmount, refreshAll, handleDeposit, handleWithdraw,
    handleMaxDeposit, handleMaxWithdraw, chainMismatch, isInsufficientDeposit,
    isInsufficientWithdraw, depositPending, withdrawPending, isDepositFlow,
    fromAmount, toAmount, fromAsset, toAsset,
    fromAssetBalance, toAssetBalance, activeRailLabel, handleToggleDirection,
    shortAddress,
  };
}

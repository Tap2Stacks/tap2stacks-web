import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  useAccount,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";
import { requestReconfirmation, useComplianceStore } from "../compliance/store";
import { baseSepolia } from "../config/chains";
import { isTopUpEnabled } from "../config/dev";
import { BACKEND_URL } from "../constant";
import { setAuthToken, useAuthToken } from "../realtime/authToken";
import {
  authControllerGetChallenge,
  authControllerLogin,
  getAccountControllerGetBalanceQueryKey,
  useAccountControllerGetBalance,
} from "../services/queries";
import { useGameStore } from "../store";
import { useBalanceDisplay } from "./useBalanceDisplay";

function clearDemoKeys() {
  localStorage.removeItem("is-demo-mode");
  localStorage.removeItem("demo-wallet-address");
  localStorage.removeItem("demo-private-key");
}

async function submitLogin(address: string, signature: string) {
  const login = () =>
    authControllerLogin({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, signature, age18: true, notUS: true }),
    });
  try {
    return await login();
  } catch (error) {
    const response = (
      error as { response?: { status?: number; data?: { error?: string } } }
    )?.response;
    if (response?.status === 451) {
      useComplianceStore.getState().block();
      throw error;
    }
    if (
      response?.status !== 403 ||
      response.data?.error !== "ATTESTATION_REQUIRED"
    ) {
      throw error;
    }
    await requestReconfirmation();
    return login();
  }
}

async function postDevTopUp(authToken: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/payment/debug/deposit`, {
    method: "POST",
    headers: {
      accept: "*/*",
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: 100 }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

export function useWalletSession() {
  const balance = useGameStore((s) => s.balance);
  const displayedBalance = useBalanceDisplay(balance);
  const updateBalance = useGameStore((s) => s.updateBalance);
  const { address, isConnected, chain } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChain, isPending: isPendingSwitch } = useSwitchChain();
  const token = useAuthToken();
  const attested = useComplianceStore((s) => s.attested);
  const [isFunding, setIsFunding] = useState(false);
  const promptedAddress = useRef<string | null>(null);
  const isLoggingIn = useRef(false);

  const { data: balanceData, refetch: refetchBalance } =
    useAccountControllerGetBalance({
      query: {
        enabled: Boolean(token),
        queryKey: getAccountControllerGetBalanceQueryKey(),
      },
    });

  useEffect(() => {
    clearDemoKeys();
  }, []);

  useEffect(() => {
    const free = (balanceData as unknown as { free?: string } | undefined)?.free;
    if (free !== undefined) updateBalance(Number(free));
  }, [balanceData, updateBalance]);

  const handleLogin = useCallback(async () => {
    if (!isConnected || !address || !attested || isLoggingIn.current) return;
    if (
      localStorage.getItem("token") &&
      localStorage.getItem("wallet-address") === address
    ) {
      return;
    }
    if (promptedAddress.current === address) return;

    isLoggingIn.current = true;
    promptedAddress.current = address;
    try {
      const challengeRes = await authControllerGetChallenge({ address });
      const challenge = (challengeRes as unknown as { challenge: string })
        .challenge;
      const signature = await signMessageAsync({ message: challenge });
      const res = await submitLogin(address, signature);
      const accessToken = (res as unknown as { accessToken: string })
        .accessToken;
      localStorage.setItem("wallet-address", address);
      setAuthToken(accessToken);
      void refetchBalance();
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 451) {
        useComplianceStore.getState().block();
      } else {
        console.error("Login failed:", error);
        toast.error("Sign in failed");
      }
    } finally {
      isLoggingIn.current = false;
    }
  }, [address, attested, isConnected, refetchBalance, signMessageAsync]);

  useEffect(() => {
    void handleLogin();
  }, [handleLogin]);

  const handleDevTopUp = useCallback(async () => {
    if (!isTopUpEnabled()) return;
    const authToken = localStorage.getItem("token") ?? token;
    if (!authToken || isFunding) return;
    setIsFunding(true);
    try {
      await postDevTopUp(authToken);
      toast.success("Added 100 test credits");
      void refetchBalance();
    } catch (error) {
      console.error("Deposit failed:", error);
      toast.error("Failed to add test credits");
    } finally {
      setIsFunding(false);
    }
  }, [isFunding, refetchBalance, token]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    localStorage.removeItem("wallet-address");
    clearDemoKeys();
    setAuthToken(null);
    promptedAddress.current = null;
  }, [disconnect]);

  const promptLogin = useCallback(() => {
    promptedAddress.current = null;
    void handleLogin();
  }, [handleLogin]);

  return {
    address,
    isConnected,
    chain,
    token,
    displayedBalance,
    isFunding,
    switchToBaseSepolia: () => switchChain?.({ chainId: baseSepolia.id }),
    isPendingSwitch,
    promptLogin,
    handleDisconnect,
    handleDevTopUp,
  };
}

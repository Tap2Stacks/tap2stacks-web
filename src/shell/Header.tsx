import { requestReconfirmation, useComplianceStore } from "../compliance/store";
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import { Link, useLocation } from "react-router-dom";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";
import { baseSepolia } from "../config/chains";
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
import { THEME } from "../ui/theme";
import { getExplorerAddressUrl } from "../utils/chain";

const NAV_ITEMS = [
  { label: "Trade", path: "/trade" },
  { label: "History", path: "/history" },
  { label: "Wallet", path: "/wallet" },
  { label: "Proofs", path: "/proofs" },
] as const;

function HeaderButton({
  label,
  onClick,
  variant = "secondary",
  badge,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  variant?: "secondary" | "primary";
  badge?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
      style={{
        backgroundColor: variant === "primary" ? THEME.highlight : THEME.paper,
        color: THEME.ink,
        border: `1.5px solid ${THEME.ink}`,
        boxShadow: variant === "primary" ? `0 2px 0 ${THEME.ink}` : "none",
      }}
    >
      {label}
      {badge ? (
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{ backgroundColor: THEME.ink, color: THEME.paper }}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export interface HeaderProps {
  bellSlot?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ bellSlot }) => {
  const balance = useGameStore((state) => state.balance);
  const displayedBalance = useBalanceDisplay(balance);
  const updateBalance = useGameStore((state) => state.updateBalance);

  const location = useLocation();
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChain, isPending: isPendingSwitch } = useSwitchChain();

  const token = useAuthToken();
  const attested = useComplianceStore((state) => state.attested);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [isFunding, setIsFunding] = useState(false);

  const promptedAddress = useRef<string | null>(null);
  const isLoggingIn = useRef(false);

  const { data: balanceData, refetch: refetchBalance } =
    useAccountControllerGetBalance({
      query: {
        enabled: !!token,
        queryKey: getAccountControllerGetBalanceQueryKey(),
      },
    });

  useEffect(() => {
    localStorage.removeItem("is-demo-mode");
    localStorage.removeItem("demo-wallet-address");
    localStorage.removeItem("demo-private-key");
  }, []);

  useEffect(() => {
    if (
      balanceData &&
      typeof (balanceData as unknown as { free?: string }).free !== "undefined"
    ) {
      updateBalance(Number((balanceData as unknown as { free?: string }).free));
    }
  }, [balanceData, updateBalance]);

  const handleDevTopUp = async () => {
    const authToken = localStorage.getItem("token") ?? token;
    if (!authToken || isFunding) return;

    setIsFunding(true);
    try {
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
      toast.success("Added 100 test credits");
      refetchBalance();
    } catch (error) {
      console.error("Deposit failed:", error);
      toast.error("Failed to add test credits");
    } finally {
      setIsFunding(false);
    }
  };

  const handleLogin = async () => {
    if (!isConnected || !address || !attested || isLoggingIn.current) return;

    const storedToken = localStorage.getItem("token");
    const storedAddress = localStorage.getItem("wallet-address");

    if (storedToken && storedAddress === address) return;
    if (promptedAddress.current === address) return;

    isLoggingIn.current = true;
    promptedAddress.current = address;

    try {
      const challengeRes = await authControllerGetChallenge({ address });
      const challenge = (challengeRes as unknown as { challenge: string })
        .challenge;

      const signature = await signMessageAsync({ message: challenge });

      const login = () => authControllerLogin({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, age18: true, notUS: true }),
      });
      let loginRes;
      try {
        loginRes = await login();
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
        loginRes = await login();
      }

      const accessToken = (loginRes as unknown as { accessToken: string })
        .accessToken;

      localStorage.setItem("wallet-address", address);
      setAuthToken(accessToken);
      refetchBalance();
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 451) {
        useComplianceStore.getState().block();
      }
      console.error("Login failed:", error);
    } finally {
      isLoggingIn.current = false;
    }
  };

  useEffect(() => {
    handleLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address, attested]);

  const handleDisconnect = () => {
    disconnect();

    localStorage.removeItem("wallet-address");
    localStorage.removeItem("is-demo-mode");
    localStorage.removeItem("demo-wallet-address");
    localStorage.removeItem("demo-private-key");
    setAuthToken(null);
    promptedAddress.current = null;
    setWalletMenuOpen(false);
  };

  return (
    <header
      className="sticky top-0 z-40 shrink-0 border-b px-5 py-2.5"
      style={{
        backgroundColor: THEME.paper,
        color: THEME.ink,
        borderColor: "rgba(29, 27, 24, 0.15)",
        fontFamily: THEME.font,
      }}
    >
      <div className="flex items-center gap-4">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="text-lg font-extrabold tracking-tight">
            tap2stacks
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="flex items-center gap-1 rounded-lg p-0.5"
          style={{ border: `1.5px solid ${THEME.ink}` }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="rounded-md px-3 py-1 text-xs font-bold transition"
                style={{
                  backgroundColor: isActive ? THEME.ink : "transparent",
                  color: isActive ? THEME.paper : THEME.ink,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          {bellSlot ? <div className="shrink-0">{bellSlot}</div> : null}

          <div
            data-testid="balance-pill"
            className="rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums"
            style={{
              backgroundColor: THEME.ink,
              color: THEME.paper,
              border: `1.5px solid ${THEME.ink}`,
            }}
          >
            ${displayedBalance.toFixed(2)}
          </div>

          {!isConnected ? (
            <HeaderButton
              label="Connect wallet"
              onClick={() => connect({ connector: connectors[0] })}
              variant="primary"
            />
          ) : chain?.id !== baseSepolia.id ? (
            <HeaderButton
              label={isPendingSwitch ? "Switching" : "Switch network"}
              onClick={() => switchChain?.({ chainId: baseSepolia.id })}
              variant="primary"
            />
          ) : !token ? (
            <HeaderButton
              label="Sign in"
              onClick={() => {
                promptedAddress.current = null;
                handleLogin();
              }}
              badge="wallet"
            />
          ) : (
            <>
              <HeaderButton
                label={isFunding ? "Funding..." : "Get 100 test credits (dev)"}
                onClick={() => void handleDevTopUp()}
                disabled={isFunding}
              />
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setWalletMenuOpen((value) => !value)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition cursor-pointer"
                  style={{
                    backgroundColor: THEME.paper,
                    color: THEME.ink,
                    border: `1.5px solid ${THEME.ink}`,
                  }}
                >
                  <span>
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  <ChevronDown size={14} />
                </button>

                {walletMenuOpen && (
                  <div
                    className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 overflow-hidden rounded-xl"
                    style={{
                      backgroundColor: THEME.paper,
                      color: THEME.ink,
                      border: `1.5px solid ${THEME.ink}`,
                      boxShadow: `3px 3px 0 ${THEME.ink}`,
                    }}
                  >
                    <div
                      className="border-b px-3.5 py-2.5"
                      style={{ borderColor: "rgba(29, 27, 24, 0.15)" }}
                    >
                      <p className="text-[11px] opacity-60">Connected wallet</p>
                      <p className="mt-1 break-all text-xs font-bold">
                        {address?.slice(0, 6)}...{address?.slice(-4)}
                      </p>
                    </div>
                    <div
                      className="flex items-center gap-2 border-b px-3.5 py-2.5"
                      style={{ borderColor: "rgba(29, 27, 24, 0.15)" }}
                    >
                      <button
                        type="button"
                        className="rounded-md px-2.5 py-1 text-xs font-bold cursor-pointer"
                        style={{ border: `1.5px solid ${THEME.ink}` }}
                        onClick={() => {
                          if (address) {
                            navigator.clipboard.writeText(address);
                            toast.success("Address copied!");
                          }
                        }}
                      >
                        Copy
                      </button>
                      <a
                        href={getExplorerAddressUrl(address ?? "")}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md px-2.5 py-1 text-xs font-bold"
                        style={{ border: `1.5px solid ${THEME.ink}` }}
                      >
                        Explorer
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="w-full px-3.5 py-2.5 text-left text-xs font-bold cursor-pointer"
                      style={{ color: THEME.loss }}
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

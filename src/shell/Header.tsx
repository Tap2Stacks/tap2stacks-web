import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import { Link, useLocation } from "react-router-dom";
import { baseSepolia } from "../config/chains";
import { isDevMode } from "../config/dev";
import { THEME } from "../ui/theme";
import { getExplorerAddressUrl } from "../utils/chain";
import { useWalletSession } from "./useWalletSession";

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
  const location = useLocation();
  const session = useWalletSession();
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);

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
            ${session.displayedBalance.toFixed(2)}
          </div>

          {!session.isConnected ? (
            <HeaderButton
              label="Connect wallet"
              onClick={session.connectWallet}
              variant="primary"
            />
          ) : session.chain?.id !== baseSepolia.id ? (
            <HeaderButton
              label={session.isPendingSwitch ? "Switching" : "Switch network"}
              onClick={session.switchToBaseSepolia}
              variant="primary"
            />
          ) : !session.token ? (
            <HeaderButton
              label="Sign in"
              onClick={session.promptLogin}
              badge="wallet"
            />
          ) : (
            <>
              {import.meta.env.DEV && isDevMode() ? (
                <HeaderButton
                  label={
                    session.isFunding
                      ? "Funding..."
                      : "Get 100 test credits (dev)"
                  }
                  onClick={() => void session.handleDevTopUp()}
                  disabled={session.isFunding}
                />
              ) : null}
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
                    {session.address?.slice(0, 6)}...{session.address?.slice(-4)}
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
                        {session.address?.slice(0, 6)}...
                        {session.address?.slice(-4)}
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
                          if (session.address) {
                            void navigator.clipboard.writeText(session.address);
                            toast.success("Address copied!");
                          }
                        }}
                      >
                        Copy
                      </button>
                      <a
                        href={getExplorerAddressUrl(session.address ?? "")}
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
                      onClick={() => {
                        session.handleDisconnect();
                        setWalletMenuOpen(false);
                      }}
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

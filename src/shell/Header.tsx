import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AssetLogo } from "../components/AssetLogo";
import { baseSepolia } from "../config/chains";
import { isDevMode, isTopUpEnabled } from "../config/dev";
import { THEME } from "../ui/theme";
import { WalletDialog } from "../wallet/WalletDialog";
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
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums"
            style={{
              backgroundColor: THEME.ink,
              color: THEME.paper,
              border: `1.5px solid ${THEME.ink}`,
            }}
          >
            <AssetLogo symbol="USDC" size={14} />
            <span>${session.displayedBalance.toFixed(2)}</span>
          </div>

          {session.isConnected && session.chain?.id !== baseSepolia.id ? (
            <HeaderButton label={session.isPendingSwitch ? "Switching" : "Switch network"} onClick={session.switchToBaseSepolia} variant="primary" />
          ) : session.isConnected && !session.token ? (
            <HeaderButton label="Sign in" onClick={session.promptLogin} badge="wallet" />
          ) : null}
          {session.isConnected && session.token && isTopUpEnabled() ? (
            <HeaderButton label={session.isFunding ? "Funding..." : isDevMode() ? "Get 100 test credits (dev)" : "Get 100 test credits (play)"} onClick={() => void session.handleDevTopUp()} disabled={session.isFunding} />
          ) : null}
          <HeaderButton label={session.isConnected ? `${session.address?.slice(0, 6)}...${session.address?.slice(-4)}` : "Connect wallet"} onClick={() => setWalletMenuOpen(true)} variant={session.isConnected ? "secondary" : "primary"} />
          <WalletDialog open={walletMenuOpen} onClose={() => setWalletMenuOpen(false)} address={session.address} network={session.chain?.name} onDisconnect={session.handleDisconnect} />
        </div>
      </div>
    </header>
  );
};

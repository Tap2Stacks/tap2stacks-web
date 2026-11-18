import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { baseSepolia } from "../config/chains";
import { BellPill } from "../pages/BellPill";
import { THEME } from "../ui/theme";
import { getExplorerAddressUrl } from "../utils/chain";
import { useWalletSession } from "./useWalletSession";

function AccountMenu({
  address,
  isFunding,
  onDevTopUp,
  onDisconnect,
}: {
  address?: string;
  isFunding: boolean;
  onDevTopUp: () => void;
  onDisconnect: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 text-[11px] font-bold"
        style={{ backgroundColor: THEME.paper, color: THEME.ink, border: `1.5px solid ${THEME.ink}` }}
      >
        <span>{address?.slice(0, 4)}..{address?.slice(-2)}</span>
        <ChevronDown size={12} />
      </button>
      {menuOpen ? (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-48 overflow-hidden rounded-xl"
          style={{ backgroundColor: THEME.paper, color: THEME.ink, border: `1.5px solid ${THEME.ink}`, boxShadow: `3px 3px 0 ${THEME.ink}` }}
        >
          <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: "rgba(29, 27, 24, 0.15)" }}>
            <button
              type="button"
              className="rounded border px-2 py-1 text-[11px] font-bold"
              style={{ borderColor: THEME.ink }}
              onClick={() => {
                if (address) {
                  void navigator.clipboard.writeText(address);
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
              className="rounded border px-2 py-1 text-[11px] font-bold"
              style={{ borderColor: THEME.ink }}
            >
              Explorer
            </a>
          </div>
          {import.meta.env.DEV ? (
            <button
              type="button"
              disabled={isFunding}
              onClick={() => {
                onDevTopUp();
                setMenuOpen(false);
              }}
              className="w-full border-b px-3 py-2 text-left text-xs font-bold disabled:opacity-50"
              style={{ borderColor: "rgba(29, 27, 24, 0.15)", color: THEME.ink }}
            >
              {isFunding ? "Funding..." : "Add 100 test credits"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              onDisconnect();
              setMenuOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-xs font-bold"
            style={{ color: THEME.loss }}
          >
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AccountControl(s: ReturnType<typeof useWalletSession>) {
  if (!s.isConnected) {
    return (
      <button
        type="button"
        onClick={s.connectWallet}
        className="h-7 shrink-0 cursor-pointer rounded-lg px-2.5 text-[11px] font-bold"
        style={{
          backgroundColor: THEME.highlight,
          color: THEME.ink,
          border: `1.5px solid ${THEME.ink}`,
          boxShadow: `0 2px 0 ${THEME.ink}`,
        }}
      >
        Connect
      </button>
    );
  }
  if (s.chain?.id !== baseSepolia.id) {
    return (
      <button
        type="button"
        onClick={s.switchToBaseSepolia}
        disabled={s.isPendingSwitch}
        className="h-7 shrink-0 cursor-pointer rounded-lg px-2.5 text-[11px] font-bold"
        style={{ backgroundColor: THEME.highlight, color: THEME.ink, border: `1.5px solid ${THEME.ink}` }}
      >
        {s.isPendingSwitch ? "Switching" : "Switch"}
      </button>
    );
  }
  if (!s.token) {
    return (
      <button
        type="button"
        onClick={s.promptLogin}
        className="h-7 shrink-0 cursor-pointer rounded-lg px-2.5 text-[11px] font-bold"
        style={{ backgroundColor: THEME.paper, color: THEME.ink, border: `1.5px solid ${THEME.ink}` }}
      >
        Sign in
      </button>
    );
  }
  return (
    <AccountMenu
      address={s.address}
      isFunding={s.isFunding}
      onDevTopUp={() => void s.handleDevTopUp()}
      onDisconnect={s.handleDisconnect}
    />
  );
}

export const PhoneHeader: React.FC<{ bellSlot?: React.ReactNode }> = ({ bellSlot }) => {
  const session = useWalletSession();
  return (
    <header
      className="shrink-0 border-b px-2.5 py-2"
      style={{
        backgroundColor: THEME.paper,
        color: THEME.ink,
        borderColor: "rgba(29, 27, 24, 0.15)",
        fontFamily: THEME.font,
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <Link to="/trade" className="shrink-0 text-sm font-extrabold tracking-tight">
          tap2stacks
        </Link>
        <div className="flex min-w-0 items-center gap-1">
          <div className="shrink-0">{bellSlot ?? <BellPill compact />}</div>
          <div
            data-testid="balance-pill"
            className="shrink-0 rounded-lg px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
            style={{ backgroundColor: THEME.ink, color: THEME.paper }}
          >
            ${session.displayedBalance.toFixed(2)}
          </div>
          <AccountControl {...session} />
        </div>
      </div>
    </header>
  );
};

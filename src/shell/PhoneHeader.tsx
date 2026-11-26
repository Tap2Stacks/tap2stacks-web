import React, { useState } from "react";
import { Link } from "react-router-dom";
import { baseSepolia } from "../config/chains";
import { isTopUpEnabled } from "../config/dev";
import { BellPill } from "../pages/BellPill";
import { THEME } from "../ui/theme";
import { WalletDialog } from "../wallet/WalletDialog";
import { useWalletSession } from "./useWalletSession";

function AccountControl(s: ReturnType<typeof useWalletSession>) {
  const [open, setOpen] = useState(false);
  return <>
    {s.isConnected && s.chain?.id !== baseSepolia.id ? (
      <button type="button" onClick={s.switchToBaseSepolia} disabled={s.isPendingSwitch} className="h-7 rounded-lg px-2 text-[11px] font-bold" style={{ background: THEME.highlight, border: `1.5px solid ${THEME.ink}` }}>{s.isPendingSwitch ? "Switching" : "Switch"}</button>
    ) : s.isConnected && !s.token ? (
      <button type="button" onClick={s.promptLogin} className="h-7 rounded-lg px-2 text-[11px] font-bold" style={{ border: `1.5px solid ${THEME.ink}` }}>Sign in</button>
    ) : null}
    <button type="button" onClick={() => setOpen(true)} className="h-7 shrink-0 rounded-lg px-2 text-[11px] font-bold" style={{ background: s.isConnected ? THEME.paper : THEME.highlight, border: `1.5px solid ${THEME.ink}` }}>
      {s.isConnected ? `${s.address?.slice(0, 4)}..${s.address?.slice(-2)}` : "Connect"}
    </button>
    <WalletDialog open={open} onClose={() => setOpen(false)} address={s.address} network={s.chain?.name ?? (s.chainId === 8453 ? "Base" : s.chainId ? `Chain ${s.chainId}` : undefined)} chainId={s.chainId ?? s.chain?.id} onDisconnect={s.handleDisconnect} onTopUp={s.token && isTopUpEnabled() ? () => void s.handleDevTopUp() : undefined} isFunding={s.isFunding} />
  </>;
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
        <Link to="/trade" className="flex shrink-0 items-center gap-1.5 text-sm font-extrabold tracking-tight">
          <img src="/brand/logo-mark.svg" alt="" width={22} height={22} className="shrink-0" style={{ width: 22, height: 22 }} />
          <span>tap2stacks</span>
        </Link>
        <div className="flex min-w-0 items-center gap-1">
          <div className="shrink-0">{bellSlot ?? <BellPill compact />}</div>
          <AccountControl {...session} />
        </div>
      </div>
    </header>
  );
};

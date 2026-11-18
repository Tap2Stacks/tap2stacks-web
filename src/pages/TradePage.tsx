import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAccount } from "wagmi";
import { BoardCanvas } from "../board/BoardCanvas";
import { placeTap } from "../board/placeTap";
import { FX_SHAKE_CLASS } from "../fx/FxCanvas";
import { useFxStore } from "../fx/fxStore";
import { useBigWinShake } from "../shell/useBigWinShake";
import { useIsPhone } from "../shell/useIsPhone";
import { useGameStore, type CellData } from "../store";
import { PhoneTradePage } from "./PhoneTradePage";
import { SidePanel } from "./SidePanel";

const TAP_MESSAGES = {
  NOT_SIGNED_IN: "Connect your wallet and sign in to tap.",
  INSUFFICIENT_BALANCE: "Not enough balance. Deposit or use the faucet.",
  FEED_PAUSED: "Price feed paused. Taps are off for now.",
  WINDOW_CLOSING: "Too close to start. Tap a later column.",
  CELL_LIMIT: "This cell is full ($100 max per cell).",
} as const;

export function TradePage() {
  const { address } = useAccount();
  const flash = useFxStore((s) => s.flash);
  const bigShake = useBigWinShake();
  const isPhone = useIsPhone();
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!shake) return;
    const timer = setTimeout(() => setShake(false), 450);
    return () => clearTimeout(timer);
  }, [shake]);

  const tap = (cell: CellData) => {
    const s = useGameStore.getState();
    const result = placeTap({
      cell,
      amount: s.betAmount,
      balance: s.balance,
      feedStale: s.feedStale[s.ticker],
      nowMs: Date.now() + s.serverTimeOffset,
      socket: s.socket,
      wssKey: s.wssKey,
      address: address ?? null,
    });
    if (result.ok) return;
    if (result.reason === "INSUFFICIENT_BALANCE") setShake(true);
    toast.error(TAP_MESSAGES[result.reason]);
  };

  if (isPhone) {
    return (
      <PhoneTradePage
        onTapCell={tap}
        flash={flash ?? undefined}
        bigShake={bigShake}
        shake={shake}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <section
        className={`relative min-w-0 flex-1 ${bigShake ? FX_SHAKE_CLASS : ""}`}
        aria-label="Trading board"
      >
        <BoardCanvas onTapCell={tap} flash={flash ?? undefined} />
        <p className="pointer-events-none absolute bottom-4 left-5 text-[10px] opacity-60">
          If the price line passes through your cell during its 5 seconds, you win.
        </p>
      </section>
      <SidePanel shake={shake} />
    </div>
  );
}

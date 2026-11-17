import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import { BoardCanvas } from "../board/BoardCanvas";
import { placeTap } from "../board/placeTap";
import { useGameStore, type CellData } from "../store";
import { useFxStore } from "../fx/fxStore";
import { FX_SHAKE_CLASS } from "../fx/FxCanvas";
import { SidePanel } from "./SidePanel";
import { useBigWinShake } from "../shell/useBigWinShake";
export function TradePage() {
    const { address } = useAccount();
    const flash = useFxStore(s => s.flash);
    const bigShake = useBigWinShake();
    const [shake, setShake] = useState(false);
    useEffect(() => {
        if (!shake)
            return;
        const timer = setTimeout(() => setShake(false), 450);
        return () => clearTimeout(timer);
    }, [shake]);
    const tap = (cell: CellData) => {
        const s = useGameStore.getState();
        const result = placeTap({ cell, amount: s.betAmount, balance: s.balance, feedStale: s.feedStale[s.ticker], nowMs: Date.now() + s.serverTimeOffset, socket: s.socket, wssKey: s.wssKey, address: address ?? null });
        if (result.ok)
            return;
        if (result.reason === "INSUFFICIENT_BALANCE")
            setShake(true);
        const messages = { NOT_SIGNED_IN: "Connect your wallet and sign in to tap.", INSUFFICIENT_BALANCE: "Not enough balance. Deposit or use the faucet.", FEED_PAUSED: "Price feed paused. Taps are off for now.", WINDOW_CLOSING: "Too close to start. Tap a later column.", CELL_LIMIT: "This cell is full ($100 max per cell)." };
        toast.error(messages[result.reason]);
    };
    return <div className="flex min-h-0 flex-1">
  <section className={`relative min-w-0 flex-1 ${bigShake ? FX_SHAKE_CLASS : ""}`} aria-label="Trading board">
   <BoardCanvas onTapCell={tap} flash={flash ?? undefined}/>
   <p className="pointer-events-none absolute bottom-4 left-5 text-[10px] opacity-60">If the price line passes through your cell during its 5 seconds, you win.</p>
  </section>
  <SidePanel shake={shake}/>
 </div>;
}

import { BoardCanvas } from "../board/BoardCanvas";
import type { BoardScene } from "../board/draw";
import { FX_SHAKE_CLASS } from "../fx/FxCanvas";
import { useGameStore, type CellData } from "../store";
import { isPreviewTopUpEnabled } from "../config/dev";
import { useBalanceDisplay } from "../shell/useBalanceDisplay";
import { THEME } from "../ui/theme";
import { GettingStarted } from "./GettingStarted";
import { OpenTapsLine } from "./OpenTapsLine";
import { StakeChips } from "./StakeChips";
import { TickerRow } from "./TickerRow";

export function PhoneTradePage({
  onTapCell,
  flash,
  bigShake,
  shake,
}: {
  onTapCell: (cell: CellData) => void;
  flash?: BoardScene["flash"];
  bigShake: boolean;
  shake: boolean;
}) {
  const balance = useBalanceDisplay(useGameStore((state) => state.balance));
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TickerRow compact />
      <GettingStarted />
      <section
        className={`relative min-h-0 min-w-0 flex-1 border-y ${bigShake ? FX_SHAKE_CLASS : ""}`}
        style={{ borderColor: "rgba(29,27,24,.12)" }}
        aria-label="Trading board"
      >
        <BoardCanvas onTapCell={onTapCell} flash={flash} />
      </section>
      <OpenTapsLine />
      <div className="flex shrink-0 items-center gap-1 px-2 py-1" aria-label="Balance and stake">
        <div className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold tabular-nums" style={{ background: THEME.ink, color: THEME.paper }}>
          <span className="block text-[9px]">{isPreviewTopUpEnabled() ? "PLAY MONEY" : "TEST USDC"}</span>
          <span className="text-xs">${balance.toFixed(2)}</span>
        </div>
        <StakeChips compact shake={shake} />
      </div>
      <p className="shrink-0 px-3 py-1 text-center text-[10px] opacity-60">
        Testnet game. Test USDC has no value. Not for US persons. 18+.
      </p>
    </div>
  );
}

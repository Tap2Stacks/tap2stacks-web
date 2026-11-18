import { HowItWorksModal } from "../HowItWorksModal";
import { BoardCanvas } from "../board/BoardCanvas";
import type { BoardScene } from "../board/draw";
import { FX_SHAKE_CLASS } from "../fx/FxCanvas";
import type { CellData } from "../store";
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
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TickerRow compact />
      <section
        className={`relative min-h-0 min-w-0 flex-1 border-y ${bigShake ? FX_SHAKE_CLASS : ""}`}
        style={{ borderColor: "rgba(29,27,24,.12)" }}
        aria-label="Trading board"
      >
        <BoardCanvas onTapCell={onTapCell} flash={flash} />
      </section>
      <OpenTapsLine />
      <StakeChips compact shake={shake} />
      <HowItWorksModal />
      <p className="shrink-0 px-3 py-1 text-center text-[10px] opacity-60">
        Testnet game. Test USDC has no value. Not for US persons. 18+.
      </p>
    </div>
  );
}

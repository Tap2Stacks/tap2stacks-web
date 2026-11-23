import { HowItWorksModal } from "../HowItWorksModal";
import { TickerRow } from "./TickerRow";
import { StakeChips } from "./StakeChips";
import { OpenTapsList } from "./OpenTapsList";
export function SidePanel({ shake = false }: {
    shake?: boolean;
}) {
    return <aside className="flex h-full w-80 shrink-0 flex-col gap-7 border-l p-6" style={{ borderColor: "rgba(29,27,24,.2)" }}>
  <TickerRow />
  <section className="pb-4"><h2 className="mb-4 text-xs font-bold uppercase tracking-wider">Drop a coin</h2><StakeChips shake={shake}/></section>
  <OpenTapsList />
  <HowItWorksModal />
  <p className="text-[10px] leading-relaxed opacity-60">
    Testnet game. Test USDC has no value. Not for US persons. 18+.{" "}
    <a className="underline" href="/trading-terms.html" target="_blank" rel="noopener">Trading Terms</a>
  </p>
 </aside>;
}

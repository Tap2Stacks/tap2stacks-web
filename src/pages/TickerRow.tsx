import { useGameStore } from "../store";
import { formatChange } from "../lib/openingBell";
import { THEME } from "../ui/theme";
export function TickerRow() {
    const ticker = useGameStore(s => s.ticker);
    const price = useGameStore(s => s.currentPrice);
    const stale = useGameStore(s => s.feedStale[s.ticker]);
    const previous = useGameStore(s => s.prevDayPx[s.ticker] ?? null);
    const change = formatChange(price, previous);
    return <section>
  <div className="mb-5 flex items-center justify-between">
   <div className="flex gap-1">{(["NVDA", "TSLA"] as const).map(t => <button key={t} aria-pressed={t === ticker} onClick={() => useGameStore.getState().setTicker(t)} className="cursor-pointer rounded border px-3 py-2 text-sm font-bold" style={{ background: t === ticker ? THEME.ink : THEME.paper, color: t === ticker ? THEME.paper : THEME.ink }}>{t}</button>)}</div>
   <span className="rounded-full border px-2 py-1 text-[10px] font-bold" style={{ color: stale ? THEME.loss : THEME.win }}>{stale ? "PAUSED" : "LIVE"}</span>
  </div>
  <p className="text-4xl font-bold tracking-tight tabular-nums">${price > 0 ? price.toFixed(2) : "\u2014"}</p>
  <p className="mt-2 text-xs opacity-60">{change ? `${change} · 24h` : "Waiting for 24h reference"}</p>
 </section>;
}

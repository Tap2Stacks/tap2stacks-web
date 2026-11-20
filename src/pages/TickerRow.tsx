import { AssetLogo } from "../components/AssetLogo";
import { useGameStore } from "../store";
import { formatChange } from "../lib/openingBell";
import { THEME } from "../ui/theme";

export function TickerRow({ compact = false }: { compact?: boolean }) {
  const ticker = useGameStore((s) => s.ticker);
  const price = useGameStore((s) => s.currentPrice);
  const stale = useGameStore((s) => s.feedStale[s.ticker]);
  const previous = useGameStore((s) => s.prevDayPx[s.ticker] ?? null);
  const change = formatChange(price, previous);

  if (compact) {
    return (
      <section className="flex shrink-0 items-center gap-2.5 px-3 py-1.5">
        <div
          className="inline-flex overflow-hidden rounded-lg border text-[11px]"
          style={{ borderColor: THEME.ink }}
        >
          {(["NVDA", "TSLA"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={t === ticker}
              onClick={() => useGameStore.getState().setTicker(t)}
              className="inline-flex cursor-pointer items-center gap-1 px-2 py-1 font-bold"
              style={{
                background: t === ticker ? THEME.ink : THEME.paper,
                color: t === ticker ? THEME.paper : THEME.ink,
              }}
            >
              <AssetLogo symbol={t} size={13} />
              <span>{t}</span>
            </button>
          ))}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-extrabold tracking-tight tabular-nums">
            ${price > 0 ? price.toFixed(2) : "\u2014"}
          </span>
          {change ? (
            <span className="text-[10px] font-semibold" style={{ color: THEME.win }}>
              {change}
            </span>
          ) : null}
        </div>
        <span
          className="ml-auto rounded border px-1.5 py-0.5 text-[9px] font-extrabold"
          style={{
            color: stale ? THEME.loss : THEME.win,
            borderColor: stale ? THEME.loss : THEME.win,
          }}
        >
          {stale ? "PAUSED" : "LIVE"}
        </span>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex gap-1">
          {(["NVDA", "TSLA"] as const).map((t) => (
            <button
              key={t}
              aria-pressed={t === ticker}
              onClick={() => useGameStore.getState().setTicker(t)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded border px-3 py-2 text-sm font-bold"
              style={{
                background: t === ticker ? THEME.ink : THEME.paper,
                color: t === ticker ? THEME.paper : THEME.ink,
              }}
            >
              <AssetLogo symbol={t} size={16} />
              <span>{t}</span>
            </button>
          ))}
        </div>
        <span
          className="rounded-full border px-2 py-1 text-[10px] font-bold"
          style={{ color: stale ? THEME.loss : THEME.win }}
        >
          {stale ? "PAUSED" : "LIVE"}
        </span>
      </div>
      <p className="text-4xl font-bold tracking-tight tabular-nums">
        ${price > 0 ? price.toFixed(2) : "\u2014"}
      </p>
      <p className="mt-2 text-xs opacity-60">
        {change ? `${change} · 24h` : "Waiting for 24h reference"}
      </p>
    </section>
  );
}

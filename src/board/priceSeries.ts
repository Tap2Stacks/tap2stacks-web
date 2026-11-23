export interface PriceSample {
  ts: number;
  price: number;
}

export const HISTORY_RETENTION_MS = 310_000; // 5 min history + 10 s smoothing margin
const RETENTION_MS = HISTORY_RETENTION_MS;

interface PriceSeries {
  push(ts: number, price: number): void;
  seed(points: PriceSample[]): void;
  since(ts: number): PriceSample[];
}

const seriesMap = new Map<string, PriceSeries>();

function createPriceSeries(): PriceSeries {
  let points: PriceSample[] = [];

  const prune = (latestTs: number) => {
    const cutoff = latestTs - RETENTION_MS;
    if (points.length > 0 && points[0].ts < cutoff) {
      points = points.filter((p) => p.ts >= cutoff);
    }
  };

  return {
    push(ts: number, price: number): void {
      if (!Number.isFinite(ts) || !Number.isFinite(price)) return;
      const last = points[points.length - 1];
      if (last) {
        if (ts < last.ts) return;
        if (ts === last.ts) {
          points[points.length - 1] = { ts, price };
          return;
        }
      }
      points.push({ ts, price });
      prune(ts);
    },

    seed(seedPoints: PriceSample[]): void {
      const byTs = new Map<number, number>();
      for (const pt of points) {
        byTs.set(pt.ts, pt.price);
      }
      for (const pt of seedPoints) {
        if (Number.isFinite(pt.ts) && Number.isFinite(pt.price)) {
          byTs.set(pt.ts, pt.price);
        }
      }
      points = Array.from(byTs.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([ts, price]) => ({ ts, price }));
      if (points.length > 0) {
        prune(points[points.length - 1].ts);
      }
    },

    since(ts: number): PriceSample[] {
      return points.filter((p) => p.ts >= ts).map((p) => ({ ...p }));
    },
  };
}

/** Returns the off-React price sample series for a ticker. */
export function seriesFor(ticker: string): PriceSeries {
  let series = seriesMap.get(ticker);
  if (!series) {
    series = createPriceSeries();
    seriesMap.set(ticker, series);
  }
  return series;
}

const EPS = 1e-9;

export function shouldRedraw(
  prev: { pricePx: number; second: number; timePx: number },
  next: { pricePx: number; second: number; timePx: number },
): boolean {
  return (
    Math.abs(next.pricePx - prev.pricePx) >= 0.04 - EPS ||
    next.second !== prev.second ||
    Math.abs(next.timePx - prev.timePx) >= 0.08 - EPS
  );
}

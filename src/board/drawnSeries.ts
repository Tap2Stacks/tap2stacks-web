import type { PriceSample } from "./priceSeries";

const STEP_MS = 200;
const SIGMA_MS = 800;
const RADIUS_MS = 1400;
const MAX_DEVIATION = 0.01;
const KERNEL_EDGE = Math.exp(-0.5 * (RADIUS_MS / SIGMA_MS) ** 2);

export function rawPriceAt(points: PriceSample[], ts: number): number {
  if (points.length === 0) return 0;
  if (ts <= points[0].ts) return points[0].price;
  const last = points.at(-1)!;
  if (ts >= last.ts) return last.price;

  let lo = 0;
  let hi = points.length - 1;
  while (hi - lo > 1) {
    const middle = (lo + hi) >> 1;
    if (points[middle].ts <= ts) lo = middle;
    else hi = middle;
  }

  const a = points[lo];
  const b = points[hi];
  return a.price + ((b.price - a.price) * (ts - a.ts)) / (b.ts - a.ts);
}

function effectiveSeries(
  points: PriceSample[],
  nowMs: number,
  livePrice: number,
): PriceSample[] {
  const last = points.at(-1);
  if (!last || livePrice <= 0 || last.price === livePrice) return points;
  if (nowMs - last.ts >= 1500) return points;
  return [...points.slice(0, -1), { ts: last.ts, price: livePrice }];
}

function gaussianAt(points: PriceSample[], ts: number, nowMs: number): number {
  let total = 0;
  let mass = 0;
  for (let offset = -RADIUS_MS; offset <= RADIUS_MS; offset += STEP_MS) {
    if (ts + offset > nowMs) continue;
    const weight = Math.max(
      0,
      Math.exp(-0.5 * (offset / SIGMA_MS) ** 2) - KERNEL_EDGE,
    );
    if (weight === 0) continue;
    total += rawPriceAt(points, ts + offset) * weight;
    mass += weight;
  }
  return mass > 0 ? total / mass : rawPriceAt(points, ts);
}

function clampDeviation(
  points: PriceSample[],
  ts: number,
  price: number,
): number {
  const raw = rawPriceAt(points, ts);
  return Math.max(raw - MAX_DEVIATION, Math.min(raw + MAX_DEVIATION, price));
}

export function smoothDrawnHistory(
  rawPoints: PriceSample[],
  nowMs: number,
  livePrice: number,
): PriceSample[] {
  if (rawPoints.length === 0) {
    return livePrice > 0 ? [{ ts: nowMs, price: livePrice }] : [];
  }

  const points = effectiveSeries(rawPoints, nowMs, livePrice);
  const result: PriceSample[] = [];
  const start = Math.ceil(points[0].ts / STEP_MS) * STEP_MS;

  for (let ts = start; ts < nowMs; ts += STEP_MS) {
    const base = clampDeviation(points, ts, gaussianAt(points, ts, nowMs));
    const u = Math.max(0, Math.min(1, 1 - (nowMs - ts) / 1000));
    const blend = u * u * (3 - 2 * u);
    const blended = base + (livePrice - base) * blend;
    result.push({ ts, price: clampDeviation(points, ts, blended) });
  }

  result.push({ ts: nowMs, price: livePrice });
  return result;
}

export function createDrawnSeries() {
  let previous = new Map<number, number>();
  let lastPerf: number | undefined;

  return {
    reset() {
      previous.clear();
      lastPerf = undefined;
    },

    sample(
      rawPoints: PriceSample[],
      nowMs: number,
      livePrice: number,
      perfMs: number,
      snap = false,
    ): PriceSample[] {
      const alpha =
        lastPerf === undefined || snap
          ? 1
          : 1 - Math.exp(-Math.max(0, perfMs - lastPerf) / 95);
      const points = effectiveSeries(rawPoints, nowMs, livePrice);
      const targets = smoothDrawnHistory(rawPoints, nowMs, livePrice);
      const next = new Map<number, number>();

      const result = targets.map((p) => {
        const old = previous.get(p.ts);
        const keepTarget =
          old === undefined || nowMs - p.ts >= 2000 || p.ts === nowMs;
        const eased = keepTarget ? p.price : old + (p.price - old) * alpha;
        const price =
          p.ts === nowMs ? p.price : clampDeviation(points, p.ts, eased);
        next.set(p.ts, price);
        return { ts: p.ts, price };
      });

      previous = next;
      lastPerf = perfMs;
      return result;
    },
  };
}

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

const FREEZE_AGE_MS = 3600;

/**
 * Slices a smoothed price series to the visible time window (with one guard
 * sample on each side) and applies min-max bucket decimation when zoomed out
 * so the rendered curve stays bounded (< ~320 segments) without flattening peaks.
 */
export function decimateVisibleLine(
  points: PriceSample[],
  leftTs: number,
  rightTs: number,
  msPerPx: number,
  minPxStep = 1.5,
): PriceSample[] {
  const n = points.length;
  if (n <= 2) return points;

  // Binary search first index with ts >= leftTs
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].ts < leftTs) lo = mid + 1;
    else hi = mid;
  }
  const startIdx = Math.max(0, lo - 1);

  // Binary search last index with ts <= rightTs
  lo = startIdx;
  hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid].ts <= rightTs) lo = mid;
    else hi = mid - 1;
  }
  const endIdx = Math.min(n - 1, lo + 1);
  const count = endIdx - startIdx + 1;
  if (count <= 2) return points.slice(startIdx, endIdx + 1);

  const safeMsPerPx = Number.isFinite(msPerPx) && msPerPx > 0 ? msPerPx : 50;
  const bucketMs = safeMsPerPx * minPxStep * 2;
  if (STEP_MS >= safeMsPerPx * minPxStep || count <= 240) {
    return points.slice(startIdx, endIdx + 1);
  }

  const out: PriceSample[] = [points[startIdx]];
  let bucketStart = points[startIdx].ts;
  let minPt: PriceSample | null = null;
  let maxPt: PriceSample | null = null;

  for (let i = startIdx + 1; i < endIdx; i++) {
    const p = points[i];
    if (p.ts - bucketStart >= bucketMs && minPt && maxPt) {
      if (minPt === maxPt) {
        out.push(minPt);
      } else if (minPt.ts < maxPt.ts) {
        out.push(minPt, maxPt);
      } else {
        out.push(maxPt, minPt);
      }
      bucketStart = p.ts;
      minPt = p;
      maxPt = p;
    } else {
      if (!minPt || p.price < minPt.price) minPt = p;
      if (!maxPt || p.price > maxPt.price) maxPt = p;
    }
  }
  if (minPt && maxPt) {
    if (minPt === maxPt) {
      out.push(minPt);
    } else if (minPt.ts < maxPt.ts) {
      out.push(minPt, maxPt);
    } else {
      out.push(maxPt, minPt);
    }
  }
  out.push(points[endIdx]);
  return out;
}

export function createDrawnSeries() {
  let previous = new Map<number, number>();
  let frozen = new Map<number, number>();
  let firstRawTs = Infinity;
  let lastPerf: number | undefined;

  return {
    reset() {
      previous.clear();
      frozen.clear();
      firstRawTs = Infinity;
      lastPerf = undefined;
    },

    sample(
      rawPoints: PriceSample[],
      nowMs: number,
      livePrice: number,
      perfMs: number,
      snap = false,
    ): PriceSample[] {
      if (rawPoints.length === 0) {
        return livePrice > 0 ? [{ ts: nowMs, price: livePrice }] : [];
      }

      // If older historical data was newly seeded, invalidate frozen cache once
      if (rawPoints[0].ts < firstRawTs) {
        frozen.clear();
      }
      firstRawTs = rawPoints[0].ts;

      const alpha =
        lastPerf === undefined || snap
          ? 1
          : 1 - Math.exp(-Math.max(0, perfMs - lastPerf) / 95);
      const points = effectiveSeries(rawPoints, nowMs, livePrice);
      const start = Math.ceil(points[0].ts / STEP_MS) * STEP_MS;
      const freezeBefore = nowMs - FREEZE_AGE_MS;
      const lastRawTs = points[points.length - 1].ts;

      // Prune stale frozen entries older than current window
      if (frozen.size > 0) {
        for (const ts of frozen.keys()) {
          if (ts < start) frozen.delete(ts);
          else break;
        }
      }

      const next = new Map<number, number>();
      const result: PriceSample[] = [];

      for (let ts = start; ts < nowMs; ts += STEP_MS) {
        let target: number;
        const canFreeze = ts <= freezeBefore && lastRawTs >= ts + RADIUS_MS;
        const cached = canFreeze ? frozen.get(ts) : undefined;
        if (cached !== undefined) {
          target = cached;
        } else {
          const base = clampDeviation(points, ts, gaussianAt(points, ts, nowMs));
          if (nowMs - ts >= 1000) {
            target = base;
          } else {
            const u = Math.max(0, Math.min(1, 1 - (nowMs - ts) / 1000));
            const blend = u * u * (3 - 2 * u);
            target = clampDeviation(points, ts, base + (livePrice - base) * blend);
          }
          if (canFreeze) {
            frozen.set(ts, target);
          }
        }

        const old = previous.get(ts);
        const keepTarget = old === undefined || nowMs - ts >= 2000;
        const price = keepTarget
          ? target
          : clampDeviation(points, ts, old + (target - old) * alpha);
        if (nowMs - ts < 2200) {
          next.set(ts, price);
        }
        result.push({ ts, price });
      }

      result.push({ ts: nowMs, price: livePrice });
      previous = next;
      lastPerf = perfMs;
      return result;
    },
  };
}

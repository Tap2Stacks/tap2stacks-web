import { probabilityHeat } from "./cellColor";

export const TWO_MINUTES_MS = 120_000;
export const MIN_ODDS_ALPHA = 0.28;
export const MIN_TINT_ALPHA = 0.48;

export type OddsFontWeight = 400 | 500 | 600 | 700;

export interface CellFadeInput {
  multiplier: number;
  cellLower: number;
  cellUpper: number;
  livePrice: number;
  startTs: number;
  endTs: number;
  nowMs: number;
  visibleAheadMs: number;
}

export interface CellFadeResult {
  textAlpha: number;
  tintAlpha: number;
  fontWeight: OddsFontWeight;
}

const HEAT_AT_2X = probabilityHeat(2);

/**
 * Computes smooth opacity and font weight for a cell's odds label and surface
 * tint from:
 *  - log-odds win probability (same perceptual axis as cellColor.ts),
 *  - price-row distance from livePrice, and
 *  - time ahead of now relative to the visible horizon.
 *
 * Less likely cells fade smoothly in both opacity and font weight so colour,
 * depth, and typography agree.
 */
export function cellFade(input: CellFadeInput): CellFadeResult {
  const rowStep = Math.abs(input.cellUpper - input.cellLower);
  const cellMidPrice = (input.cellLower + input.cellUpper) / 2;
  const rowDistance =
    rowStep > 0 && input.livePrice > 0
      ? Math.abs(cellMidPrice - input.livePrice) / rowStep
      : 0;
  const rowWeight = 1 / (1 + Math.pow(rowDistance / 5.5, 1.6));

  const horizonMs =
    input.visibleAheadMs > 0 && input.visibleAheadMs < TWO_MINUTES_MS
      ? input.visibleAheadMs
      : TWO_MINUTES_MS;
  const cellMidTs = (input.startTs + input.endTs) / 2;
  const aheadMs = Math.max(0, cellMidTs - input.nowMs);
  const timeProgress = Math.min(
    1,
    Math.max(0, (aheadMs - 5000) / Math.max(1000, horizonMs - 5000)),
  );
  const timeWeight = 1 - 0.75 * Math.pow(timeProgress, 1.1);

  let probWeight: number;
  if (!Number.isFinite(input.multiplier) || input.multiplier <= 2) {
    probWeight = 1;
  } else {
    const t = probabilityHeat(input.multiplier);
    const normalized = Math.max(0, Math.min(1, (1 - t) / (1 - HEAT_AT_2X)));
    probWeight = Math.pow(normalized, 1.85);
  }

  const combined = rowWeight * timeWeight * probWeight;
  const fontWeight: OddsFontWeight =
    combined >= 0.62 ? 700 : combined >= 0.38 ? 600 : combined >= 0.18 ? 500 : 400;

  return {
    textAlpha: MIN_ODDS_ALPHA + (1 - MIN_ODDS_ALPHA) * combined,
    tintAlpha: MIN_TINT_ALPHA + (1 - MIN_TINT_ALPHA) * combined,
    fontWeight,
  };
}

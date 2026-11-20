export const TWO_MINUTES_MS = 120_000;
export const MIN_ODDS_ALPHA = 0.28;
export const MIN_TINT_ALPHA = 0.48;

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
}

/**
 * Computes smooth opacity for a cell's odds label and heat tint from its
 * price-row distance, time ahead of now, and multiplier size.
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

  const multWeight =
    !Number.isFinite(input.multiplier) || input.multiplier <= 2
      ? 1
      : 1 / (1 + Math.pow((input.multiplier - 2) / 6.5, 1.2));

  const combined = rowWeight * timeWeight * multWeight;
  return {
    textAlpha: MIN_ODDS_ALPHA + (1 - MIN_ODDS_ALPHA) * combined,
    tintAlpha: MIN_TINT_ALPHA + (1 - MIN_TINT_ALPHA) * combined,
  };
}

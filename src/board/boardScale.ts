export const TIME_AXIS_HEIGHT = 20;
export const EXTENDED_HORIZON_THRESHOLD_MS = 45_000;

/**
 * Compute default board scale inputs for desktop vs phone viewports and
 * standard (~30-35 s, 6-window) vs extended (2-minute, 24-window) quote streams.
 *
 * - Standard tickers (e.g. TSLA, 6 windows): NOW at 50% of plotWidth, showing
 *   32 s history + 32 s future on phone (35 s + 35 s on desktop).
 * - Extended tickers (e.g. NVDA, 24 windows / 2 min): shows ~60 s of future
 *   cells by default (with ~32-37 s of history) to hint the grid continues
 *   further via drag/zoom up to the full 2-minute horizon.
 * - Reserves both a right gutter for the live price tag and a dedicated bottom
 *   lane (`bottomGutter`) for the time axis so NOW never overlaps cells.
 */
export function boardScale(
  _width: number,
  height: number,
  isPhone: boolean,
  quotedAheadMs = 0,
): {
  nowFraction: number;
  visibleRows: number;
  defaultAheadMs: number;
  rightGutter: number;
  bottomGutter: number;
} {
  const extended = quotedAheadMs > EXTENDED_HORIZON_THRESHOLD_MS;
  const bottomGutter = TIME_AXIS_HEIGHT;
  if (!isPhone) {
    return {
      nowFraction: extended ? 0.38 : 0.5,
      visibleRows: 20,
      defaultAheadMs: extended ? 60_000 : 35_000,
      rightGutter: 58,
      bottomGutter,
    };
  }
  const plotH = Math.max(36, height - bottomGutter);
  return {
    nowFraction: extended ? 0.35 : 0.5,
    visibleRows: Math.max(1, Math.floor(plotH / 36)),
    defaultAheadMs: extended ? 60_000 : 32_000,
    rightGutter: 50,
    bottomGutter,
  };
}

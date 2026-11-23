/**
 * Compute default board scale inputs for desktop vs phone viewports.
 * Both desktop and phone center "now" at 50% of the plot width (excluding the
 * reserved right gutter for the live price tag) so 32-35 s of price history
 * and 32-35 s of future cells are visible by default, while phone limits
 * visible rows so each row stays at least 36 px tall.
 */
export function boardScale(
  _width: number,
  height: number,
  isPhone: boolean,
): {
  nowFraction: number;
  visibleRows: number;
  defaultAheadMs: number;
  rightGutter: number;
} {
  if (!isPhone) {
    return {
      nowFraction: 0.5,
      visibleRows: 20,
      defaultAheadMs: 35_000,
      rightGutter: 58,
    };
  }
  return {
    nowFraction: 0.5,
    visibleRows: Math.max(1, Math.floor(height / 36)),
    defaultAheadMs: 32_000,
    rightGutter: 50,
  };
}

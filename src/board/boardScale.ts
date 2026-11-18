/**
 * Compute board scale inputs for desktop vs phone viewports.
 * Desktop keeps "now" at 30% with 20 price rows; phone shifts "now" to 20%
 * and limits visible rows so each cell stays at least 36 px tall.
 */
export function boardScale(
  _width: number,
  height: number,
  isPhone: boolean,
): { nowFraction: number; visibleRows: number } {
  if (!isPhone) {
    return { nowFraction: 0.3, visibleRows: 20 };
  }
  return {
    nowFraction: 0.2,
    visibleRows: Math.max(10, Math.floor(height / 36)),
  };
}

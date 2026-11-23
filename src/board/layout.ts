export interface BoardViewport {
  width: number;
  height: number;
  nowMs: number;
  /** Timestamp anchored at `plotWidth * nowFraction`. Defaults to `nowMs` when following live. */
  viewNowMs?: number;
  nowFraction: number;
  msPerPx: number;
  centerPrice: number;
  pricePerPx: number;
  /** Reserved right-edge gutter (CSS px) for the live price tag / edge marker. Defaults to 0. */
  rightGutter?: number;
}

/** Usable chart width excluding the reserved right-edge price-tag gutter. */
export function plotWidth(v: Pick<BoardViewport, "width" | "rightGutter">): number {
  return Math.max(1, v.width - (v.rightGutter ?? 0));
}

/** Maps a timestamp to canvas x with viewNowMs (or nowMs) at nowFraction of plotWidth. */
export function timeToX(v: BoardViewport, ts: number): number {
  const originMs = v.viewNowMs ?? v.nowMs;
  return plotWidth(v) * v.nowFraction + (ts - originMs) / v.msPerPx;
}

/** Inverse of timeToX: maps canvas x back to a world timestamp. */
export function xToTime(v: BoardViewport, x: number): number {
  const originMs = v.viewNowMs ?? v.nowMs;
  return originMs + (x - plotWidth(v) * v.nowFraction) * v.msPerPx;
}

/** Maps a price to canvas y with centerPrice at vertical center. */
export function priceToY(v: BoardViewport, price: number): number {
  return v.height / 2 - (price - v.centerPrice) / v.pricePerPx;
}

/** Inverse of priceToY: maps canvas y back to a price. */
export function yToPrice(v: BoardViewport, y: number): number {
  return v.centerPrice - (y - v.height / 2) * v.pricePerPx;
}

export function cellRect(
  v: BoardViewport,
  cell: { startTs: number; endTs: number; lower: number; upper: number },
): { x: number; y: number; w: number; h: number } {
  const x0 = timeToX(v, cell.startTs);
  const x1 = timeToX(v, cell.endTs);
  const yTop = priceToY(v, cell.upper);
  const yBottom = priceToY(v, cell.lower);
  return {
    x: x0,
    y: Math.min(yTop, yBottom),
    w: Math.max(0, x1 - x0),
    h: Math.max(0, Math.abs(yBottom - yTop)),
  };
}

/** Returns the cell under (x, y), or undefined in the past area (left of nowMs) or right gutter. */
export function hitTestCell<
  T extends { startTs: number; endTs: number; lower: number; upper: number },
>(v: BoardViewport, cells: T[], x: number, y: number): T | undefined {
  if (x < timeToX(v, v.nowMs) || x >= plotWidth(v)) return undefined;
  for (const cell of cells) {
    const r = cellRect(v, cell);
    if (
      r.w > 0 &&
      r.h > 0 &&
      x >= r.x &&
      x < r.x + r.w &&
      y >= r.y &&
      y < r.y + r.h
    ) {
      return cell;
    }
  }
  return undefined;
}

export function isLocked(startTs: number, nowMs: number): boolean {
  return startTs < nowMs + 5000;
}

import type { CellData } from "../store";

/**
 * Size of the grid the engine is quoting now, for the zoom-out limit: only the
 * newest grid of the ticker (older grids linger in the store with re-centred
 * rows and locked windows), only windows that have not ended, and rows counted
 * per column by price step so "155.0" and "155.00" are one row.
 */
export function quotedGridSize(
  cells: readonly CellData[],
  ticker: string,
  nowMs: number,
  priceStep: number,
): { rows: number; cols: number } {
  const step = Number.isFinite(priceStep) && priceStep > 0 ? priceStep : 0.03;
  let newest = -Infinity;
  for (const c of cells) {
    if (c.original.ticker === ticker && c.timeWindowEnd > nowMs && c.original.gridTs > newest) newest = c.original.gridTs;
  }
  if (!Number.isFinite(newest)) return { rows: 0, cols: 0 };
  const rowsByCol = new Map<number, Set<number>>();
  for (const c of cells) {
    if (c.original.ticker !== ticker || c.original.gridTs !== newest || c.timeWindowEnd <= nowMs) continue;
    const lower = Number(c.original.lowerPrice);
    if (!Number.isFinite(lower)) continue;
    const rows = rowsByCol.get(c.timeWindowStart) ?? new Set<number>();
    rows.add(Math.round(lower / step));
    rowsByCol.set(c.timeWindowStart, rows);
  }
  let rows = 0;
  for (const set of rowsByCol.values()) rows = Math.max(rows, set.size);
  return { rows, cols: rowsByCol.size };
}

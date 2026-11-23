import type { CellData } from "../store";
import { cellRect, isLocked, type BoardViewport } from "./layout";
import type { CoinStack } from "./types";
import { impliedProbability } from "./cellColor";

export const MAX_DRAWN_CELLS = 240;
export const MIN_TILE_W_PX = 14;
export const MIN_TILE_H_PX = 10;

export type CellTextMode = "full" | "compact" | "none";

export interface RenderTile {
  startTs: number;
  endTs: number;
  lower: number;
  upper: number;
  multiplier: number;
  locked: boolean;
  mergedCount: number;
  sourceCell?: CellData;
}

export interface CellLodPlan {
  tiles: RenderTile[];
  textMode: CellTextMode;
  merged: boolean;
  colStride: number;
  rowStride: number;
}

export function textModeForSize(w: number, h: number): CellTextMode {
  if (w >= 34 && h >= 18) return "full";
  if (w >= 24 && h >= 14) return "compact";
  return "none";
}

export function formatLodMultiplier(multiplier: number, mode: CellTextMode): string {
  if (mode === "compact" && multiplier >= 10) {
    return `x${Math.round(multiplier)}`;
  }
  return `x${multiplier.toFixed(1)}`;
}

/**
 * Plans visible non-past cells into a bounded number of render tiles (<= MAX_DRAWN_CELLS)
 * and selects the appropriate text LOD so zooming out across 2 minutes of future windows
 * stays locked at 60 fps on mobile.
 */
export function planCellLod(
  cells: CellData[],
  viewport: BoardViewport,
  priceStep: number,
  _stacks: Record<string, CoinStack>,
): CellLodPlan {
  const future: CellData[] = [];
  for (const cell of cells) {
    if (cell.timeWindowEnd <= viewport.nowMs || cell.status === "past") continue;
    const r = cellRect(viewport, {
      startTs: cell.timeWindowStart,
      endTs: cell.timeWindowEnd,
      lower: Number(cell.original.lowerPrice),
      upper: Number(cell.original.upperPrice),
    });
    if (r.x + r.w < 0 || r.x > viewport.width || r.y + r.h < 0 || r.y > viewport.height) {
      continue;
    }
    future.push(cell);
  }

  if (future.length === 0) {
    return { tiles: [], textMode: "full", merged: false, colStride: 1, rowStride: 1 };
  }

  const sample = future[0];
  const sampleStepMs = Math.max(1000, sample.timeWindowEnd - sample.timeWindowStart);
  const samplePriceStep = Math.max(
    1e-6,
    Math.abs(Number(sample.original.upperPrice) - Number(sample.original.lowerPrice)) || priceStep || 0.03,
  );
  const cellW = sampleStepMs / viewport.msPerPx;
  const cellH = samplePriceStep / viewport.pricePerPx;

  let colStride = cellW < MIN_TILE_W_PX ? Math.ceil(MIN_TILE_W_PX / Math.max(1, cellW)) : 1;
  let rowStride = cellH < MIN_TILE_H_PX ? Math.ceil(MIN_TILE_H_PX / Math.max(1, cellH)) : 1;

  // Also ensure total drawn tile count stays <= MAX_DRAWN_CELLS
  while (future.length / (colStride * rowStride) > MAX_DRAWN_CELLS) {
    if (cellW * colStride <= cellH * rowStride) {
      colStride *= 2;
    } else {
      rowStride *= 2;
    }
  }

  const merged = colStride > 1 || rowStride > 1;
  const textMode = textModeForSize(cellW, cellH);

  if (!merged) {
    const tiles: RenderTile[] = future.map((cell) => ({
      startTs: cell.timeWindowStart,
      endTs: cell.timeWindowEnd,
      lower: Number(cell.original.lowerPrice),
      upper: Number(cell.original.upperPrice),
      multiplier: cell.multiplier,
      locked: isLocked(cell.timeWindowStart, viewport.nowMs),
      mergedCount: 1,
      sourceCell: cell,
    }));
    return { tiles, textMode, merged: false, colStride: 1, rowStride: 1 };
  }

  interface BucketAcc {
    startTs: number;
    endTs: number;
    lower: number;
    upper: number;
    probSum: number;
    count: number;
    locked: boolean;
  }

  const groups = new Map<string, BucketAcc>();
  for (const cell of future) {
    const locked = isLocked(cell.timeWindowStart, viewport.nowMs);
    const lower = Number(cell.original.lowerPrice);
    const upper = Number(cell.original.upperPrice);
    const colIdx = Math.floor(cell.timeWindowStart / (sampleStepMs * colStride));
    const rowIdx = Math.floor(Math.round(lower / samplePriceStep) / rowStride);
    const key = `${locked ? 1 : 0}:${colIdx}:${rowIdx}`;
    const p = impliedProbability(cell.multiplier);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        startTs: cell.timeWindowStart,
        endTs: cell.timeWindowEnd,
        lower,
        upper,
        probSum: p,
        count: 1,
        locked,
      });
    } else {
      if (cell.timeWindowStart < existing.startTs) existing.startTs = cell.timeWindowStart;
      if (cell.timeWindowEnd > existing.endTs) existing.endTs = cell.timeWindowEnd;
      if (lower < existing.lower) existing.lower = lower;
      if (upper > existing.upper) existing.upper = upper;
      existing.probSum += p;
      existing.count += 1;
    }
  }

  const tiles: RenderTile[] = [];
  for (const acc of groups.values()) {
    const avgProb = acc.probSum / acc.count;
    tiles.push({
      startTs: acc.startTs,
      endTs: acc.endTs,
      lower: acc.lower,
      upper: acc.upper,
      multiplier: avgProb > 0 ? 1 / avgProb : 100,
      locked: acc.locked,
      mergedCount: acc.count,
    });
  }

  return {
    tiles,
    textMode: "none",
    merged: true,
    colStride,
    rowStride,
  };
}

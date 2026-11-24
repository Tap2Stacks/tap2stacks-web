import type { CellData } from "../store";
import { plotHeight, plotWidth, priceToY, timeToX, type BoardViewport } from "./layout";

export function visibleCells(
  cells: CellData[],
  ticker: string,
  viewport: BoardViewport,
): CellData[] {
  const right = plotWidth(viewport);
  const bottom = plotHeight(viewport);
  return cells.filter((cell) => {
    if (cell.original.ticker !== ticker) return false;
    if (
      timeToX(viewport, cell.timeWindowEnd) <= 0 ||
      timeToX(viewport, cell.timeWindowStart) >= right
    ) {
      return false;
    }
    const yTop = priceToY(viewport, Number(cell.original.upperPrice));
    const yBottom = priceToY(viewport, Number(cell.original.lowerPrice));
    return Math.max(yTop, yBottom) > 0 && Math.min(yTop, yBottom) < bottom;
  });
}

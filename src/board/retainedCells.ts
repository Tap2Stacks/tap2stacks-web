import type { CellData } from "../store";
import { timeToX, type BoardViewport } from "./layout";

export function visibleCells(
  cells: CellData[],
  ticker: string,
  viewport: BoardViewport,
): CellData[] {
  return cells.filter(
    (cell) =>
      cell.original.ticker === ticker &&
      timeToX(viewport, cell.timeWindowEnd) > 0 &&
      timeToX(viewport, cell.timeWindowStart) < viewport.width,
  );
}

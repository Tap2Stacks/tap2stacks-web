import { describe, expect, it } from "vitest";
import { boardScale } from "./boardScale";

describe("boardScale", () => {
  it("keeps desktop at nowFraction 0.3 and 20 visible rows", () => {
    expect(boardScale(1440, 800, false)).toEqual({
      nowFraction: 0.3,
      visibleRows: 20,
    });
  });

  it("places now at 20% and sizes rows >= 36 px and columns >= 44 px at 390x536 phone", () => {
    const scale = boardScale(390, 536, true);
    expect(scale).toEqual({ nowFraction: 0.2, visibleRows: 14 });

    const msPerPx = 35000 / (390 * (1 - scale.nowFraction));
    const colWidth = 5000 / msPerPx;
    const rowHeight = 536 / scale.visibleRows;
    expect(colWidth).toBeGreaterThanOrEqual(44);
    expect(rowHeight).toBeGreaterThanOrEqual(36);
  });

  it("keeps rows tall on short phone heights", () => {
    expect(boardScale(390, 300, true).visibleRows).toBe(8);
  });
});

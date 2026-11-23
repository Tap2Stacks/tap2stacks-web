import { describe, expect, it } from "vitest";
import { boardScale } from "./boardScale";

describe("boardScale", () => {
  it("shows 35 s history and 35 s future with 20 visible rows and a right gutter on desktop", () => {
    expect(boardScale(1440, 800, false)).toEqual({
      nowFraction: 0.5,
      visibleRows: 20,
      defaultAheadMs: 35_000,
      rightGutter: 58,
    });
  });

  it("shows 32 s history and 32 s future with rows >= 36 px and reserved right gutter at 375 px phone", () => {
    const scale = boardScale(375, 536, true);
    expect(scale).toEqual({
      nowFraction: 0.5,
      visibleRows: 14,
      defaultAheadMs: 32_000,
      rightGutter: 50,
    });

    const plotW = 375 - scale.rightGutter;
    const msPerPx = scale.defaultAheadMs / (plotW * (1 - scale.nowFraction));
    const historyVisibleMs = plotW * scale.nowFraction * msPerPx;
    const futureVisibleMs = plotW * (1 - scale.nowFraction) * msPerPx;
    const rowHeight = 536 / scale.visibleRows;

    expect(historyVisibleMs).toBeGreaterThanOrEqual(30_000);
    expect(historyVisibleMs).toBeLessThanOrEqual(40_000);
    expect(futureVisibleMs).toBeGreaterThanOrEqual(30_000);
    expect(rowHeight).toBeGreaterThanOrEqual(36);
  });

  it("keeps rows tall on short phone heights", () => {
    expect(boardScale(390, 300, true).visibleRows).toBe(8);
  });
});

import { describe, expect, it } from "vitest";
import { boardScale, TIME_AXIS_HEIGHT } from "./boardScale";

describe("boardScale", () => {
  it("shows 35 s history and 35 s future with 20 visible rows and gutters on desktop (6-window ticker)", () => {
    expect(boardScale(1440, 800, false)).toEqual({
      nowFraction: 0.5,
      visibleRows: 20,
      defaultAheadMs: 35_000,
      rightGutter: 58,
      bottomGutter: TIME_AXIS_HEIGHT,
    });
  });

  it("shows 32 s history and 32 s future with rows >= 36 px at 375 px phone (6-window ticker)", () => {
    const scale = boardScale(375, 536, true, 30_000);
    expect(scale).toEqual({
      nowFraction: 0.5,
      visibleRows: 14,
      defaultAheadMs: 32_000,
      rightGutter: 50,
      bottomGutter: TIME_AXIS_HEIGHT,
    });

    const plotW = 375 - scale.rightGutter;
    const plotH = 536 - scale.bottomGutter;
    const msPerPx = scale.defaultAheadMs / (plotW * (1 - scale.nowFraction));
    const historyVisibleMs = plotW * scale.nowFraction * msPerPx;
    const futureVisibleMs = plotW * (1 - scale.nowFraction) * msPerPx;
    const rowHeight = plotH / scale.visibleRows;

    expect(historyVisibleMs).toBeGreaterThanOrEqual(30_000);
    expect(historyVisibleMs).toBeLessThanOrEqual(40_000);
    expect(futureVisibleMs).toBeGreaterThanOrEqual(30_000);
    expect(rowHeight).toBeGreaterThanOrEqual(36);
  });

  it("shows ~60 s of future and ~32 s of history at 375 px phone for 2-minute (24-window) tickers", () => {
    const scale = boardScale(375, 536, true, 120_000);
    expect(scale.defaultAheadMs).toBe(60_000);
    expect(scale.bottomGutter).toBe(TIME_AXIS_HEIGHT);

    const plotW = 375 - scale.rightGutter;
    const msPerPx = scale.defaultAheadMs / (plotW * (1 - scale.nowFraction));
    const historyVisibleMs = plotW * scale.nowFraction * msPerPx;
    const futureVisibleMs = plotW * (1 - scale.nowFraction) * msPerPx;

    expect(futureVisibleMs).toBeCloseTo(60_000, 1);
    expect(historyVisibleMs).toBeGreaterThanOrEqual(30_000);
    expect(historyVisibleMs).toBeLessThanOrEqual(40_000);
  });

  it("keeps rows tall on short phone heights even with the bottom time-axis lane", () => {
    const scale = boardScale(390, 300, true);
    expect(scale.visibleRows).toBe(7);
    expect((300 - scale.bottomGutter) / scale.visibleRows).toBeGreaterThanOrEqual(36);
  });
});

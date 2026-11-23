import { describe, expect, it } from "vitest";
import {
  cellRect,
  hitTestCell,
  isLocked,
  plotWidth,
  priceToY,
  timeToX,
  xToTime,
  yToPrice,
  type BoardViewport,
} from "./layout";

const viewport: BoardViewport = {
  width: 1000,
  height: 600,
  nowMs: 10_000,
  nowFraction: 0.3,
  msPerPx: 50, // 5000 ms = 100 px
  centerPrice: 155,
  pricePerPx: 0.001, // $0.03 = 30 px
};

describe("board layout and hit-testing", () => {
  it("places nowMs at 30% of board width", () => {
    expect(timeToX(viewport, viewport.nowMs)).toBe(300);
    expect(timeToX(viewport, 15_000)).toBe(400);
    expect(timeToX(viewport, 5_000)).toBe(200);
  });

  it("maps centerPrice to vertical middle and higher prices to smaller y", () => {
    expect(priceToY(viewport, 155)).toBe(300);
    expect(priceToY(viewport, 155.03)).toBeCloseTo(270, 9);
    expect(priceToY(viewport, 154.97)).toBeCloseTo(330, 9);
  });

  it("computes cellRect from cell bounds", () => {
    const rect = cellRect(viewport, {
      startTs: 15_000,
      endTs: 20_000,
      lower: 155.0,
      upper: 155.03,
    });
    expect(rect.x).toBe(400);
    expect(rect.w).toBe(100);
    expect(rect.y).toBeCloseTo(270, 9);
    expect(rect.h).toBeCloseTo(30, 9);
  });

  it("hitTestCell returns the cell under a point and undefined in the past area", () => {
    const pastStraddlingCell = {
      id: "straddle",
      startTs: 8_000, // starts at x = 260 (in past area < 300)
      endTs: 13_000, // ends at x = 360
      lower: 155.0,
      upper: 155.03,
    };
    const futureCell = {
      id: "future",
      startTs: 15_000, // x = 400..500
      endTs: 20_000,
      lower: 155.0,
      upper: 155.03,
    };

    expect(hitTestCell(viewport, [pastStraddlingCell, futureCell], 450, 285)).toBe(
      futureCell,
    );
    expect(
      hitTestCell(viewport, [pastStraddlingCell, futureCell], 280, 285),
    ).toBeUndefined();
    expect(
      hitTestCell(viewport, [pastStraddlingCell, futureCell], 450, 100),
    ).toBeUndefined();
  });

  it("isLocked returns true when startTs < nowMs + 5000", () => {
    expect(isLocked(10_000, 5_001)).toBe(true);
    expect(isLocked(10_000, 5_000)).toBe(false);
    expect(isLocked(15_000, 10_000)).toBe(false);
  });

  it("respects custom nowFraction in timeToX and hitTestCell", () => {
    const phoneVp: BoardViewport = { ...viewport, nowFraction: 0.2 };
    expect(timeToX(phoneVp, phoneVp.nowMs)).toBe(200);

    const cell = {
      id: "near-now",
      startTs: 9_000, // x = 180..280
      endTs: 14_000,
      lower: 155.0,
      upper: 155.03,
    };
    expect(hitTestCell(phoneVp, [cell], 190, 285)).toBeUndefined();
    expect(hitTestCell(phoneVp, [cell], 210, 285)).toBe(cell);
  });

  it("supports panned viewNowMs and round-trips xToTime / yToPrice", () => {
    const panned: BoardViewport = { ...viewport, viewNowMs: 25_000 };
    expect(timeToX(panned, 10_000)).toBeCloseTo(0, 6);
    expect(timeToX(panned, 25_000)).toBeCloseTo(300, 6);
    expect(xToTime(panned, 500)).toBeCloseTo(35_000, 6);
    expect(yToPrice(panned, 270)).toBeCloseTo(155.03, 6);

    const cell = {
      id: "future-panned",
      startTs: 15_000,
      endTs: 20_000,
      lower: 155.0,
      upper: 155.03,
    };
    expect(hitTestCell(panned, [cell], 150, 285)).toBe(cell);

    const pannedPast: BoardViewport = { ...viewport, viewNowMs: 0 };
    const pastCell = {
      id: "past-panned",
      startTs: 5_000,
      endTs: 12_000,
      lower: 155.0,
      upper: 155.03,
    };
    expect(hitTestCell(pannedPast, [pastCell], 450, 285)).toBeUndefined();
    expect(hitTestCell(pannedPast, [pastCell], 510, 285)).toBe(pastCell);
  });

  it("excludes the reserved right gutter from plotWidth and hitTestCell", () => {
    const gutterVp: BoardViewport = { ...viewport, rightGutter: 60 };
    expect(plotWidth(gutterVp)).toBe(940);
    const edgeCell = {
      id: "right-edge",
      startTs: 40_000,
      endTs: 50_000,
      lower: 155.0,
      upper: 155.03,
    };
    expect(hitTestCell(gutterVp, [edgeCell], 930, 285)).toBe(edgeCell);
    expect(hitTestCell(gutterVp, [edgeCell], 945, 285)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import {
  applyEdgeResistance,
  baseScaleFor,
  BoardCamera,
  clampZoom,
  FUTURE_LIMIT_MS,
  HISTORY_LIMIT_MS,
  MAX_PRICE_ZOOM,
  MAX_TIME_ZOOM,
  MIN_PRICE_ZOOM,
  priceBounds,
  rubberBand,
  timeOffsetBounds,
  type CameraMetrics,
} from "./camera";
import { priceToY, timeToX, xToTime, yToPrice } from "./layout";

const desktopMetrics: CameraMetrics = {
  width: 1000,
  height: 600,
  nowFraction: 0.3,
  visibleRows: 20,
  priceStep: 0.03,
};

const phoneMetrics: CameraMetrics = {
  width: 375,
  height: 500,
  nowFraction: 0.2,
  visibleRows: 13,
  priceStep: 0.03,
};

describe("camera zoom, pan transforms and clamps", () => {
  it("computes base scales matching 35 s default horizon and 7 min full zoom-out", () => {
    const d = baseScaleFor(desktopMetrics);
    expect(d.baseMsPerPx).toBeCloseTo(50, 6); // 35000 / 700
    expect(d.basePricePerPx).toBeCloseTo(0.001, 6); // 0.60 / 600
    // At minTimeZoom, full width spans 5 min back + 2 min ahead = 420 s
    const fullMsPerPx = d.baseMsPerPx / d.minTimeZoom;
    expect(fullMsPerPx * desktopMetrics.width).toBeCloseTo(
      HISTORY_LIMIT_MS + FUTURE_LIMIT_MS,
      3,
    );

    const p = baseScaleFor(phoneMetrics);
    const phoneFullMsPerPx = p.baseMsPerPx / p.minTimeZoom;
    expect(phoneFullMsPerPx * phoneMetrics.width).toBeCloseTo(
      HISTORY_LIMIT_MS + FUTURE_LIMIT_MS,
      3,
    );
  });

  it("clamps timeZoom and priceZoom strictly within bounds", () => {
    const { minTimeZoom } = baseScaleFor(desktopMetrics);
    expect(clampZoom(0.01, 0.01, minTimeZoom)).toEqual({
      timeZoom: minTimeZoom,
      priceZoom: MIN_PRICE_ZOOM,
    });
    expect(clampZoom(99, 99, minTimeZoom)).toEqual({
      timeZoom: MAX_TIME_ZOOM,
      priceZoom: MAX_PRICE_ZOOM,
    });
    expect(clampZoom(Number.NaN, Number.POSITIVE_INFINITY, minTimeZoom)).toEqual({
      timeZoom: 1,
      priceZoom: 1,
    });
  });

  it("clamps time pan offset so left edge never passes -5 min and right edge never passes +2 min", () => {
    const msPerPx = 50; // 1000 px * 50 = 50 s visible (15 s left, 35 s right)
    const bounds = timeOffsetBounds(1000, 0.3, msPerPx);
    // Left edge at minOffset: (now + minOffset) - 15_000 = now - 300_000
    expect(bounds.minOffsetMs).toBeCloseTo(-HISTORY_LIMIT_MS + 15_000, 6);
    // Right edge at maxOffset: (now + maxOffset) + 35_000 = now + 120_000
    expect(bounds.maxOffsetMs).toBeCloseTo(FUTURE_LIMIT_MS - 35_000, 6);

    // At full 7-minute zoom-out, min and max collapse onto the exact centered window
    const full = timeOffsetBounds(1000, 0.3, 420);
    expect(full.minOffsetMs).toBeCloseTo(full.maxOffsetMs, 6);
    const leftEdge = full.minOffsetMs - 1000 * 0.3 * 420;
    const rightEdge = full.maxOffsetMs + 1000 * 0.7 * 420;
    expect(leftEdge).toBeCloseTo(-HISTORY_LIMIT_MS, 6);
    expect(rightEdge).toBeCloseTo(FUTURE_LIMIT_MS, 6);
  });

  it("computes bounded vertical price limits covering history and live price", () => {
    const b = priceBounds(155, 0.03, 0.6, 154.2, 155.9);
    expect(b.minPrice).toBeLessThan(154.2);
    expect(b.maxPrice).toBeGreaterThan(155.9);
    expect(b.minPrice).toBeGreaterThanOrEqual(0);
  });

  it("applies monotonic, bounded hyperbolic rubber-band edge resistance", () => {
    const limit = 100;
    expect(rubberBand(0, limit)).toBe(0);
    const r10 = rubberBand(10, limit);
    const r50 = rubberBand(50, limit);
    const r500 = rubberBand(500, limit);
    const rNeg = rubberBand(-50, limit);

    expect(r10).toBeGreaterThan(0);
    expect(r10).toBeLessThan(10);
    expect(r50).toBeGreaterThan(r10);
    expect(r500).toBeGreaterThan(r50);
    expect(r500).toBeLessThan(limit);
    expect(rNeg).toBeCloseTo(-r50, 9);

    expect(applyEdgeResistance(5, 0, 10, limit)).toBe(5);
    expect(applyEdgeResistance(20, 0, 10, limit)).toBeGreaterThan(10);
    expect(applyEdgeResistance(20, 0, 10, limit)).toBeLessThan(20);
  });

  it("starts in live follow mode and preserves default 35 s viewport", () => {
    const cam = new BoardCamera();
    const { viewport, isLive, isZoomed } = cam.step(0, 16, 10_000, 155, desktopMetrics, false);
    expect(isLive).toBe(true);
    expect(isZoomed).toBe(false);
    expect(timeToX(viewport, 10_000)).toBeCloseTo(300, 6);
    expect(timeToX(viewport, 45_000)).toBeCloseTo(1000, 6);
    expect(priceToY(viewport, 155)).toBeCloseTo(300, 6);
  });

  it("pauses auto-follow on drag, pans accurately, and resists edges beyond 5 min / 2 min", () => {
    const cam = new BoardCamera();
    cam.step(0, 16, 400_000, 155, desktopMetrics, false);

    cam.beginDrag(400_000, 155);
    // Drag finger right by 200 px -> view shifts 10 s into the past
    cam.dragBy(200, 0, desktopMetrics, 400_000, 155);
    const panned = cam.step(16, 16, 400_000, 155, desktopMetrics, false);
    expect(panned.isLive).toBe(false);
    expect(timeToX(panned.viewport, 400_000)).toBeCloseTo(500, 3);

    // Drag way past 5 minutes back (e.g. +20_000 px) -> rubber-banded near limit
    cam.dragBy(20_000, 0, desktopMetrics, 400_000, 155);
    const over = cam.step(32, 16, 400_000, 155, desktopMetrics, false);
    const leftTs = xToTime(over.viewport, 0);
    // Should be slightly past -300_000 due to rubber-banding, but bounded (not -1_000_000)
    expect(leftTs).toBeLessThan(400_000 - HISTORY_LIMIT_MS);
    expect(leftTs).toBeGreaterThan(400_000 - HISTORY_LIMIT_MS - 20_000);

    // Release with reducedMotion snaps cleanly back to the exact -5 min clamp
    cam.endDrag(0, 0, desktopMetrics, 400_000, 155, true);
    const clamped = cam.step(48, 16, 400_000, 155, desktopMetrics, true);
    expect(xToTime(clamped.viewport, 0)).toBeCloseTo(400_000 - HISTORY_LIMIT_MS, 2);
  });

  it("coasts with momentum after fling and springs back from edge resistance", () => {
    const cam = new BoardCamera();
    cam.step(0, 16, 400_000, 155, desktopMetrics, false);
    cam.beginDrag(400_000, 155);
    cam.dragBy(100, 0, desktopMetrics, 400_000, 155);
    const atRelease = cam.step(16, 16, 400_000, 155, desktopMetrics, false);
    const xAtRelease = timeToX(atRelease.viewport, 400_000);

    // Fling right at 1.2 px/ms
    cam.endDrag(1.2, 0, desktopMetrics, 400_000, 155, false);
    let state = cam.step(32, 16, 400_000, 155, desktopMetrics, false);
    expect(state.moving).toBe(true);
    expect(timeToX(state.viewport, 400_000)).toBeGreaterThan(xAtRelease);

    // Advance 2.5 seconds -> momentum decays to rest
    for (let t = 48; t <= 2500; t += 16) {
      state = cam.step(t, 16, 400_000, 155, desktopMetrics, false);
    }
    expect(state.moving).toBe(false);
  });

  it("anchors cursor world coordinate when zooming while panned away, and keeps live follow when zooming in live mode", () => {
    const cam = new BoardCamera();
    const initial = cam.step(0, 16, 400_000, 155, desktopMetrics, false);

    // Zooming in live mode keeps auto-follow active
    cam.zoomAt(0.5, 0.5, 600, 200, desktopMetrics, 400_000, 155);
    const zoomedLive = cam.step(16, 16, 400_000, 155, desktopMetrics, false);
    expect(zoomedLive.isLive).toBe(true);
    expect(zoomedLive.isZoomed).toBe(true);
    expect(zoomedLive.viewport.msPerPx).toBeCloseTo(initial.viewport.msPerPx * 2, 4);
    expect(zoomedLive.viewport.pricePerPx).toBeCloseTo(initial.viewport.pricePerPx * 2, 4);

    // Pan away, then zoom at cursor (650, 180) -> world (ts, price) under cursor stays fixed
    cam.beginDrag(400_000, 155);
    cam.dragBy(120, 40, desktopMetrics, 400_000, 155);
    cam.endDrag(0, 0, desktopMetrics, 400_000, 155, true);
    const before = cam.step(32, 16, 400_000, 155, desktopMetrics, true);
    const tsUnderCursor = xToTime(before.viewport, 650);
    const priceUnderCursor = yToPrice(before.viewport, 180);

    cam.zoomAt(1.5, 1.5, 650, 180, desktopMetrics, 400_000, 155);
    const after = cam.step(48, 16, 400_000, 155, desktopMetrics, true);
    expect(xToTime(after.viewport, 650)).toBeCloseTo(tsUnderCursor, 1);
    expect(yToPrice(after.viewport, 180)).toBeCloseTo(priceUnderCursor, 5);
  });

  it("snapToLive smoothly returns to auto-follow and default zoom", () => {
    const cam = new BoardCamera();
    cam.step(0, 16, 400_000, 155, desktopMetrics, false);
    cam.beginDrag(400_000, 155);
    cam.dragBy(300, -80, desktopMetrics, 400_000, 155);
    cam.endDrag(0, 0, desktopMetrics, 400_000, 155, true);
    cam.zoomAt(0.5, 0.6, 500, 300, desktopMetrics, 400_000, 155);

    cam.snapToLive(100, 400_000, 155, false);
    const mid = cam.step(200, 100, 400_100, 155, desktopMetrics, false);
    expect(mid.isLive).toBe(true);
    expect(mid.moving).toBe(true);

    const done = cam.step(500, 300, 400_400, 155, desktopMetrics, false);
    expect(done.isLive).toBe(true);
    expect(done.isZoomed).toBe(false);
    expect(done.moving).toBe(false);
    expect(timeToX(done.viewport, 400_400)).toBeCloseTo(300, 4);
    expect(priceToY(done.viewport, 155)).toBeCloseTo(300, 4);
  });

  it("respects rightGutter and defaultAheadMs so 375 px phone shows 32 s history and 32 s future before the gutter", () => {
    const cam = new BoardCamera();
    const phoneWithGutter: CameraMetrics = {
      width: 375,
      height: 500,
      nowFraction: 0.5,
      visibleRows: 13,
      priceStep: 0.03,
      defaultAheadMs: 32_000,
      rightGutter: 50,
    };
    const { viewport } = cam.step(0, 16, 400_000, 155, phoneWithGutter, false);
    expect(viewport.rightGutter).toBe(50);
    expect(timeToX(viewport, 400_000)).toBeCloseTo(162.5, 4);
    expect(timeToX(viewport, 400_000 - 32_000)).toBeCloseTo(0, 4);
    expect(timeToX(viewport, 400_000 + 32_000)).toBeCloseTo(325, 4);
  });
});

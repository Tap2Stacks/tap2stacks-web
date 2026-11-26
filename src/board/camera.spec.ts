import { describe, expect, it } from "vitest";
import {
  applyEdgeResistance,
  AUTO_RETURN_MS,
  baseScaleFor,
  BoardCamera,
  clampZoom,
  FUTURE_LIMIT_MS,
  HISTORY_LIMIT_MS,
  MAX_CELL_ZOOM,
  MAX_PRICED_CELLS_IN_VIEW,
  MIN_CELL_PX,
  minCellPx,
  priceBounds,
  rubberBand,
  SNAP_DURATION_MS,
  timeOffsetBounds,
  type CameraMetrics,
} from "./camera";
import { priceToY, timeToX, xToTime, yToPrice } from "./layout";

// A 100 px default box keeps 50 ms per px, so the pan and edge tests read as before.
const desktopMetrics: CameraMetrics = {
  width: 1000,
  height: 600,
  nowFraction: 0.3,
  priceStep: 0.03,
  cellPx: 100,
  quotedRows: 20,
  quotedCols: 6,
  // 20 quoted rows of 0.03 around 155, as the runtime passes them
  minSeriesPrice: 154.7,
  maxSeriesPrice: 155.3,
};

// The real desktop layout: 1280x720, gutters 58/20, NOW at 38%, 84 px boxes, 20 rows x 6 columns quoted.
const liveDesktop: CameraMetrics = {
  width: 1280,
  height: 720,
  nowFraction: 0.38,
  priceStep: 0.03,
  cellPx: 84,
  quotedRows: 20,
  quotedCols: 6,
  rightGutter: 58,
  bottomGutter: 20,
};

const smallPhone: CameraMetrics = {
  width: 375,
  height: 500,
  nowFraction: 0.22,
  priceStep: 0.03,
  cellPx: 60,
  quotedRows: 20,
  quotedCols: 6,
  rightGutter: 50,
  bottomGutter: 20,
};

function boxSide(v: { msPerPx: number }): number {
  return 5000 / v.msPerPx;
}

describe("camera zoom, pan transforms and clamps", () => {
  it("keeps boxes square at the default size", () => {
    const cam = new BoardCamera();
    const { viewport } = cam.step(0, 16, 10_000, 155, liveDesktop, false);
    expect(viewport.msPerPx * 84).toBeCloseTo(5000, 6);
    expect(viewport.pricePerPx * 84).toBeCloseTo(0.03, 9);
  });

  it("keeps boxes square after zooming, for any price step", () => {
    for (const priceStep of [0.01, 0.03, 0.05]) {
      const m = { ...liveDesktop, priceStep };
      const cam = new BoardCamera();
      for (const f of [0.6, 1.7]) {
        cam.zoomAt(f, 600, 300, m, 10_000, 155);
        const { viewport } = cam.step(0, 16, 10_000, 155, m, false);
        expect(boxSide(viewport)).toBeCloseTo(priceStep / viewport.pricePerPx, 6);
      }
    }
  });

  it("stops zooming in at twice the default box", () => {
    const cam = new BoardCamera();
    for (let i = 0; i < 12; i++) cam.zoomAt(1.35, 600, 300, liveDesktop, 10_000, 155);
    const { viewport } = cam.step(0, 16, 10_000, 155, liveDesktop, false);
    expect(boxSide(viewport)).toBeCloseTo(84 * MAX_CELL_ZOOM, 6);
  });

  it("stops zooming out when every priced box fits, at about 300 boxes, and never below 28 px", () => {
    expect(minCellPx(liveDesktop)).toBeCloseTo(35, 6);
    expect(minCellPx({ ...liveDesktop, quotedCols: 10 })).toBeCloseTo(35, 6);
    const wide = { ...liveDesktop, quotedCols: 24 };
    const s = minCellPx(wide);
    expect(s).toBeCloseTo(42.0, 0); // sqrt(700 x 757.6 / 300): about 300 of the 480 boxes in view
    const inView = Math.min(20, 700 / s) * Math.min(24, (1222 * 0.62) / s);
    expect(inView).toBeLessThanOrEqual(300.001);
    expect(minCellPx(smallPhone)).toBe(MIN_CELL_PX);
    expect(minCellPx({ ...liveDesktop, quotedRows: 0 })).toBe(MIN_CELL_PX);
    expect(minCellPx({ ...liveDesktop, quotedCols: 0 })).toBe(MIN_CELL_PX);

    const cam = new BoardCamera();
    for (let i = 0; i < 20; i++) cam.zoomAt(0.75, 600, 300, liveDesktop, 10_000, 155);
    const { viewport } = cam.step(0, 16, 10_000, 155, liveDesktop, false);
    expect(boxSide(viewport)).toBeCloseTo(35, 6);
  });

  it("re-clamps the zoom when the layout or the quoted grid changes", () => {
    const cam = new BoardCamera();
    for (let i = 0; i < 20; i++) cam.zoomAt(0.75, 600, 300, liveDesktop, 10_000, 155);
    const taller = { ...liveDesktop, height: 1400 };
    const afterResize = cam.step(16, 16, 10_000, 155, taller, false);
    expect(boxSide(afterResize.viewport)).toBeCloseTo(minCellPx(taller), 6);
    const moreCols = { ...liveDesktop, quotedCols: 24 };
    const afterQuotes = cam.step(32, 16, 10_000, 155, moreCols, false);
    expect(boxSide(afterQuotes.viewport)).toBeGreaterThanOrEqual(minCellPx(moreCols) - 1e-6);
  });

  it("does not zoom in by itself when the zoom-out limit tightens and then relaxes", () => {
    const cam = new BoardCamera();
    for (let i = 0; i < 20; i++) cam.zoomAt(0.75, 600, 300, liveDesktop, 10_000, 155);
    const tight = { ...liveDesktop, quotedCols: 24 };
    expect(boxSide(cam.step(16, 16, 10_000, 155, tight, false).viewport)).toBeCloseTo(minCellPx(tight), 6);
    expect(boxSide(cam.step(32, 16, 10_000, 155, liveDesktop, false).viewport)).toBeCloseTo(35, 6);
  });

  it("keeps vertical panning within the quoted rows plus one row", () => {
    const span = 0.24; // about 8 rows of 0.03 in view
    const b = priceBounds(155, 0.03, span, 154.7, 155.3);
    expect(b.maxPrice).toBeCloseTo(155.3 - span / 2 + 0.03, 9);
    expect(b.minPrice).toBeCloseTo(154.7 + span / 2 - 0.03, 9);
    const wide = priceBounds(155, 0.03, 2, 154.9, 155.1);
    expect(wide.minPrice).toBeCloseTo(wide.maxPrice, 9);
  });

  it("zooms out far enough to show all 300 boxes of a 15-column grid", () => {
    expect(MAX_PRICED_CELLS_IN_VIEW).toBe(300);
    const grid15 = { ...liveDesktop, quotedCols: 15 };
    const s = minCellPx(grid15);
    // At 35 px all 20 rows fill the 700 px plot and the 15 columns (525 px) fit in the 757.6 px future
    expect(s).toBeCloseTo(35, 6);
    expect(Math.min(20, 700 / s) * Math.min(15, 757.64 / s)).toBeCloseTo(300, 6);
  });

  it("clamps one zoom value within its bounds", () => {
    expect(clampZoom(0.01, 0.4)).toBe(0.4);
    expect(clampZoom(99, 0.4)).toBe(MAX_CELL_ZOOM);
    expect(clampZoom(Number.NaN, 0.4)).toBe(1);
    expect(clampZoom(Number.POSITIVE_INFINITY, 0.4)).toBe(1);
    expect(baseScaleFor(smallPhone).minZoom).toBeCloseTo(MIN_CELL_PX / 60, 9);
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

  it("keeps the price bounds inside the history and live price range and never negative", () => {
    const b = priceBounds(155, 0.03, 0.6, 154.2, 155.9);
    expect(b.minPrice).toBeGreaterThan(154.2);
    expect(b.maxPrice).toBeLessThan(155.9);
    expect(b.minPrice).toBeLessThanOrEqual(b.maxPrice);
    expect(priceBounds(0.01, 0.03, 0.6).minPrice).toBeGreaterThanOrEqual(0);
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

  it("keeps following the live price while zooming from live view", () => {
    const cam = new BoardCamera();
    const initial = cam.step(0, 16, 400_000, 155, desktopMetrics, false);

    cam.zoomAt(0.7, 600, 200, desktopMetrics, 400_000, 155);
    expect(cam.isFollowing).toBe(true);
    expect(cam.isZoomed).toBe(true);
    const zoomed = cam.step(16, 16, 401_000, 155.4, desktopMetrics, false);
    expect(zoomed.isLive).toBe(true);
    expect(zoomed.isZoomed).toBe(true);
    expect(zoomed.viewport.viewNowMs).toBe(401_000);
    expect(zoomed.viewport.centerPrice).toBe(155.4);
    expect(boxSide(zoomed.viewport)).toBeCloseTo(boxSide(initial.viewport) * 0.7, 4);
  });

  it("anchors cursor world coordinate when zooming while panned away", () => {
    const cam = new BoardCamera();
    cam.step(0, 16, 400_000, 155, desktopMetrics, false);

    cam.beginDrag(400_000, 155);
    cam.dragBy(120, 40, desktopMetrics, 400_000, 155);
    cam.endDrag(0, 0, desktopMetrics, 400_000, 155, true);
    const before = cam.step(32, 16, 400_000, 155, desktopMetrics, true);
    const tsUnderCursor = xToTime(before.viewport, 650);
    const priceUnderCursor = yToPrice(before.viewport, 180);

    cam.zoomAt(1.5, 650, 180, desktopMetrics, 400_000, 155);
    const after = cam.step(48, 16, 400_000, 155, desktopMetrics, true);
    expect(xToTime(after.viewport, 650)).toBeCloseTo(tsUnderCursor, 1);
    expect(yToPrice(after.viewport, 180)).toBeCloseTo(priceUnderCursor, 5);
  });

  it("returns to the live price 3 s after a drag, keeping the zoom", () => {
    const cam = new BoardCamera();
    cam.step(0, 16, 400_000, 155, desktopMetrics, false);
    cam.zoomAt(0.7, 600, 300, desktopMetrics, 400_000, 155);
    cam.beginDrag(400_000, 155);
    cam.dragBy(200, 0, desktopMetrics, 400_000, 155);
    cam.endDrag(0, 0, desktopMetrics, 400_000, 155, false);

    // First idle frame marks idle start at perf = 100
    const idleStart = cam.step(100, 16, 400_100, 155, desktopMetrics, false);
    expect(idleStart.isLive).toBe(false);

    const beforeDeadline = cam.step(100 + AUTO_RETURN_MS - 1, 16, 403_099, 155, desktopMetrics, false);
    expect(beforeDeadline.isLive).toBe(false);

    const returning = cam.step(100 + AUTO_RETURN_MS, 1, 403_100, 155.2, desktopMetrics, false);
    expect(returning.isLive).toBe(true);
    expect(returning.moving).toBe(true);

    const settled = cam.step(100 + AUTO_RETURN_MS + SNAP_DURATION_MS, 16, 403_340, 155.2, desktopMetrics, false);
    expect(settled.isLive).toBe(true);
    expect(cam.isFollowing).toBe(true);
    expect(settled.moving).toBe(false);
    expect(settled.isZoomed).toBe(true);
    expect(boxSide(settled.viewport)).toBeCloseTo(0.7 * desktopMetrics.cellPx, 4);
  });

  it("starts the 3 s only after momentum stops", () => {
    const cam = new BoardCamera();
    cam.step(0, 16, 400_000, 155, desktopMetrics, false);
    cam.beginDrag(400_000, 155);
    cam.dragBy(100, 0, desktopMetrics, 400_000, 155);
    cam.endDrag(1.5, 0, desktopMetrics, 400_000, 155, false);

    let t = 16;
    let settledPerf: number | null = null;
    while (t < 10_000) {
      const state = cam.step(t, 16, 400_000 + t, 155, desktopMetrics, false);
      if (!state.moving && settledPerf === null) {
        settledPerf = t;
        break;
      }
      t += 16;
    }
    expect(settledPerf).not.toBeNull();
    // 3000 ms after release (while momentum was still running or just stopped) -> not live yet
    expect(cam.step(3_000, 16, 403_000, 155, desktopMetrics, false).isLive).toBe(false);

    const returning = cam.step(settledPerf! + AUTO_RETURN_MS, 16, 400_000 + settledPerf! + AUTO_RETURN_MS, 155, desktopMetrics, false);
    expect(returning.isLive).toBe(true);
    const done = cam.step(
      settledPerf! + AUTO_RETURN_MS + SNAP_DURATION_MS,
      16,
      400_000 + settledPerf! + AUTO_RETURN_MS + SNAP_DURATION_MS,
      155,
      desktopMetrics,
      false,
    );
    expect(done.isLive).toBe(true);
    expect(done.moving).toBe(false);
  });

  it("a new drag or zoom restarts the 3 s", () => {
    const cam = new BoardCamera();
    cam.step(0, 16, 400_000, 155, desktopMetrics, false);
    cam.beginDrag(400_000, 155);
    cam.dragBy(100, 0, desktopMetrics, 400_000, 155);
    cam.endDrag(0, 0, desktopMetrics, 400_000, 155, false);

    // Idle starts at perf = 0
    expect(cam.step(0, 16, 400_000, 155, desktopMetrics, false).isLive).toBe(false);
    expect(cam.step(2500, 16, 402_500, 155, desktopMetrics, false).isLive).toBe(false);

    // New drag resets the timer
    cam.beginDrag(402_500, 155);
    cam.dragBy(10, 0, desktopMetrics, 402_500, 155);
    cam.endDrag(0, 0, desktopMetrics, 402_500, 155, false);

    // Settle timer at perf = 2500 -> +2500 = 5000 is not live; +3000 = 5500 is returning
    expect(cam.step(2500, 16, 402_500, 155, desktopMetrics, false).isLive).toBe(false);
    expect(cam.step(5000, 16, 405_000, 155, desktopMetrics, false).isLive).toBe(false);
    expect(cam.step(5500, 16, 405_500, 155, desktopMetrics, false).isLive).toBe(true);

    // Also test zoom while panned away restarts the 3 s timer and keeps the new zoom
    const cam2 = new BoardCamera();
    cam2.step(0, 16, 400_000, 155, desktopMetrics, false);
    cam2.beginDrag(400_000, 155);
    cam2.dragBy(100, 0, desktopMetrics, 400_000, 155);
    cam2.endDrag(0, 0, desktopMetrics, 400_000, 155, false);
    expect(cam2.step(0, 16, 400_000, 155, desktopMetrics, false).isLive).toBe(false);
    expect(cam2.step(2500, 16, 402_500, 155, desktopMetrics, false).isLive).toBe(false);
    cam2.zoomAt(0.8, 500, 300, desktopMetrics, 402_500, 155);
    expect(cam2.step(2500, 16, 402_500, 155, desktopMetrics, false).isLive).toBe(false);
    expect(cam2.step(5499, 16, 405_499, 155, desktopMetrics, false).isLive).toBe(false);
    const returning2 = cam2.step(5500, 1, 405_500, 155, desktopMetrics, false);
    expect(returning2.isLive).toBe(true);
    const done2 = cam2.step(5500 + SNAP_DURATION_MS, 16, 405_500 + SNAP_DURATION_MS, 155, desktopMetrics, false);
    expect(boxSide(done2.viewport)).toBeCloseTo(0.8 * desktopMetrics.cellPx, 4);
  });

  it("reduced motion returns at once after 3 s", () => {
    const cam = new BoardCamera();
    cam.step(0, 16, 400_000, 155, desktopMetrics, true);
    cam.zoomAt(0.75, 500, 300, desktopMetrics, 400_000, 155);
    cam.beginDrag(400_000, 155);
    cam.dragBy(150, 20, desktopMetrics, 400_000, 155);
    cam.endDrag(0, 0, desktopMetrics, 400_000, 155, true);

    expect(cam.step(100, 16, 400_100, 155, desktopMetrics, true).isLive).toBe(false);
    expect(cam.step(3099, 16, 403_099, 155, desktopMetrics, true).isLive).toBe(false);

    const jumped = cam.step(3100, 16, 403_100, 155.3, desktopMetrics, true);
    expect(jumped.isLive).toBe(true);
    expect(jumped.moving).toBe(false);
    expect(cam.isFollowing).toBe(true);
    expect(jumped.viewport.viewNowMs).toBe(403_100);
    expect(jumped.viewport.centerPrice).toBe(155.3);
    expect(boxSide(jumped.viewport)).toBeCloseTo(0.75 * desktopMetrics.cellPx, 4);
  });

  it("snapToLive smoothly returns to auto-follow and default zoom", () => {
    const cam = new BoardCamera();
    cam.step(0, 16, 400_000, 155, desktopMetrics, false);
    cam.beginDrag(400_000, 155);
    cam.dragBy(300, -80, desktopMetrics, 400_000, 155);
    cam.endDrag(0, 0, desktopMetrics, 400_000, 155, true);
    cam.zoomAt(0.5, 500, 300, desktopMetrics, 400_000, 155);

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

  it("places NOW at 22% of a 375 px phone plot with 60 px boxes before the gutter", () => {
    const cam = new BoardCamera();
    const { viewport } = cam.step(0, 16, 400_000, 155, smallPhone, false);
    expect(viewport.rightGutter).toBe(50);
    expect(timeToX(viewport, 400_000)).toBeCloseTo(325 * 0.22, 4);
    expect(timeToX(viewport, 400_000 + 5_000) - timeToX(viewport, 400_000)).toBeCloseTo(60, 4);
  });
});

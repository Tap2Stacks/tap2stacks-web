import type { BoardViewport } from "./layout";

export const HISTORY_LIMIT_MS = 5 * 60 * 1000; // 5 minutes back
export const FUTURE_LIMIT_MS = 2 * 60 * 1000; // 2 minutes ahead
/** One board column is one 5-second window; a box is one window wide and one price step tall. */
export const WINDOW_MS = 5_000;
/** Zooming in stops at twice the default box side. */
export const MAX_CELL_ZOOM = 2;
/** Zooming out never makes a box smaller than this, so multipliers stay readable. */
export const MIN_CELL_PX = 28;
/** Zooming out stops once about this many priced boxes are in view. */
export const MAX_PRICED_CELLS_IN_VIEW = 200;

const RUBBER_BAND_COEFF = 0.55;
const RUBBER_BAND_FRACTION = 0.25;
const MOMENTUM_TAU_MS = 325;
const SPRING_TAU_MS = 105;
const SNAP_DURATION_MS = 240;
const STOP_SPEED_PX_PER_MS = 0.015;
const MAX_FLING_PX_PER_MS = 4.0;
const ZOOM_EPS = 0.015;

export interface CameraMetrics {
  width: number;
  height: number;
  nowFraction: number;
  priceStep: number;
  /** Default box side in px (square: one window wide, one price step tall). */
  cellPx: number;
  /** Price rows and future columns the engine currently quotes; 0 when nothing is quoted yet. */
  quotedRows: number;
  quotedCols: number;
  rightGutter?: number;
  bottomGutter?: number;
  minSeriesPrice?: number;
  maxSeriesPrice?: number;
}

export interface CameraStepResult {
  viewport: BoardViewport;
  moving: boolean;
  isLive: boolean;
  isZoomed: boolean;
}

function effectivePlotWidth(metrics: Pick<CameraMetrics, "width" | "rightGutter">): number {
  return Math.max(1, metrics.width - (metrics.rightGutter ?? 0));
}

function effectivePlotHeight(metrics: Pick<CameraMetrics, "height" | "bottomGutter">): number {
  return Math.max(1, metrics.height - (metrics.bottomGutter ?? 0));
}

/**
 * Smallest box side zooming out may reach: every priced box fits, or about
 * MAX_PRICED_CELLS_IN_VIEW priced boxes are in view, whichever is larger, and
 * never below MIN_CELL_PX.
 */
export function minCellPx(metrics: CameraMetrics): number {
  const rows = metrics.quotedRows;
  const cols = metrics.quotedCols;
  if (!(rows > 0) || !(cols > 0)) return MIN_CELL_PX;
  const plotH = effectivePlotHeight(metrics);
  const futureW = effectivePlotWidth(metrics) * Math.max(0.1, 1 - metrics.nowFraction);
  const fitAll = Math.min(plotH / rows, futureW / cols);
  const inView = (side: number) => Math.min(rows, plotH / side) * Math.min(cols, futureW / side);
  // inView falls as the side grows: find the smallest side with at most the cap in view.
  let lo = 1;
  let hi = Math.max(plotH, futureW);
  if (inView(lo) > MAX_PRICED_CELLS_IN_VIEW) {
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (inView(mid) > MAX_PRICED_CELLS_IN_VIEW) lo = mid;
      else hi = mid;
    }
  } else {
    hi = lo;
  }
  return Math.max(fitAll, hi, MIN_CELL_PX);
}

export function baseScaleFor(metrics: CameraMetrics): {
  baseMsPerPx: number;
  basePricePerPx: number;
  minZoom: number;
} {
  const cell = Number.isFinite(metrics.cellPx) && metrics.cellPx > 0 ? metrics.cellPx : 84;
  const step = Number.isFinite(metrics.priceStep) && metrics.priceStep > 0 ? metrics.priceStep : 0.03;
  return {
    baseMsPerPx: WINDOW_MS / cell,
    basePricePerPx: step / cell,
    minZoom: Math.min(1, minCellPx(metrics) / cell),
  };
}

/** One zoom for both axes, so boxes stay square. */
export function clampZoom(zoom: number, minZoom: number): number {
  const safe = Number.isFinite(zoom) ? zoom : 1;
  return Math.max(minZoom, Math.min(MAX_CELL_ZOOM, safe));
}

/**
 * Valid range for (viewNowMs - nowMs) so the visible window stays inside
 * [nowMs - HISTORY_LIMIT_MS, nowMs + FUTURE_LIMIT_MS].
 */
export function timeOffsetBounds(
  width: number,
  nowFraction: number,
  msPerPx: number,
): { minOffsetMs: number; maxOffsetMs: number } {
  const leftSpan = width * nowFraction * msPerPx;
  const rightSpan = width * (1 - nowFraction) * msPerPx;
  const minOffsetMs = -HISTORY_LIMIT_MS + leftSpan;
  const maxOffsetMs = FUTURE_LIMIT_MS - rightSpan;
  if (minOffsetMs > maxOffsetMs) {
    const mid = (minOffsetMs + maxOffsetMs) / 2;
    return { minOffsetMs: mid, maxOffsetMs: mid };
  }
  return { minOffsetMs, maxOffsetMs };
}

/**
 * Range for the view's centre price when panned: the view stays within the
 * history, live price and quoted rows (passed as min/max series price), plus
 * one row. When the data is shorter than the view, the centre is fixed midway.
 */
export function priceBounds(
  livePrice: number,
  priceStep: number,
  visiblePriceSpan: number,
  minSeriesPrice?: number,
  maxSeriesPrice?: number,
): { minPrice: number; maxPrice: number } {
  const step = Number.isFinite(priceStep) && priceStep > 0 ? priceStep : 0.03;
  const anchor = Number.isFinite(livePrice) && livePrice > 0 ? livePrice : 0;
  const lowRef =
    minSeriesPrice !== undefined && Number.isFinite(minSeriesPrice) && minSeriesPrice > 0
      ? Math.min(anchor > 0 ? anchor : minSeriesPrice, minSeriesPrice)
      : anchor;
  const highRef =
    maxSeriesPrice !== undefined && Number.isFinite(maxSeriesPrice) && maxSeriesPrice > 0
      ? Math.max(anchor, maxSeriesPrice)
      : anchor;
  const half = Number.isFinite(visiblePriceSpan) && visiblePriceSpan > 0 ? visiblePriceSpan / 2 : 0;
  let minPrice = Math.max(0, lowRef + half - step);
  let maxPrice = highRef - half + step;
  if (minPrice > maxPrice) {
    const mid = Math.max(0, (lowRef + highRef) / 2);
    minPrice = mid;
    maxPrice = mid;
  }
  return { minPrice, maxPrice };
}

/** iOS-style hyperbolic rubber-band resistance: smooth, odd, strictly bounded by |limit|. */
export function rubberBand(overshoot: number, limit: number): number {
  if (overshoot === 0 || limit <= 0 || !Number.isFinite(overshoot)) return 0;
  return (overshoot * RUBBER_BAND_COEFF * limit) / (limit + RUBBER_BAND_COEFF * Math.abs(overshoot));
}

export function applyEdgeResistance(
  value: number,
  min: number,
  max: number,
  limit: number,
): number {
  if (value < min) return min + rubberBand(value - min, limit);
  if (value > max) return max + rubberBand(value - max, limit);
  return value;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

interface SnapAnimation {
  startPerf: number;
  fromTimeOffsetMs: number;
  fromPriceOffset: number;
  fromZoom: number;
}

export class BoardCamera {
  private following = true;
  private zoom = 1;
  /** World timestamp anchored at `width * nowFraction` when not following. */
  private rawViewNowMs: number | null = null;
  /** World price anchored at `height / 2` when not following. */
  private rawCenterPrice: number | null = null;
  /** Velocity in screen px/ms (positive = content moving right/down). */
  private vxPxPerMs = 0;
  private vyPxPerMs = 0;
  private dragging = false;
  private snapAnim: SnapAnimation | null = null;

  get isFollowing(): boolean {
    return this.following;
  }

  get isZoomed(): boolean {
    return (
      Math.abs(this.zoom - 1) > ZOOM_EPS
    );
  }

  reset(): void {
    this.following = true;
    this.zoom = 1;
    this.rawViewNowMs = null;
    this.rawCenterPrice = null;
    this.vxPxPerMs = 0;
    this.vyPxPerMs = 0;
    this.dragging = false;
    this.snapAnim = null;
  }

  beginDrag(nowMs: number, liveCenterPrice: number): void {
    this.snapAnim = null;
    this.vxPxPerMs = 0;
    this.vyPxPerMs = 0;
    if (this.following || this.rawViewNowMs === null || this.rawCenterPrice === null) {
      this.rawViewNowMs = nowMs;
      this.rawCenterPrice = liveCenterPrice;
    }
    this.dragging = true;
  }

  dragBy(
    dxPx: number,
    dyPx: number,
    metrics: CameraMetrics,
    nowMs: number,
    liveCenterPrice: number,
  ): void {
    if (!Number.isFinite(dxPx) || !Number.isFinite(dyPx)) return;
    if (dxPx === 0 && dyPx === 0) return;
    if (this.rawViewNowMs === null || this.rawCenterPrice === null) {
      this.beginDrag(nowMs, liveCenterPrice);
    }
    this.following = false;
    this.snapAnim = null;

    const { baseMsPerPx, basePricePerPx, minZoom } = baseScaleFor(metrics);
    const z = clampZoom(this.zoom, minZoom);
    const msPerPx = baseMsPerPx / z;
    const pricePerPx = basePricePerPx / z;

    // Dragging finger right (+dx) moves content right -> shifts view earlier in time (-dt)
    this.rawViewNowMs = (this.rawViewNowMs ?? nowMs) - dxPx * msPerPx;
    // Dragging finger down (+dy) moves content down -> shifts view to higher prices (+dp)
    this.rawCenterPrice = (this.rawCenterPrice ?? liveCenterPrice) + dyPx * pricePerPx;
  }

  endDrag(
    vxPxPerMs: number,
    vyPxPerMs: number,
    metrics: CameraMetrics,
    nowMs: number,
    liveCenterPrice: number,
    reducedMotion: boolean,
  ): void {
    this.dragging = false;
    if (this.following || this.rawViewNowMs === null || this.rawCenterPrice === null) {
      return;
    }

    const { baseMsPerPx, basePricePerPx, minZoom } = baseScaleFor(metrics);
    const z = clampZoom(this.zoom, minZoom);
    const msPerPx = baseMsPerPx / z;
    const pricePerPx = basePricePerPx / z;

    const plotW = effectivePlotWidth(metrics);
    const tBounds = timeOffsetBounds(plotW, metrics.nowFraction, msPerPx);
    const pBounds = priceBounds(
      liveCenterPrice,
      metrics.priceStep,
      pricePerPx * metrics.height,
      metrics.minSeriesPrice,
      metrics.maxSeriesPrice,
    );

    // Re-sync raw positions to their visually resisted positions so spring-back starts smoothly
    const timeLimit = plotW * RUBBER_BAND_FRACTION * msPerPx;
    const priceLimit = metrics.height * RUBBER_BAND_FRACTION * pricePerPx;
    const resistedOffset = applyEdgeResistance(
      this.rawViewNowMs - nowMs,
      tBounds.minOffsetMs,
      tBounds.maxOffsetMs,
      timeLimit,
    );
    const resistedPrice = applyEdgeResistance(
      this.rawCenterPrice,
      pBounds.minPrice,
      pBounds.maxPrice,
      priceLimit,
    );

    if (reducedMotion) {
      this.rawViewNowMs = nowMs + clamp(resistedOffset, tBounds.minOffsetMs, tBounds.maxOffsetMs);
      this.rawCenterPrice = clamp(resistedPrice, pBounds.minPrice, pBounds.maxPrice);
      this.vxPxPerMs = 0;
      this.vyPxPerMs = 0;
      return;
    }

    this.rawViewNowMs = nowMs + resistedOffset;
    this.rawCenterPrice = resistedPrice;
    this.vxPxPerMs = clamp(Number.isFinite(vxPxPerMs) ? vxPxPerMs : 0, -MAX_FLING_PX_PER_MS, MAX_FLING_PX_PER_MS);
    this.vyPxPerMs = clamp(Number.isFinite(vyPxPerMs) ? vyPxPerMs : 0, -MAX_FLING_PX_PER_MS, MAX_FLING_PX_PER_MS);
  }

  panByPx(
    dxPx: number,
    dyPx: number,
    metrics: CameraMetrics,
    nowMs: number,
    liveCenterPrice: number,
  ): void {
    if (!Number.isFinite(dxPx) || !Number.isFinite(dyPx) || (dxPx === 0 && dyPx === 0)) return;
    if (this.following || this.rawViewNowMs === null || this.rawCenterPrice === null) {
      this.rawViewNowMs = nowMs;
      this.rawCenterPrice = liveCenterPrice;
    }
    this.following = false;
    this.snapAnim = null;
    this.vxPxPerMs = 0;
    this.vyPxPerMs = 0;

    const { baseMsPerPx, basePricePerPx, minZoom } = baseScaleFor(metrics);
    const z = clampZoom(this.zoom, minZoom);
    const msPerPx = baseMsPerPx / z;
    const pricePerPx = basePricePerPx / z;

    const plotW = effectivePlotWidth(metrics);
    const tBounds = timeOffsetBounds(plotW, metrics.nowFraction, msPerPx);
    const pBounds = priceBounds(
      liveCenterPrice,
      metrics.priceStep,
      pricePerPx * metrics.height,
      metrics.minSeriesPrice,
      metrics.maxSeriesPrice,
    );

    const nextOffset = clamp(this.rawViewNowMs - dxPx * msPerPx - nowMs, tBounds.minOffsetMs, tBounds.maxOffsetMs);
    this.rawViewNowMs = nowMs + nextOffset;
    this.rawCenterPrice = clamp(this.rawCenterPrice + dyPx * pricePerPx, pBounds.minPrice, pBounds.maxPrice);
  }

  zoomAt(
    factor: number,
    anchorX: number,
    anchorY: number,
    metrics: CameraMetrics,
    nowMs: number,
    liveCenterPrice: number,
  ): void {
    const safeF = Number.isFinite(factor) && factor > 0 ? factor : 1;
    if (safeF === 1) return;

    this.snapAnim = null;
    const { baseMsPerPx, basePricePerPx, minZoom } = baseScaleFor(metrics);
    const prevZ = clampZoom(this.zoom, minZoom);
    const nextZ = clampZoom(prevZ * safeF, minZoom);

    const prevMsPerPx = baseMsPerPx / prevZ;
    const nextMsPerPx = baseMsPerPx / nextZ;
    const prevPricePerPx = basePricePerPx / prevZ;
    const nextPricePerPx = basePricePerPx / nextZ;

    this.zoom = nextZ;

    // Zooming pauses tracking: start from the live view, then hold still where the player zoomed.
    // The return-to-default button (snapToLive) resumes tracking at the default box size.
    if (this.following || this.rawViewNowMs === null || this.rawCenterPrice === null) {
      this.rawViewNowMs = nowMs;
      this.rawCenterPrice = liveCenterPrice;
      this.following = false;
      this.vxPxPerMs = 0;
      this.vyPxPerMs = 0;
    }

    // Keep the world (ts, price) directly under (anchorX, anchorY) stationary
    const plotW = effectivePlotWidth(metrics);
    const dxFromNow = anchorX - plotW * metrics.nowFraction;
    const anchorTs = this.rawViewNowMs + dxFromNow * prevMsPerPx;
    const nextViewNowMs = anchorTs - dxFromNow * nextMsPerPx;

    const dyFromMid = anchorY - effectivePlotHeight(metrics) / 2;
    const anchorPrice = this.rawCenterPrice - dyFromMid * prevPricePerPx;
    const nextCenterPrice = anchorPrice + dyFromMid * nextPricePerPx;

    const tBounds = timeOffsetBounds(plotW, metrics.nowFraction, nextMsPerPx);
    const pBounds = priceBounds(
      liveCenterPrice,
      metrics.priceStep,
      nextPricePerPx * metrics.height,
      metrics.minSeriesPrice,
      metrics.maxSeriesPrice,
    );

    this.rawViewNowMs = nowMs + clamp(nextViewNowMs - nowMs, tBounds.minOffsetMs, tBounds.maxOffsetMs);
    this.rawCenterPrice = clamp(nextCenterPrice, pBounds.minPrice, pBounds.maxPrice);
  }

  snapToLive(
    perfMs: number,
    nowMs: number,
    liveCenterPrice: number,
    reducedMotion: boolean,
  ): void {
    this.vxPxPerMs = 0;
    this.vyPxPerMs = 0;
    this.dragging = false;

    const fromTimeOffsetMs = this.following || this.rawViewNowMs === null ? 0 : this.rawViewNowMs - nowMs;
    const fromPriceOffset = this.following || this.rawCenterPrice === null ? 0 : this.rawCenterPrice - liveCenterPrice;
    const fromZoom = this.zoom;

    this.following = true;
    this.rawViewNowMs = null;
    this.rawCenterPrice = null;

    if (
      reducedMotion ||
      (Math.abs(fromTimeOffsetMs) < 1 &&
        Math.abs(fromPriceOffset) < 1e-6 &&
        Math.abs(fromZoom - 1) < 1e-4)
    ) {
      this.zoom = 1;
      this.snapAnim = null;
      return;
    }

    this.snapAnim = {
      startPerf: perfMs,
      fromTimeOffsetMs,
      fromPriceOffset,
      fromZoom,
    };
  }

  step(
    perfMs: number,
    dtMs: number,
    nowMs: number,
    liveCenterPrice: number,
    metrics: CameraMetrics,
    reducedMotion: boolean,
  ): CameraStepResult {
    const dt = Math.max(0, Math.min(100, dtMs));
    const plotW = effectivePlotWidth(metrics);
    const plotH = effectivePlotHeight(metrics);
    const rightGutter = metrics.rightGutter ?? 0;
    const bottomGutter = metrics.bottomGutter ?? 0;
    const { baseMsPerPx, basePricePerPx, minZoom } = baseScaleFor(metrics);
    let moving = false;

    // 1. Handle active snap-to-live animation
    if (this.snapAnim) {
      const progress = reducedMotion
        ? 1
        : clamp((perfMs - this.snapAnim.startPerf) / SNAP_DURATION_MS, 0, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const inv = 1 - ease;

      this.zoom = 1 + (this.snapAnim.fromZoom - 1) * inv;

      const z = clampZoom(this.zoom, minZoom);
      const msPerPx = baseMsPerPx / z;
      const pricePerPx = basePricePerPx / z;
      const tBounds = timeOffsetBounds(plotW, metrics.nowFraction, msPerPx);
      const offsetMs = clamp(this.snapAnim.fromTimeOffsetMs * inv, tBounds.minOffsetMs, tBounds.maxOffsetMs);
      const centerPrice = liveCenterPrice + this.snapAnim.fromPriceOffset * inv;

      if (progress >= 1) {
        this.zoom = 1;
        this.snapAnim = null;
      } else {
        moving = true;
      }

      return {
        viewport: {
          width: metrics.width,
          height: metrics.height,
          nowMs,
          viewNowMs: nowMs + offsetMs,
          nowFraction: metrics.nowFraction,
          msPerPx,
          centerPrice,
          pricePerPx,
          rightGutter,
          bottomGutter,
        },
        moving,
        isLive: true,
        isZoomed: this.isZoomed,
      };
    }

    // Clamp zoom to current container dimensions
    // Clamp for display only: keeping the player's zoom means a limit that tightens and relaxes never ratchets it
    const z = clampZoom(this.zoom, minZoom);
    const msPerPx = baseMsPerPx / z;
    const pricePerPx = basePricePerPx / z;
    const tBounds = timeOffsetBounds(plotW, metrics.nowFraction, msPerPx);
    const pBounds = priceBounds(
      liveCenterPrice,
      metrics.priceStep,
      pricePerPx * plotH,
      metrics.minSeriesPrice,
      metrics.maxSeriesPrice,
    );

    // 2. Live follow mode
    if (this.following) {
      const clampedOffset = clamp(0, tBounds.minOffsetMs, tBounds.maxOffsetMs);
      return {
        viewport: {
          width: metrics.width,
          height: metrics.height,
          nowMs,
          viewNowMs: nowMs + clampedOffset,
          nowFraction: metrics.nowFraction,
          msPerPx,
          centerPrice: liveCenterPrice,
          pricePerPx,
          rightGutter,
          bottomGutter,
        },
        moving: false,
        isLive: true,
        isZoomed: this.isZoomed,
      };
    }

    // 3. Panned / free inspection mode
    let viewNowMs = this.rawViewNowMs ?? nowMs;
    let centerPrice = this.rawCenterPrice ?? liveCenterPrice;

    if (this.dragging) {
      const timeLimit = plotW * RUBBER_BAND_FRACTION * msPerPx;
      const priceLimit = plotH * RUBBER_BAND_FRACTION * pricePerPx;
      const resistedOffset = applyEdgeResistance(
        viewNowMs - nowMs,
        tBounds.minOffsetMs,
        tBounds.maxOffsetMs,
        timeLimit,
      );
      const resistedPrice = applyEdgeResistance(
        centerPrice,
        pBounds.minPrice,
        pBounds.maxPrice,
        priceLimit,
      );
      return {
        viewport: {
          width: metrics.width,
          height: metrics.height,
          nowMs,
          viewNowMs: nowMs + resistedOffset,
          nowFraction: metrics.nowFraction,
          msPerPx,
          centerPrice: resistedPrice,
          pricePerPx,
          rightGutter,
          bottomGutter,
        },
        moving: true,
        isLive: false,
        isZoomed: this.isZoomed,
      };
    }

    // Momentum coasting & edge spring-back when released
    if (dt > 0 && !reducedMotion) {
      const decay = Math.exp(-dt / MOMENTUM_TAU_MS);
      if (Math.abs(this.vxPxPerMs) >= STOP_SPEED_PX_PER_MS) {
        viewNowMs -= this.vxPxPerMs * dt * msPerPx;
        this.vxPxPerMs *= decay;
        moving = true;
      } else {
        this.vxPxPerMs = 0;
      }

      if (Math.abs(this.vyPxPerMs) >= STOP_SPEED_PX_PER_MS) {
        centerPrice += this.vyPxPerMs * dt * pricePerPx;
        this.vyPxPerMs *= decay;
        moving = true;
      } else {
        this.vyPxPerMs = 0;
      }

      // Spring back any overshoot beyond [min, max]
      const spring = Math.exp(-dt / SPRING_TAU_MS);
      const curOffset = viewNowMs - nowMs;
      if (curOffset < tBounds.minOffsetMs) {
        const overshoot = curOffset - tBounds.minOffsetMs;
        if (Math.abs(overshoot) / msPerPx < 0.5) {
          viewNowMs = nowMs + tBounds.minOffsetMs;
          this.vxPxPerMs = 0;
        } else {
          viewNowMs = nowMs + tBounds.minOffsetMs + overshoot * spring;
          if (this.vxPxPerMs > 0) this.vxPxPerMs *= 0.4;
          moving = true;
        }
      } else if (curOffset > tBounds.maxOffsetMs) {
        const overshoot = curOffset - tBounds.maxOffsetMs;
        if (Math.abs(overshoot) / msPerPx < 0.5) {
          viewNowMs = nowMs + tBounds.maxOffsetMs;
          this.vxPxPerMs = 0;
        } else {
          viewNowMs = nowMs + tBounds.maxOffsetMs + overshoot * spring;
          if (this.vxPxPerMs < 0) this.vxPxPerMs *= 0.4;
          moving = true;
        }
      }

      if (centerPrice < pBounds.minPrice) {
        const overshoot = centerPrice - pBounds.minPrice;
        if (Math.abs(overshoot) / pricePerPx < 0.5) {
          centerPrice = pBounds.minPrice;
          this.vyPxPerMs = 0;
        } else {
          centerPrice = pBounds.minPrice + overshoot * spring;
          if (this.vyPxPerMs < 0) this.vyPxPerMs *= 0.4;
          moving = true;
        }
      } else if (centerPrice > pBounds.maxPrice) {
        const overshoot = centerPrice - pBounds.maxPrice;
        if (Math.abs(overshoot) / pricePerPx < 0.5) {
          centerPrice = pBounds.maxPrice;
          this.vyPxPerMs = 0;
        } else {
          centerPrice = pBounds.maxPrice + overshoot * spring;
          if (this.vyPxPerMs > 0) this.vyPxPerMs *= 0.4;
          moving = true;
        }
      }
    } else {
      // Reduced motion or zero dt: enforce strict bounds
      viewNowMs = nowMs + clamp(viewNowMs - nowMs, tBounds.minOffsetMs, tBounds.maxOffsetMs);
      centerPrice = clamp(centerPrice, pBounds.minPrice, pBounds.maxPrice);
      this.vxPxPerMs = 0;
      this.vyPxPerMs = 0;
    }

    this.rawViewNowMs = viewNowMs;
    this.rawCenterPrice = centerPrice;

    return {
      viewport: {
        width: metrics.width,
        height: metrics.height,
        nowMs,
        viewNowMs,
        nowFraction: metrics.nowFraction,
        msPerPx,
        centerPrice,
        pricePerPx,
        rightGutter,
        bottomGutter,
      },
      moving,
      isLive: false,
      isZoomed: this.isZoomed,
    };
  }
}

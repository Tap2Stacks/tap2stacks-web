import { paletteForBucket, type BoardThemeMode, type CellPalette } from "./cellColor";

export const SPRITE_SHADOW_PAD = 6;
const DEFAULT_MAX_ENTRIES = 160;

export interface CellSprite {
  canvas: CanvasImageSource;
  pad: number;
  cssW: number;
  cssH: number;
  cellW: number;
  cellH: number;
}

export type SpriteCanvasFactory = (
  pixelWidth: number,
  pixelHeight: number,
) => { canvas: CanvasImageSource; ctx: CanvasRenderingContext2D } | null;

let canvasFactoryUnavailable = false;

function defaultCanvasFactory(
  pixelWidth: number,
  pixelHeight: number,
): { canvas: CanvasImageSource; ctx: CanvasRenderingContext2D } | null {
  if (canvasFactoryUnavailable) return null;
  if (typeof OffscreenCanvas !== "undefined") {
    try {
      const oc = new OffscreenCanvas(pixelWidth, pixelHeight);
      const ctx = oc.getContext("2d") as unknown as CanvasRenderingContext2D | null;
      if (ctx) return { canvas: oc, ctx };
    } catch {
      // Fall through to HTMLCanvasElement
    }
  }
  if (typeof document !== "undefined") {
    const el = document.createElement("canvas");
    el.width = pixelWidth;
    el.height = pixelHeight;
    const ctx = el.getContext("2d");
    if (ctx) return { canvas: el, ctx };
  }
  canvasFactoryUnavailable = true;
  return null;
}

export function quantizeCellSize(w: number, h: number): { qw: number; qh: number } {
  return {
    qw: Math.max(4, Math.round(w / 2) * 2),
    qh: Math.max(4, Math.round(h / 2) * 2),
  };
}

/**
 * Traces a rounded rectangle path using quadraticCurveTo and bezierCurveTo
 * (never lineTo), safe for both offscreen sprite bakes and main-canvas fallback.
 */
export function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, w * 0.5, h * 0.5));
  const x1 = x + w;
  const y1 = y + h;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.bezierCurveTo(x + r, y, x1 - r, y, x1 - r, y);
  ctx.quadraticCurveTo(x1, y, x1, y + r);
  ctx.bezierCurveTo(x1, y + r, x1, y1 - r, x1, y1 - r);
  ctx.quadraticCurveTo(x1, y1, x1 - r, y1);
  ctx.bezierCurveTo(x1 - r, y1, x + r, y1, x + r, y1);
  ctx.quadraticCurveTo(x, y1, x, y1 - r);
  ctx.bezierCurveTo(x, y1 - r, x, y + r, x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Renders a single cell's depth layers (soft drop shadow, base OKLCH gradient,
 * top reflection gloss, subtle inner edge bevel, crisp border) into `ctx`.
 * Uses zero shadowBlur so performance is deterministic on mobile GPUs.
 */
export function renderCellTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pal: CellPalette,
  includeShadow: boolean,
): void {
  const gap = Math.min(2, Math.max(0.5, Math.min(w, h) * 0.06));
  const ix = x + gap;
  const iy = y + gap;
  const iw = Math.max(2, w - gap * 2);
  const ih = Math.max(2, h - gap * 2);
  const radius = Math.min(7, Math.floor(Math.min(iw, ih) * 0.24));

  // 1. Soft layered drop shadow (baked once per sprite, zero shadowBlur)
  if (includeShadow && pal.shadowAlpha > 0.005 && iw >= 6 && ih >= 6) {
    const layers = [
      { dy: 3.2, spread: 1.4, mult: 0.28 },
      { dy: 1.8, spread: 0.5, mult: 0.48 },
      { dy: 0.8, spread: 0.0, mult: 0.65 },
    ];
    for (const layer of layers) {
      traceRoundedRect(
        ctx,
        ix - layer.spread * 0.5,
        iy + layer.dy,
        iw + layer.spread,
        ih + layer.spread * 0.4,
        radius + layer.spread * 0.4,
      );
      ctx.fillStyle = `rgba(${pal.shadowColor}, ${(pal.shadowAlpha * layer.mult).toFixed(3)})`;
      ctx.fill();
    }
  }

  // 2. Base surface gradient clipped to rounded tile
  ctx.save();
  traceRoundedRect(ctx, ix, iy, iw, ih, radius);
  ctx.clip();

  const bodyGrad = ctx.createLinearGradient(ix, iy, ix, iy + ih);
  bodyGrad.addColorStop(0, pal.topTone);
  bodyGrad.addColorStop(0.55, pal.fill);
  bodyGrad.addColorStop(1, pal.bottomTone);
  ctx.fillStyle = bodyGrad;
  ctx.fillRect(ix, iy, iw, ih);

  // 3. Top reflection / gloss band across upper ~42% of the tile
  if (ih >= 8) {
    const glossH = Math.max(3, ih * 0.44);
    const glossGrad = ctx.createLinearGradient(ix, iy, ix, iy + glossH);
    glossGrad.addColorStop(0, pal.glossTop);
    glossGrad.addColorStop(1, pal.glossBottom);
    ctx.fillStyle = glossGrad;
    ctx.fillRect(ix, iy, iw, glossH);
  }
  ctx.restore();

  // 4. Subtle inner edge bevel (inset 0.75 px)
  if (iw >= 10 && ih >= 10) {
    const innerGrad = ctx.createLinearGradient(ix, iy, ix, iy + ih);
    innerGrad.addColorStop(0, pal.innerTop);
    innerGrad.addColorStop(0.45, "rgba(255, 255, 255, 0)");
    innerGrad.addColorStop(1, pal.innerBottom);
    traceRoundedRect(ctx, ix + 0.75, iy + 0.75, iw - 1.5, ih - 1.5, Math.max(1, radius - 0.75));
    ctx.strokeStyle = innerGrad;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 5. Crisp outer border
  traceRoundedRect(ctx, ix + 0.35, iy + 0.35, iw - 0.7, ih - 0.7, radius);
  ctx.strokeStyle = pal.border;
  ctx.lineWidth = 0.75;
  ctx.stroke();
}

export class CellSpriteCache {
  private map = new Map<string, CellSprite>();
  private factory: SpriteCanvasFactory;
  private maxEntries: number;

  constructor(
    factory: SpriteCanvasFactory = defaultCanvasFactory,
    maxEntries = DEFAULT_MAX_ENTRIES,
  ) {
    this.factory = factory;
    this.maxEntries = Math.max(1, maxEntries);
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  get(
    bucket: number,
    w: number,
    h: number,
    dpr: number,
    mode: BoardThemeMode,
  ): CellSprite | null {
    const safeDpr = Math.max(1, Math.min(2, Math.round(dpr * 2) / 2));
    const { qw, qh } = quantizeCellSize(w, h);
    const key = `${mode}:${bucket}:${qw}x${qh}@${safeDpr}`;

    const hit = this.map.get(key);
    if (hit) {
      // Refresh LRU order
      this.map.delete(key);
      this.map.set(key, hit);
      return hit;
    }

    const pad = SPRITE_SHADOW_PAD;
    const cssW = qw + pad * 2;
    const cssH = qh + pad * 2;
    const pxW = Math.max(1, Math.round(cssW * safeDpr));
    const pxH = Math.max(1, Math.round(cssH * safeDpr));

    const surface = this.factory(pxW, pxH);
    if (!surface) return null;

    const { canvas, ctx } = surface;
    ctx.setTransform(safeDpr, 0, 0, safeDpr, 0, 0);
    const pal = paletteForBucket(bucket, mode);
    renderCellTile(ctx, pad, pad, qw, qh, pal, true);

    const sprite: CellSprite = { canvas, pad, cssW, cssH, cellW: qw, cellH: qh };
    this.map.set(key, sprite);
    while (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) this.map.delete(oldestKey);
      else break;
    }
    return sprite;
  }
}

export const sharedCellSpriteCache = new CellSpriteCache();

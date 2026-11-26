import { THEME } from "../ui/theme";
import { cellTextColor, type BoardPalette, type BoardThemeMode } from "./cellColor";
import { payoutEmphasis } from "./fade";
import { cellRect, plotHeight, plotWidth, priceToY, timeToX, type BoardViewport } from "./layout";
import { formatLodMultiplier, labelFontPx, type CellLodPlan } from "./lod";

/** Grid line thickness in CSS px: thin, but a full device pixel on 1x screens. */
const GRID_LINE_PX = 1;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Traces a rounded rectangle path using quadraticCurveTo and bezierCurveTo
 * (never lineTo).
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
 * Draws horizontal price row lines across the full plot (including the past side)
 * and vertical column lines only from NOW to the last quoted future column.
 */
export function drawCellGrid(
  ctx: CanvasRenderingContext2D,
  v: BoardViewport,
  cols: number[],
  rows: number[],
  bp: BoardPalette,
): void {
  const plotRight = plotWidth(v);
  const plotBottom = plotHeight(v);
  const nowX = timeToX(v, v.nowMs);

  ctx.save();
  ctx.fillStyle = bp.ink;
  ctx.globalAlpha = bp.guideAlpha;

  for (const price of rows) {
    const y = priceToY(v, price);
    if (y >= 0 && y <= plotBottom) {
      ctx.fillRect(0, y, plotRight, GRID_LINE_PX);
    }
  }

  for (const ts of cols) {
    if (ts < v.nowMs - 1) continue;
    const x = timeToX(v, ts);
    if (x >= Math.max(0, nowX - 0.5) && x <= plotRight) {
      ctx.fillRect(x, 0, GRID_LINE_PX, plotBottom);
    }
  }

  ctx.restore();
}

/**
 * Draws centered multiplier labels for open, unmerged cells only.
 * Locked (< 5 s ahead) and past columns draw nothing here.
 */
export function drawCellLabels(
  ctx: CanvasRenderingContext2D,
  plan: CellLodPlan,
  v: BoardViewport,
  mode: BoardThemeMode,
  bp: BoardPalette,
): void {
  if (plan.textMode === "none") return;

  const plotRight = plotWidth(v);
  const plotBottom = plotHeight(v);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const tile of plan.tiles) {
    if (tile.locked || tile.mergedCount > 1) continue;

    const r = cellRect(v, tile);
    if (r.x + r.w <= 0 || r.x >= plotRight || r.y + r.h <= 0 || r.y >= plotBottom) {
      continue;
    }

    const visW = Math.min(r.x + r.w, plotRight) - Math.max(r.x, 0);
    const visFracX = visW / Math.max(1, r.w);
    const clippedRight = r.x + r.w > plotRight + 0.5;
    const clippedLeft = r.x < -0.5;
    if ((clippedRight || clippedLeft) && visFracX < 0.85) continue;

    const visH = Math.min(r.y + r.h, plotBottom) - Math.max(r.y, 0);
    const visFracY = visH / Math.max(1, r.h);
    if (visFracY < 0.7) continue;

    const textEdgeFade = clippedRight ? smoothstep(0.85, 0.98, visFracX) : 1;
    const emphasis = payoutEmphasis(tile.multiplier);
    const fontSize = labelFontPx(plan.textMode, r.w);

    ctx.globalAlpha = emphasis.textAlpha * textEdgeFade;
    ctx.fillStyle = cellTextColor(tile.multiplier, mode) || bp.ink;
    ctx.font = `${emphasis.fontWeight} ${fontSize}px ${THEME.font}`;
    ctx.fillText(
      formatLodMultiplier(tile.multiplier, plan.textMode),
      r.x + r.w / 2,
      r.y + r.h / 2,
    );
  }

  ctx.restore();
}

/**
 * Renders a soft rounded tile fill for a player's bet or the hovered cell.
 */
export function drawCellTile(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  kind: 'bet' | 'hover',
  alpha: number,
  bp: BoardPalette,
): void {
  const clamped = Math.max(0, Math.min(1, alpha));
  if (clamped <= 0 || r.w <= 0 || r.h <= 0) return;
  const inset = Math.min(1.5, r.w * 0.05, r.h * 0.05);
  const w = r.w - inset * 2;
  const h = r.h - inset * 2;
  if (w <= 0 || h <= 0) return;
  const radius = Math.min(6, w * 0.16, h * 0.16);
  ctx.save();
  ctx.globalAlpha = (kind === 'bet' ? 0.24 : 0.07) * clamped;
  ctx.fillStyle = kind === 'bet' ? bp.highlight : bp.ink;
  traceRoundedRect(ctx, r.x + inset, r.y + inset, w, h, radius);
  ctx.fill();
  if (kind === 'hover') {
    // A crisp outline makes the touched cell read as selected, not just shaded
    ctx.globalAlpha = 0.32 * clamped;
    ctx.strokeStyle = bp.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

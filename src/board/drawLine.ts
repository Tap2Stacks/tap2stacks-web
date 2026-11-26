import { THEME } from '../ui/theme';
import { monotoneSegments, type Pt } from './curve';
import type { BoardPalette } from './cellColor';

export const TAIL_MS = 4_000;

/**
 * Strokes a monotone cubic curve across the supplied points (uses bezierCurveTo only, never lineTo).
 */
export function curve(ctx: CanvasRenderingContext2D, line: Pt[]): void {
    if (!line.length) return;
    ctx.beginPath();
    ctx.moveTo(line[0].x, line[0].y);
    for (const s of monotoneSegments(line)) {
        ctx.bezierCurveTo(s.c1x, s.c1y, s.c2x, s.c2y, s.x1, s.y1);
    }
    ctx.stroke();
}

function buildTailSegment(line: Pt[], tailStartX: number): Pt[] {
    const idx = line.findIndex((p) => p.x >= tailStartX);
    if (idx === -1) return [];
    if (idx === 0 || line[idx].x === tailStartX) return line.slice(idx);
    const prev = line[idx - 1];
    const curr = line[idx];
    const span = curr.x - prev.x;
    if (span <= 0) return line.slice(idx);
    const t = Math.max(0, Math.min(1, (tailStartX - prev.x) / span));
    return [{ x: tailStartX, y: prev.y + (curr.y - prev.y) * t }, ...line.slice(idx)];
}

/**
 * Draws the 3 px ink price curve and overlays a 3.5 px gold gradient tail over the recent 4 s window.
 */
export function drawPriceLine(ctx: CanvasRenderingContext2D, line: Pt[], tailStartX: number, bp: BoardPalette): void {
    if (!line.length) return;
    ctx.save();
    ctx.strokeStyle = bp.ink;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    curve(ctx, line);

    const tail = buildTailSegment(line, tailStartX);
    const tailHead = tail.at(-1);
    if (tail.length >= 2 && tailHead && tailHead.x > tailStartX) {
        const gradient = ctx.createLinearGradient(tailStartX, 0, tailHead.x, 0);
        gradient.addColorStop(0, 'rgba(229, 179, 54, 0)');
        gradient.addColorStop(0.55, THEME.coinDark);
        gradient.addColorStop(1, THEME.highlight);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3.5;
        curve(ctx, tail);
    }
    ctx.restore();
}

/**
 * Draws the live price point with a soft gold radial halo (~14 px) and quiet 1.6 s pulse.
 */
export function drawLiveDot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    nowMs: number,
    reducedMotion: boolean,
    bp: BoardPalette,
): void {
    const phase = (nowMs % 1600) / 1600;
    const haloRadius = reducedMotion ? 14 : 12 + phase * 4;
    const haloAlpha = reducedMotion ? 0.3 : 0.36 * (1 - phase * 0.35);

    ctx.save();
    const halo = ctx.createRadialGradient(x, y, 2, x, y, haloRadius);
    halo.addColorStop(0, THEME.highlight);
    halo.addColorStop(0.55, 'rgba(229, 179, 54, 0.25)');
    halo.addColorStop(1, 'rgba(229, 179, 54, 0)');
    ctx.globalAlpha = haloAlpha;
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    if (!reducedMotion) {
        ctx.globalAlpha = 0.18 * (1 - phase);
        ctx.strokeStyle = bp.ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 6 + phase * 5, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x, y, 4 + (reducedMotion ? 0 : Math.sin(nowMs / 250) * 0.6), 0, Math.PI * 2);
    ctx.fillStyle = bp.ink;
    ctx.fill();
    ctx.restore();
}

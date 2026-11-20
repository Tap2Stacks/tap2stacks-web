import type { CellData } from '../store';
import { THEME } from '../ui/theme';
import { monotoneSegments, type Pt } from './curve';
import { cellRect, isLocked, priceToY, type BoardViewport } from './layout';
import { heatFor } from './heat';
import { cellFade } from './fade';
import { formatBoardPrice } from './priceFormat';
import { stackTotals } from './stacks';
import type { CoinStack } from './types';
export const SETTLEMENT_DURATION_MS = 1200;
export interface BoardScene {
    viewport: BoardViewport;
    cells: CellData[];
    line: Pt[];
    livePrice: number;
    priceStep?: number;
    stacks: Record<string, CoinStack>;
    reducedMotion?: boolean;
    animationNowMs?: number;
    flash?: {
        cellId: string;
        untilMs: number;
    };
}
export function bounds(cell: CellData) {
    return { startTs: cell.timeWindowStart, endTs: cell.timeWindowEnd, lower: Number(cell.original.lowerPrice), upper: Number(cell.original.upperPrice) };
}
function drawCell(ctx: CanvasRenderingContext2D, cell: CellData, v: BoardViewport, livePrice: number) {
    const r = cellRect(v, bounds(cell));
    if (r.x + r.w < 0 || r.x > v.width || r.y + r.h < 0 || r.y > v.height)
        return;
    const past = cell.timeWindowEnd <= v.nowMs || cell.status === 'past';
    const locked = past || isLocked(cell.timeWindowStart, v.nowMs);
    const heat = heatFor(cell.multiplier);
    const visibleAheadMs = Math.max(0, v.width * (1 - v.nowFraction) * v.msPerPx);
    const fade = cellFade({
            multiplier: cell.multiplier,
            cellLower: Number(cell.original.lowerPrice),
            cellUpper: Number(cell.original.upperPrice),
            livePrice: livePrice > 0 ? livePrice : v.centerPrice,
            startTs: cell.timeWindowStart,
            endTs: cell.timeWindowEnd,
            nowMs: v.nowMs,
            visibleAheadMs,
        });
    ctx.globalAlpha = locked ? .3 : fade.tintAlpha;
    ctx.fillStyle = locked || heat === 'none' ? THEME.paper : THEME[heat];
    ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    ctx.strokeStyle = THEME.ink;
    ctx.lineWidth = .5;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    if (!past) {
        ctx.globalAlpha = locked ? .3 : fade.textAlpha;
        ctx.fillStyle = THEME.ink;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${cell.multiplier >= 16 ? '700' : '400'} 12px ${THEME.font}`;
        ctx.fillText(`x${cell.multiplier.toFixed(1)}`, r.x + r.w / 2, r.y + r.h / 2);
    }
    ctx.globalAlpha = 1;
}
function curve(ctx: CanvasRenderingContext2D, line: Pt[]) {
    if (!line.length)
        return;
    ctx.beginPath();
    ctx.moveTo(line[0].x, line[0].y);
    for (const s of monotoneSegments(line))
        ctx.bezierCurveTo(s.c1x, s.c1y, s.c2x, s.c2y, s.x1, s.y1);
    ctx.stroke();
}
function flash(ctx: CanvasRenderingContext2D, scene: BoardScene) {
    if (!scene.flash || scene.flash.untilMs <= scene.viewport.nowMs)
        return;
    const cell = scene.cells.find(c => c.id === scene.flash!.cellId);
    if (!cell)
        return;
    const r = cellRect(scene.viewport, bounds(cell));
    ctx.save();
    ctx.strokeStyle = THEME.highlight;
    ctx.lineWidth = 4;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    curve(ctx, scene.line);
    ctx.restore();
}
function rowGuides(
  ctx: CanvasRenderingContext2D,
  cells: CellData[],
  v: BoardViewport,
  step: number,
): void {
  const prices = new Set(
    cells.flatMap((cell) => [
      Number(cell.original.lowerPrice),
      Number(cell.original.upperPrice),
    ]),
  );
  ctx.fillStyle = THEME.ink;
  ctx.globalAlpha = 0.08;
  for (const price of prices) {
    const y = priceToY(v, price);
    if (y >= 0 && y <= v.height) {
      ctx.fillRect(0, y, v.width, 0.5);
    }
  }
  ctx.globalAlpha = 0.65;
  ctx.font = `10px ${THEME.font}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let lastY = -Infinity;
  for (const price of [...prices].sort((a, b) => b - a)) {
    const y = priceToY(v, price);
    if (y < 8 || y > v.height - 8 || y - lastY < 28) continue;
    ctx.fillText(formatBoardPrice(price, step), 4, y);
    lastY = y;
  }
  ctx.globalAlpha = 1;
}
export function drawBoard(ctx: CanvasRenderingContext2D, scene: BoardScene): void {
    const { viewport: v } = scene;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = THEME.paper;
    ctx.fillRect(0, 0, v.width, v.height);
    for (const cell of scene.cells) {
        drawCell(ctx, cell, v, scene.livePrice);
        const stack = scene.stacks[cell.id];
        if (stack)
            drawStack(ctx, stack, cellRect(v, bounds(cell)), scene.animationNowMs ?? v.nowMs, scene.reducedMotion);
    }
    rowGuides(ctx, scene.cells, v, scene.priceStep ?? .01);
    ctx.strokeStyle = THEME.ink;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    curve(ctx, scene.line);
    flash(ctx, scene);
    if (scene.livePrice > 0) {
        const y = priceToY(v, scene.livePrice), x = v.width * v.nowFraction;
        ctx.setLineDash([3, 5]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x, y, v.width, y, v.width, y);
        ctx.stroke();
        ctx.setLineDash([]);
        if (!scene.reducedMotion) {
            const phase = (v.nowMs % 1600) / 1600;
            ctx.save();
            ctx.globalAlpha = .18 * (1 - phase);
            ctx.strokeStyle = THEME.ink;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(x, y, 6 + phase * 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(x, y, 4 + (scene.reducedMotion ? 0 : Math.sin(v.nowMs / 250) * .6), 0, Math.PI * 2);
        ctx.fillStyle = THEME.ink;
        ctx.fill();
        ctx.fillRect(v.width - 78, y - 12, 78, 24);
        ctx.fillStyle = THEME.paper;
        ctx.font = `12px ${THEME.font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatBoardPrice(scene.livePrice, scene.priceStep ?? .01), v.width - 39, y);
    }
    ctx.restore();
}
export function drawStack(ctx: CanvasRenderingContext2D, stack: CoinStack, r: {
    x: number;
    y: number;
    w: number;
    h: number;
}, nowMs: number, reducedMotion = false): void {
    const coins = stack.coins.filter(c => c.status !== 'rejected');
    if (!coins.length)
        return;
    const totals = stackTotals(stack), newest = coins.at(-1)!;
    const age = Math.max(0, nowMs - newest.placedAt), progress = Math.min(1, age / 180);
    const drop = reducedMotion ? 0 : -12 * (1 - progress) * Math.cos(progress * Math.PI * 2);
    const terminal = coins.every(c => ['lost', 'void', 'won'].includes(c.status));
    const terminalAt = Math.max(...coins.map(c => c.updatedAt ?? c.placedAt));
    const terminalAge = Math.max(0, nowMs - terminalAt);
    const fade = terminal ? Math.max(0, 1 - terminalAge / SETTLEMENT_DURATION_MS) : 1;
    if (fade === 0)
        return;
    ctx.save();
    ctx.globalAlpha = fade;
    const refund = coins.every(c => c.status === 'void') && !reducedMotion ? Math.min(1, terminalAge / SETTLEMENT_DURATION_MS) : 0;
    const x = r.x + r.w / 2 + refund * 100, y = r.y + r.h / 2 + drop - refund * 60;
    const radius = Math.min(15, r.h * .34, r.w * .2);
    const gradient = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
    gradient.addColorStop(0, THEME.coinLight);
    gradient.addColorStop(1, THEME.coinDark);
    for (let i = 0; i < Math.min(3, coins.length); i++) {
        ctx.globalAlpha = fade * (coins[Math.max(0, coins.length - Math.min(3, coins.length)) + i].status === 'pending' ? .5 : 1);
        ctx.beginPath();
        ctx.ellipse(x, y - i * 3, radius, radius * .8, 0, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = THEME.ink;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    ctx.globalAlpha = fade;
    const outcome = !terminal ? null : coins.every(c => c.status === 'won') ? 'Won'
        : coins.every(c => c.status === 'lost') ? 'Missed'
        : coins.every(c => c.status === 'void') ? 'Refunded' : 'Settled';
    ctx.fillStyle = outcome === 'Won' ? THEME.win : outcome === 'Missed' ? THEME.loss : THEME.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${outcome ? 9 : 11}px ${THEME.font}`;
    ctx.fillText(outcome ?? `$${totals.stake}`, x, y - 3);
    ctx.fillStyle = THEME.paper;
    ctx.fillRect(x + radius - 5, y - radius - 5, 25, 15);
    ctx.strokeRect(x + radius - 5, y - radius - 5, 25, 15);
    ctx.fillStyle = THEME.ink;
    ctx.fillText(`x${totals.count}`, x + radius + 7, y - radius + 2);
    ctx.restore();
}

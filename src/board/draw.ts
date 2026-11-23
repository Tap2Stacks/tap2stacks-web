import type { CellData } from '../store';
import { THEME } from '../ui/theme';
import { monotoneSegments, type Pt } from './curve';
import { cellRect, priceToY, timeToX, xToTime, type BoardViewport } from './layout';
import { cellFade } from './fade';
import { formatBoardPrice } from './priceFormat';
import { stackTotals } from './stacks';
import type { CoinStack } from './types';
import { FUTURE_LIMIT_MS, HISTORY_LIMIT_MS } from './camera';
import {
    boardPalette,
    cellPalette,
    LOCKED_BUCKET,
    paletteForBucket,
    type BoardPalette,
    type BoardThemeMode,
} from './cellColor';
import {
    renderCellTile,
    sharedCellSpriteCache,
    type CellSpriteCache,
} from './cellSprites';
import {
    formatLodMultiplier,
    planCellLod,
    type CellTextMode,
    type RenderTile,
} from './lod';

export const SETTLEMENT_DURATION_MS = 1200;
export type { BoardThemeMode };

export interface BoardScene {
    viewport: BoardViewport;
    cells: CellData[];
    line: Pt[];
    livePrice: number;
    priceStep?: number;
    stacks: Record<string, CoinStack>;
    reducedMotion?: boolean;
    animationNowMs?: number;
    maxQuotedEndTs?: number;
    dpr?: number;
    themeMode?: BoardThemeMode;
    spriteCache?: CellSpriteCache;
    flash?: {
        cellId: string;
        untilMs: number;
    };
}

export function bounds(cell: CellData) {
    return { startTs: cell.timeWindowStart, endTs: cell.timeWindowEnd, lower: Number(cell.original.lowerPrice), upper: Number(cell.original.upperPrice) };
}

function drawTile(
    ctx: CanvasRenderingContext2D,
    tile: RenderTile,
    v: BoardViewport,
    livePrice: number,
    textMode: CellTextMode,
    mode: BoardThemeMode,
    bp: BoardPalette,
    dpr: number,
    spriteCache: CellSpriteCache,
) {
    const r = cellRect(v, tile);
    if (r.x + r.w < 0 || r.x > v.width || r.y + r.h < 0 || r.y > v.height)
        return;

    const visibleAheadMs = Math.max(0, v.width * (1 - v.nowFraction) * v.msPerPx);
    const fade = cellFade({
        multiplier: tile.multiplier,
        cellLower: tile.lower,
        cellUpper: tile.upper,
        livePrice: livePrice > 0 ? livePrice : v.centerPrice,
        startTs: tile.startTs,
        endTs: tile.endTs,
        nowMs: v.nowMs,
        visibleAheadMs,
    });

    const pal = tile.locked
        ? paletteForBucket(LOCKED_BUCKET, mode)
        : cellPalette(tile.multiplier, mode);
    const tileAlpha = tile.locked ? 0.3 : fade.tintAlpha;
    const sprite = spriteCache.get(pal.bucket, r.w, r.h, dpr, mode);

    ctx.globalAlpha = tileAlpha;
    if (sprite) {
        ctx.drawImage(
            sprite.canvas,
            r.x - sprite.pad,
            r.y - sprite.pad,
            r.w + sprite.pad * 2,
            r.h + sprite.pad * 2,
        );
    } else {
        renderCellTile(ctx, r.x, r.y, r.w, r.h, pal, false);
    }

    if (textMode !== 'none') {
        const fontSize = textMode === 'compact' ? 10 : r.w < 44 ? 11 : 12;
        const weight = tile.locked ? 400 : fade.fontWeight;
        ctx.globalAlpha = tile.locked ? 0.3 : fade.textAlpha;
        ctx.fillStyle = bp.ink;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${weight} ${fontSize}px ${THEME.font}`;
        ctx.fillText(formatLodMultiplier(tile.multiplier, textMode), r.x + r.w / 2, r.y + r.h / 2);
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

function flash(ctx: CanvasRenderingContext2D, scene: BoardScene, bp: BoardPalette) {
    if (!scene.flash || scene.flash.untilMs <= scene.viewport.nowMs)
        return;
    const cell = scene.cells.find(c => c.id === scene.flash!.cellId);
    if (!cell)
        return;
    const r = cellRect(scene.viewport, bounds(cell));
    ctx.save();
    ctx.strokeStyle = bp.highlight;
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
    bp: BoardPalette,
): void {
    const prices = new Set(
        cells.flatMap((cell) => [
            Number(cell.original.lowerPrice),
            Number(cell.original.upperPrice),
        ]),
    );
    // When panned into history without visible cells, synthesize clean price step levels
    if (prices.size < 4 && step > 0 && v.centerPrice > 0) {
        const halfSpan = (v.height / 2) * v.pricePerPx;
        const minLevel = Math.floor((v.centerPrice - halfSpan) / step);
        const maxLevel = Math.ceil((v.centerPrice + halfSpan) / step);
        const stride = Math.max(1, Math.ceil((maxLevel - minLevel) / 40));
        for (let lvl = minLevel; lvl <= maxLevel; lvl += stride) {
            prices.add(lvl * step);
        }
    }

    ctx.fillStyle = bp.ink;
    ctx.globalAlpha = bp.guideAlpha;
    for (const price of prices) {
        const y = priceToY(v, price);
        if (y >= 0 && y <= v.height) {
            ctx.fillRect(0, y, v.width, 0.5);
        }
    }
    ctx.globalAlpha = bp.axisAlpha;
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

function drawNotOpenYetZone(
    ctx: CanvasRenderingContext2D,
    v: BoardViewport,
    maxQuotedEndTs: number,
    bp: BoardPalette,
) {
    const nowX = timeToX(v, v.nowMs);
    const quoteEndTs = Math.max(v.nowMs, maxQuotedEndTs);
    const startX = Math.max(0, Math.max(nowX, timeToX(v, quoteEndTs)));
    const futureEdgeX = Math.min(v.width, timeToX(v, v.nowMs + FUTURE_LIMIT_MS));
    if (futureEdgeX - startX < 4) return;

    ctx.save();
    ctx.fillStyle = bp.ink;
    ctx.globalAlpha = bp.notOpenWashAlpha;
    ctx.fillRect(startX, 0, futureEdgeX - startX, v.height);

    // Subtle dashed vertical divider at the quoted horizon (uses bezierCurveTo, never lineTo)
    if (startX > 0 && startX < v.width) {
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = bp.ink;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.bezierCurveTo(startX, 0, startX, v.height, startX, v.height);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Label kept clear of the right-side live price tag
    const labelRight = Math.min(futureEdgeX, v.width - 84);
    if (labelRight - startX >= 92) {
        const cx = (startX + labelRight) / 2;
        ctx.globalAlpha = 0.48;
        ctx.fillStyle = bp.ink;
        ctx.font = `600 11px ${THEME.font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Not open yet', cx, v.height / 2);
    }
    ctx.restore();
}

function drawTimeTicks(ctx: CanvasRenderingContext2D, v: BoardViewport, bp: BoardPalette) {
    const leftTs = xToTime(v, 64);
    const rightTs = xToTime(v, v.width - 86);
    if (rightTs <= leftTs) return;

    const candidates = [5_000, 10_000, 15_000, 30_000, 60_000];
    let stepMs = 60_000;
    for (const c of candidates) {
        if (c / v.msPerPx >= 72) {
            stepMs = c;
            break;
        }
    }

    const minOffset = Math.max(-HISTORY_LIMIT_MS, Math.ceil((leftTs - v.nowMs) / stepMs) * stepMs);
    const maxOffset = Math.min(FUTURE_LIMIT_MS, Math.floor((rightTs - v.nowMs) / stepMs) * stepMs);
    if (minOffset > maxOffset) return;

    ctx.save();
    ctx.fillStyle = bp.ink;
    ctx.font = `500 9px ${THEME.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.globalAlpha = 0.45;

    for (let offset = minOffset; offset <= maxOffset; offset += stepMs) {
        const x = timeToX(v, v.nowMs + offset);
        if (x < 64 || x > v.width - 86) continue;
        const absSec = Math.round(Math.abs(offset) / 1000);
        let label: string;
        if (offset === 0) {
            label = 'NOW';
        } else {
            const sign = offset < 0 ? '-' : '+';
            label = absSec >= 60 && absSec % 60 === 0
                ? `${sign}${absSec / 60}m`
                : absSec > 60
                    ? `${sign}${Math.floor(absSec / 60)}m${absSec % 60}s`
                    : `${sign}${absSec}s`;
        }
        ctx.fillText(label, x, v.height - 6);
    }
    ctx.restore();
}

export function drawBoard(ctx: CanvasRenderingContext2D, scene: BoardScene): void {
    const { viewport: v } = scene;
    const mode: BoardThemeMode = scene.themeMode ?? 'light';
    const bp = boardPalette(mode);
    const dpr = scene.dpr ?? 1;
    const spriteCache = scene.spriteCache ?? sharedCellSpriteCache;
    const step = scene.priceStep ?? 0.01;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = bp.surface;
    ctx.fillRect(0, 0, v.width, v.height);

    let maxQuotedEndTs = scene.maxQuotedEndTs ?? v.nowMs;
    for (const cell of scene.cells) {
        if (cell.timeWindowEnd > maxQuotedEndTs) maxQuotedEndTs = cell.timeWindowEnd;
    }

    // 1. Render bounded future tiles using pre-rendered depth sprites & LOD
    const lod = planCellLod(scene.cells, v, step, scene.stacks);
    for (const tile of lod.tiles) {
        drawTile(ctx, tile, v, scene.livePrice, lod.textMode, mode, bp, dpr, spriteCache);
    }

    // 2. Render coin stacks on both future and past cells (past area has no odds, only line + stacks)
    for (const cell of scene.cells) {
        const stack = scene.stacks[cell.id];
        if (stack) {
            drawStack(ctx, stack, cellRect(v, bounds(cell)), scene.animationNowMs ?? v.nowMs, scene.reducedMotion, bp);
        }
    }

    drawNotOpenYetZone(ctx, v, maxQuotedEndTs, bp);
    rowGuides(ctx, scene.cells, v, step, bp);
    drawTimeTicks(ctx, v, bp);

    ctx.strokeStyle = bp.ink;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    curve(ctx, scene.line);
    flash(ctx, scene, bp);

    if (scene.livePrice > 0) {
        const rawY = priceToY(v, scene.livePrice);
        const liveX = timeToX(v, v.nowMs);
        const tagY = Math.max(12, Math.min(v.height - 12, rawY));
        if (rawY >= 0 && rawY <= v.height) {
            const dashStart = Math.max(0, Math.min(v.width, liveX));
            ctx.setLineDash([3, 5]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(dashStart, rawY);
            ctx.bezierCurveTo(dashStart, rawY, v.width, rawY, v.width, rawY);
            ctx.stroke();
            ctx.setLineDash([]);
            if (liveX >= -16 && liveX <= v.width + 16) {
                if (!scene.reducedMotion) {
                    const phase = (v.nowMs % 1600) / 1600;
                    ctx.save();
                    ctx.globalAlpha = .18 * (1 - phase);
                    ctx.strokeStyle = bp.ink;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(liveX, rawY, 6 + phase * 5, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }
                ctx.beginPath();
                ctx.arc(liveX, rawY, 4 + (scene.reducedMotion ? 0 : Math.sin(v.nowMs / 250) * .6), 0, Math.PI * 2);
                ctx.fillStyle = bp.ink;
                ctx.fill();
            }
        }
        ctx.fillStyle = bp.ink;
        ctx.fillRect(v.width - 78, tagY - 12, 78, 24);
        ctx.fillStyle = bp.surface;
        ctx.font = `12px ${THEME.font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(formatBoardPrice(scene.livePrice, step), v.width - 39, tagY);
    }
    ctx.restore();
}

export function drawStack(ctx: CanvasRenderingContext2D, stack: CoinStack, r: {
    x: number;
    y: number;
    w: number;
    h: number;
}, nowMs: number, reducedMotion = false, bp: BoardPalette = boardPalette('light')): void {
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
        ctx.strokeStyle = bp.ink;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    ctx.globalAlpha = fade;
    const outcome = !terminal ? null : coins.every(c => c.status === 'won') ? 'Won'
        : coins.every(c => c.status === 'lost') ? 'Missed'
        : coins.every(c => c.status === 'void') ? 'Refunded' : 'Settled';
    ctx.fillStyle = outcome === 'Won' ? bp.win : outcome === 'Missed' ? bp.loss : THEME.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${outcome ? 9 : 11}px ${THEME.font}`;
    ctx.fillText(outcome ?? `$${totals.stake}`, x, y - 3);
    ctx.fillStyle = bp.surface;
    ctx.fillRect(x + radius - 5, y - radius - 5, 25, 15);
    ctx.strokeStyle = bp.ink;
    ctx.strokeRect(x + radius - 5, y - radius - 5, 25, 15);
    ctx.fillStyle = bp.ink;
    ctx.fillText(`x${totals.count}`, x + radius + 7, y - radius + 2);
    ctx.restore();
}

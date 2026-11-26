import type { CellData } from '../store';
import { THEME } from '../ui/theme';
import type { Pt } from './curve';
import { cellRect, isLocked, plotHeight, plotWidth, priceToY, timeToX, xToTime, type BoardViewport } from './layout';
import { formatBoardPrice } from './priceFormat';
import { stackTotals } from './stacks';
import type { CoinStack } from './types';
import { FUTURE_LIMIT_MS, HISTORY_LIMIT_MS } from './camera';
import {
    boardPalette,
    type BoardPalette,
    type BoardThemeMode,
} from './cellColor';
import { drawCellGrid, drawCellLabels, drawCellTile, traceRoundedRect } from './drawCells';
import { curve, drawLiveDot, drawPriceLine, TAIL_MS } from './drawLine';
import { planCellLod } from './lod';

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
    isFollowing?: boolean;
    hover?: {
        cellId: string;
        alpha: number;
    };
    flash?: {
        cellId: string;
        untilMs: number;
    };
}

export function bounds(cell: CellData) {
    return { startTs: cell.timeWindowStart, endTs: cell.timeWindowEnd, lower: Number(cell.original.lowerPrice), upper: Number(cell.original.upperPrice) };
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

function collectGuidePrices(cells: CellData[], v: BoardViewport, step: number): number[] {
    const prices = new Set(
        cells.flatMap((cell) => [
            Number(cell.original.lowerPrice),
            Number(cell.original.upperPrice),
        ]),
    );
    // When panned into pure history without visible cells, synthesize clean price step levels
    if (prices.size === 0 && step > 0 && v.centerPrice > 0) {
        const halfSpan = (plotHeight(v) / 2) * v.pricePerPx;
        const minLevel = Math.floor((v.centerPrice - halfSpan) / step);
        const maxLevel = Math.ceil((v.centerPrice + halfSpan) / step);
        const stride = Math.max(1, Math.ceil((maxLevel - minLevel) / 40));
        for (let lvl = minLevel; lvl <= maxLevel; lvl += stride) {
            prices.add(lvl * step);
        }
    }
    return [...prices].sort((a, b) => b - a);
}

function collectColumnEdges(cells: CellData[], v: BoardViewport): number[] {
    const edges = new Set<number>();
    for (const cell of cells) {
        if (cell.timeWindowEnd <= v.nowMs || cell.status === 'past') continue;
        if (cell.timeWindowStart >= v.nowMs) edges.add(cell.timeWindowStart);
        if (cell.timeWindowEnd >= v.nowMs) edges.add(cell.timeWindowEnd);
    }
    return [...edges].sort((a, b) => a - b);
}

/**
 * Draws left-side price axis labels AFTER the price curve with a warm-paper
 * (or dark-surface) backing chip so the price line never crosses out labels.
 */
function drawPriceAxisLabels(
    ctx: CanvasRenderingContext2D,
    prices: number[],
    v: BoardViewport,
    step: number,
    bp: BoardPalette,
    avoidLeftY: number | null,
): void {
    const bottom = plotHeight(v);
    ctx.save();
    ctx.font = `10px ${THEME.font}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let lastY = -Infinity;
    for (const price of prices) {
        const y = priceToY(v, price);
        if (y < 8 || y > bottom - 8 || y - lastY < 28) continue;
        if (avoidLeftY !== null && Math.abs(y - avoidLeftY) < 16) continue;
        const label = formatBoardPrice(price, step);
        const measured = ctx.measureText?.(label)?.width;
        const labelW = Number.isFinite(measured) && measured > 0 ? Math.min(measured, label.length * 7 + 4) : label.length * 6;
        // Surface backing pill keeps labels 100% legible above the price line
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = bp.surface;
        traceRoundedRect(ctx, 2, y - 7, labelW + 6, 14, 3);
        ctx.fill();

        ctx.globalAlpha = bp.axisAlpha;
        ctx.fillStyle = bp.ink;
        ctx.fillText(label, 5, y);
        lastY = y;
    }
    ctx.restore();
}

function drawNotOpenYetZone(
    ctx: CanvasRenderingContext2D,
    v: BoardViewport,
    maxQuotedEndTs: number,
    bp: BoardPalette,
) {
    // Only render beyond the last quoted future window when quotes exist
    if (maxQuotedEndTs <= v.nowMs) return;
    const plotRight = plotWidth(v);
    const plotBottom = plotHeight(v);
    const nowX = timeToX(v, v.nowMs);
    const startX = Math.max(0, Math.max(nowX, timeToX(v, maxQuotedEndTs)));
    const futureEdgeX = Math.min(plotRight, timeToX(v, v.nowMs + FUTURE_LIMIT_MS));
    if (futureEdgeX - startX < 4) return;

    ctx.save();
    ctx.fillStyle = bp.ink;
    ctx.globalAlpha = bp.notOpenWashAlpha;
    ctx.fillRect(startX, 0, futureEdgeX - startX, plotBottom);

    // Subtle dashed vertical divider at the quoted horizon (uses bezierCurveTo, never lineTo)
    if (startX > 0 && startX < plotRight) {
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = bp.ink;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.bezierCurveTo(startX, 0, startX, plotBottom, startX, plotBottom);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Label centered cleanly inside the unquoted plot area (never entering the right gutter)
    if (futureEdgeX - startX >= 84) {
        const cx = (startX + futureEdgeX) / 2;
        ctx.globalAlpha = 0.48;
        ctx.fillStyle = bp.ink;
        ctx.font = `600 11px ${THEME.font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Not open yet', cx, plotBottom / 2);
    }
    ctx.restore();
}

/**
 * Draws the time axis inside its dedicated bottom lane (when bottomGutter > 0)
 * so NOW and relative time labels never overlap the bottom row of cells.
 */
function drawTimeAxis(ctx: CanvasRenderingContext2D, v: BoardViewport, bp: BoardPalette) {
    const plotRight = plotWidth(v);
    const plotBottom = plotHeight(v);
    const laneH = v.bottomGutter ?? 0;

    if (laneH > 0) {
        ctx.save();
        ctx.fillStyle = bp.surface;
        ctx.globalAlpha = 1;
        ctx.fillRect(0, plotBottom, v.width, laneH);
        ctx.fillStyle = bp.ink;
        ctx.globalAlpha = 0.12;
        ctx.fillRect(0, plotBottom, v.width, 1);
        ctx.restore();
    }

    const leftBound = laneH > 0 ? 18 : 56;
    const rightBound = plotRight - 14;
    if (rightBound <= leftBound) return;
    const leftTs = xToTime(v, leftBound);
    const rightTs = xToTime(v, rightBound);
    if (rightTs <= leftTs) return;

    const candidates = [5_000, 10_000, 15_000, 30_000, 60_000];
    let stepMs = 60_000;
    for (const c of candidates) {
        if (c / v.msPerPx >= 64) {
            stepMs = c;
            break;
        }
    }

    const minOffset = Math.max(-HISTORY_LIMIT_MS, Math.ceil((leftTs - v.nowMs) / stepMs) * stepMs);
    const maxOffset = Math.min(FUTURE_LIMIT_MS, Math.floor((rightTs - v.nowMs) / stepMs) * stepMs);
    if (minOffset > maxOffset) return;

    const labelY = laneH > 0 ? plotBottom + laneH / 2 + 1 : v.height - 6;

    ctx.save();
    ctx.fillStyle = bp.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = laneH > 0 ? 'middle' : 'bottom';

    for (let offset = minOffset; offset <= maxOffset; offset += stepMs) {
        const x = timeToX(v, v.nowMs + offset);
        if (x < leftBound || x > rightBound) continue;
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
        if (laneH > 0) {
            ctx.globalAlpha = offset === 0 ? 0.4 : 0.18;
            ctx.fillRect(x - 0.5, plotBottom, 1, 3);
        }
        ctx.font = `${offset === 0 ? '700' : '500'} 9px ${THEME.font}`;
        ctx.globalAlpha = offset === 0 ? 0.85 : 0.48;
        ctx.fillText(label, x, labelY);
    }
    ctx.restore();
}

function drawLiveAxisMarker(
    ctx: CanvasRenderingContext2D,
    v: BoardViewport,
    livePrice: number,
    step: number,
    bp: BoardPalette,
    pannedAway: boolean,
    liveX: number,
    rawY: number,
): void {
    const plotRight = plotWidth(v);
    const plotBottom = plotHeight(v);
    const gutter = v.rightGutter ?? 0;
    const priceText = formatBoardPrice(livePrice, step);
    const tagY = Math.max(12, Math.min(plotBottom - 12, rawY));

    ctx.save();
    if (!pannedAway) {
        // Live view: crisp solid price tag inside the reserved right gutter (never over cells)
        const tagW = gutter > 0 ? Math.max(42, gutter - 4) : 58;
        const tagX = gutter > 0 ? plotRight + 2 : v.width - tagW;
        const tagH = gutter > 0 && gutter <= 52 ? 20 : 22;
        const fontSize = gutter > 0 && gutter <= 52 ? 10 : 11;

        ctx.fillStyle = bp.ink;
        traceRoundedRect(ctx, tagX, tagY - tagH / 2, tagW, tagH, 4);
        ctx.fill();

        ctx.fillStyle = bp.surface;
        ctx.font = `600 ${fontSize}px ${THEME.font}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(priceText, tagX + tagW / 2, tagY);
        ctx.restore();
        return;
    }

    // Panned away: compact outlined edge marker on the axis (arrow + price)
    const onLeftEdge = liveX < 0;
    let markerText: string;
    if (onLeftEdge) {
        markerText = `←${priceText}`;
    } else if (liveX > plotRight) {
        markerText = `${priceText}→`;
    } else if (rawY < 12) {
        markerText = `↑${priceText}`;
    } else if (rawY > plotBottom - 12) {
        markerText = `↓${priceText}`;
    } else {
        markerText = liveX >= plotRight * v.nowFraction ? `${priceText}→` : `←${priceText}`;
    }

    const markerH = 18;
    const markerW = onLeftEdge
        ? Math.max(48, markerText.length * 5.6 + 8)
        : gutter > 0
            ? Math.max(44, gutter - 4)
            : Math.max(52, markerText.length * 5.6 + 8);
    const markerX = onLeftEdge
        ? 2
        : gutter > 0
            ? plotRight + 2
            : v.width - markerW - 2;

    ctx.globalAlpha = 0.95;
    ctx.fillStyle = bp.surface;
    traceRoundedRect(ctx, markerX, tagY - markerH / 2, markerW, markerH, 4);
    ctx.fill();

    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = bp.ink;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = bp.ink;
    ctx.font = `600 9px ${THEME.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(markerText, markerX + markerW / 2, tagY);
    ctx.restore();
}

function stackSettlementFade(stack: CoinStack | undefined, nowMs: number): number {
    if (!stack) return 0;
    const coins = stack.coins.filter(c => c.status !== 'rejected');
    if (!coins.length) return 0;
    const terminal = coins.every(c => ['lost', 'void', 'won'].includes(c.status));
    if (!terminal) return 1;
    const terminalAt = Math.max(...coins.map(c => c.updatedAt ?? c.placedAt));
    return Math.max(0, 1 - Math.max(0, nowMs - terminalAt) / SETTLEMENT_DURATION_MS);
}

function drawHoverTile(ctx: CanvasRenderingContext2D, scene: BoardScene, animNow: number, bp: BoardPalette): void {
    const hover = scene.hover;
    if (!hover || hover.alpha <= 0) return;
    const cell = scene.cells.find(c => c.id === hover.cellId);
    if (!cell || cell.status !== 'active' || isLocked(cell.timeWindowStart, scene.viewport.nowMs)) return;
    if (stackSettlementFade(scene.stacks[cell.id], animNow) > 0) return;
    drawCellTile(ctx, cellRect(scene.viewport, bounds(cell)), 'hover', hover.alpha, bp);
}

function drawStacksAndBets(ctx: CanvasRenderingContext2D, scene: BoardScene, animNow: number, bp: BoardPalette): void {
    for (const cell of scene.cells) {
        const stack = scene.stacks[cell.id];
        const fade = stackSettlementFade(stack, animNow);
        if (!stack || fade <= 0) continue;
        const r = cellRect(scene.viewport, bounds(cell));
        drawCellTile(ctx, r, 'bet', fade, bp);
        drawStack(ctx, stack, r, animNow, scene.reducedMotion, bp);
    }
}

/** x where the first open (tappable) column starts, so the live guide stays in the blank zone. */
function guideEndX(cells: CellData[], v: BoardViewport, plotRight: number): number {
    let firstOpenTs = Infinity;
    for (const cell of cells) {
        if (cell.timeWindowEnd <= v.nowMs || cell.status === 'past') continue;
        if (isLocked(cell.timeWindowStart, v.nowMs)) continue;
        if (cell.timeWindowStart < firstOpenTs) firstOpenTs = cell.timeWindowStart;
    }
    if (!Number.isFinite(firstOpenTs)) return plotRight;
    return Math.max(0, Math.min(plotRight, timeToX(v, firstOpenTs)));
}

export function drawBoard(ctx: CanvasRenderingContext2D, scene: BoardScene): void {
    const { viewport: v } = scene;
    const mode: BoardThemeMode = scene.themeMode ?? 'light';
    const bp = boardPalette(mode);
    const step = scene.priceStep ?? 0.01;
    const plotRight = plotWidth(v);
    const plotBottom = plotHeight(v);
    const gutter = v.rightGutter ?? 0;

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = bp.surface;
    ctx.fillRect(0, 0, v.width, v.height);

    let maxQuotedEndTs = scene.maxQuotedEndTs ?? v.nowMs;
    for (const cell of scene.cells) {
        if (cell.timeWindowEnd > maxQuotedEndTs) maxQuotedEndTs = cell.timeWindowEnd;
    }

    const guidePrices = collectGuidePrices(scene.cells, v, step);
    const colEdges = collectColumnEdges(scene.cells, v);
    const liveX = timeToX(v, v.nowMs);
    const rawY = scene.livePrice > 0 ? priceToY(v, scene.livePrice) : -1;
    const pannedAway = scene.isFollowing === false || liveX < 0 || liveX > plotRight;

    // Clip all chart content strictly inside [0, plotRight] x [0, plotBottom]
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, plotRight, plotBottom);
    ctx.clip();

    // 0. Draw thin cell grid (row lines across plot, column lines from NOW onward) and live-price dashed guide
    drawCellGrid(ctx, v, colEdges, guidePrices, bp);
    if (scene.livePrice > 0 && !pannedAway && rawY >= 0 && rawY <= plotBottom) {
        const dashStart = Math.max(0, Math.min(plotRight, liveX));
        const dashEnd = Math.max(dashStart, guideEndX(scene.cells, v, plotRight));
        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = bp.ink;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(dashStart, rawY);
        ctx.bezierCurveTo(dashStart, rawY, dashEnd, rawY, dashEnd, rawY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    // 1. Soft hover tile (only open, unbet, unlocked cell) and multiplier labels
    const animNow = scene.animationNowMs ?? v.nowMs;
    drawHoverTile(ctx, scene, animNow, bp);
    const lod = planCellLod(scene.cells, v, step);
    drawCellLabels(ctx, lod, v, mode, bp);

    // 2. Render player bet tiles and coin stacks on both future and past cells
    drawStacksAndBets(ctx, scene, animNow, bp);

    drawNotOpenYetZone(ctx, v, maxQuotedEndTs, bp);

    const tailStartX = timeToX(v, v.nowMs - TAIL_MS);
    drawPriceLine(ctx, scene.line, tailStartX, bp);
    flash(ctx, scene, bp);

    if (scene.livePrice > 0 && rawY >= 0 && rawY <= plotBottom) {
        if (liveX >= -16 && liveX <= plotRight + 16) {
            drawLiveDot(ctx, liveX, rawY, v.nowMs, !!scene.reducedMotion, bp);
        }
    }
    ctx.restore();

    // Subtle vertical divider separating plot from the reserved right gutter
    if (gutter > 0) {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = bp.ink;
        ctx.fillRect(plotRight, 0, 1, plotBottom);
        ctx.restore();
    }

    // Dedicated bottom time-axis lane (never overlaps bottom row cells)
    drawTimeAxis(ctx, v, bp);

    // Draw left price-axis labels ABOVE the price line with surface backing chips
    const avoidLeftY =
        scene.livePrice > 0 && pannedAway && liveX < 0
            ? Math.max(12, Math.min(plotBottom - 12, rawY))
            : null;
    drawPriceAxisLabels(ctx, guidePrices, v, step, bp, avoidLeftY);

    // Draw live price tag (in right gutter) or compact axis edge marker (when panned away)
    if (scene.livePrice > 0) {
        drawLiveAxisMarker(ctx, v, scene.livePrice, step, bp, pannedAway, liveX, rawY);
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
    const fade = stackSettlementFade(stack, nowMs);
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

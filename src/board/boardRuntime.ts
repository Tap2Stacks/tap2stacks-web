import { useGameStore, type CellData } from '../store';
import { bounds, drawBoard, SETTLEMENT_DURATION_MS, type BoardScene, type BoardThemeMode } from './draw';
import { createChartClock } from './clock';
import { createSmoothValue } from './smooth';
import { cellRect, hitTestCell, isLocked, plotHeight, plotWidth, priceToY, timeToX, xToTime, type BoardViewport } from './layout';
import { boardScale } from './boardScale';
import { PHONE_BREAKPOINT } from '../shell/useIsPhone';
import { createDrawnSeries, decimateVisibleLine } from './drawnSeries';
import { visibleCells } from './retainedCells';
import { HISTORY_RETENTION_MS, seriesFor, shouldRedraw } from './priceSeries';
import { BoardCamera, type CameraMetrics } from './camera';

type State = ReturnType<typeof useGameStore.getState>;

export interface BoardHudState {
    following: boolean;
    zoomed: boolean;
}

function detectThemeMode(): BoardThemeMode {
    if (typeof document === 'undefined') return 'light';
    const root = document.documentElement;
    if (root.classList.contains('dark') || root.dataset.theme === 'dark') {
        return 'dark';
    }
    return 'light';
}

export class BoardRuntime {
    viewport: BoardViewport | null = null;
    private camera = new BoardCamera();
    private clock = createChartClock();
    private head = createSmoothValue();
    private drawn = createDrawnSeries();
    private center = createSmoothValue(400);
    private size = { width: 1000, height: 600 };
    private dpr = 1;
    private frame = 0;
    private dirty = true;
    private previous?: Parameters<typeof shouldRedraw>[0];
    private lastTicker = '';
    private lastCells?: CellData[];
    private lastStacks?: State['stacks'];
    private lastTs = 0;
    private lastPerf: number | null = null;
    private lastNowMs = 0;
    private lastCenterPrice = 0;
    private lastMetrics: CameraMetrics | null = null;
    private lastHud: BoardHudState = { following: true, zoomed: false };
    private reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    private observer: ResizeObserver;
    private el: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private flash: () => BoardScene['flash'];
    private onHudChange?: (hud: BoardHudState) => void;

    constructor(
        el: HTMLCanvasElement,
        ctx: CanvasRenderingContext2D,
        flash: () => BoardScene['flash'],
        onHudChange?: (hud: BoardHudState) => void,
    ) {
        this.el = el;
        this.ctx = ctx;
        this.flash = flash;
        this.onHudChange = onHudChange;
        this.observer = new ResizeObserver(this.resize);
        this.observer.observe(el);
        this.resize();
        document.addEventListener('visibilitychange', this.visibility);
        if (!document.hidden)
            this.frame = requestAnimationFrame(this.render);
    }

    get isFollowing(): boolean {
        return this.camera.isFollowing;
    }

    get isZoomed(): boolean {
        return this.camera.isZoomed;
    }

    beginDrag(): void {
        if (!this.lastMetrics) return;
        this.camera.beginDrag(this.lastNowMs, this.lastCenterPrice);
        this.dirty = true;
    }

    dragBy(dxPx: number, dyPx: number): void {
        if (!this.lastMetrics) return;
        this.camera.dragBy(dxPx, dyPx, this.lastMetrics, this.lastNowMs, this.lastCenterPrice);
        this.dirty = true;
        this.emitHud();
    }

    endDrag(vxPxPerMs: number, vyPxPerMs: number): void {
        if (!this.lastMetrics) return;
        this.camera.endDrag(
            vxPxPerMs,
            vyPxPerMs,
            this.lastMetrics,
            this.lastNowMs,
            this.lastCenterPrice,
            !!this.reduced?.matches,
        );
        this.dirty = true;
        this.emitHud();
    }

    panBy(dxPx: number, dyPx: number): void {
        if (!this.lastMetrics) return;
        this.camera.panByPx(dxPx, dyPx, this.lastMetrics, this.lastNowMs, this.lastCenterPrice);
        this.dirty = true;
        this.emitHud();
    }

    zoomAt(factor: number, canvasX: number, canvasY: number): void {
        if (!this.lastMetrics) return;
        this.camera.zoomAt(
            factor,
            canvasX,
            canvasY,
            this.lastMetrics,
            this.lastNowMs,
            this.lastCenterPrice,
        );
        this.dirty = true;
        this.emitHud();
    }

    snapToLive(): void {
        const perfNow = this.lastPerf ?? performance.now();
        this.camera.snapToLive(perfNow, this.lastNowMs, this.lastCenterPrice, !!this.reduced?.matches);
        this.dirty = true;
        this.emitHud();
    }

    hitTest(clientX: number, clientY: number): { cell: CellData; tappable: boolean } | null {
        const v = this.viewport;
        if (!v) return null;
        const r = this.el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return null;
        const x = (clientX - r.left) * v.width / r.width;
        const y = (clientY - r.top) * v.height / r.height;
        const s = useGameStore.getState();
        const cells = s.cells.filter(c => c.original.ticker === s.ticker).map(c => ({ ...bounds(c), cell: c }));
        const hit = hitTestCell(v, cells, x, y);
        if (!hit) return null;
        const nowMs = Date.now() + s.serverTimeOffset;
        const tappable =
            hit.cell.status === 'active' &&
            !isLocked(hit.startTs, nowMs) &&
            !s.feedStale[s.ticker];
        return { cell: hit.cell, tappable };
    }

    cellCenter(cellId: string): { x: number; y: number } | null {
        const state = useGameStore.getState();
        const cell = state.cells.find(c => c.id === cellId && c.original.ticker === state.ticker);
        const v = this.viewport;
        if (!cell || !v) return null;
        const rect = cellRect(v, bounds(cell));
        const x = rect.x + rect.w / 2;
        const y = rect.y + rect.h / 2;
        if (x < 0 || x > plotWidth(v) || y < 0 || y > plotHeight(v)) return null;
        const client = this.el.getBoundingClientRect();
        return { x: client.left + x * client.width / v.width, y: client.top + y * client.height / v.height };
    }

    dispose() {
        this.observer.disconnect();
        cancelAnimationFrame(this.frame);
        document.removeEventListener('visibilitychange', this.visibility);
    }

    private emitHud() {
        const following = this.camera.isFollowing;
        const zoomed = this.camera.isZoomed;
        if (following !== this.lastHud.following || zoomed !== this.lastHud.zoomed) {
            this.lastHud = { following, zoomed };
            this.onHudChange?.(this.lastHud);
        }
    }

    private resize = () => {
        const r = this.el.getBoundingClientRect();
        this.size = { width: r.width || 1000, height: r.height || 600 };
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.el.width = Math.round(this.size.width * this.dpr);
        this.el.height = Math.round(this.size.height * this.dpr);
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.dirty = true;
    };

    private visibility = () => {
        cancelAnimationFrame(this.frame);
        this.clock.reset();
        this.lastPerf = null;
        this.dirty = true;
        if (!document.hidden)
            this.frame = requestAnimationFrame(this.render);
    };

    private render = (perf: number) => {
        if (document.hidden)
            return;
        const state = useGameStore.getState(), now = this.clock.sample(Date.now() + state.serverTimeOffset, perf);
        state.expirePendingCoins(Date.now());
        this.draw(useGameStore.getState(), now, perf);
        this.frame = requestAnimationFrame(this.render);
    };

    private prepare(state: State, now: number, perf: number) {
        if (this.lastTicker !== state.ticker) {
            this.head.reset();
            this.drawn.reset();
            this.center.reset();
            this.camera.reset();
            this.lastTs = 0;
            this.lastTicker = state.ticker;
            this.dirty = true;
            this.emitHud();
        }
        const points = seriesFor(state.ticker).since(now - HISTORY_RETENTION_MS), latest = points.at(-1);
        const target = latest?.price ?? state.currentPrice;
        const gap = !!latest && latest.ts !== this.lastTs && this.lastTs > 0 && latest.ts - this.lastTs > 1200;
        if (latest)
            this.lastTs = latest.ts;
        const live = this.head.sample(target, perf, gap || !!this.reduced?.matches);
        const middle = this.center.sample(target, perf, !!this.reduced?.matches);

        let minSeriesPrice = live > 0 ? live : Infinity;
        let maxSeriesPrice = live > 0 ? live : -Infinity;
        for (const p of points) {
            if (p.price < minSeriesPrice) minSeriesPrice = p.price;
            if (p.price > maxSeriesPrice) maxSeriesPrice = p.price;
        }
        // Quoted future boxes set how far zooming out may go (every priced box fits, about 200 at most).
        const quotedRowKeys = new Set<string>();
        const quotedColKeys = new Set<number>();
        let maxQuotedEndTs = now;
        for (const c of state.cells) {
            if (c.original.ticker !== state.ticker) continue;
            if (c.timeWindowEnd > maxQuotedEndTs) maxQuotedEndTs = c.timeWindowEnd;
            if (c.timeWindowEnd > now) {
                quotedRowKeys.add(String(c.original.lowerPrice));
                quotedColKeys.add(c.timeWindowStart);
            }
            const lo = Number(c.original.lowerPrice);
            const hi = Number(c.original.upperPrice);
            if (Number.isFinite(lo) && lo < minSeriesPrice) minSeriesPrice = lo;
            if (Number.isFinite(hi) && hi > maxSeriesPrice) maxSeriesPrice = hi;
        }

        const scale = boardScale(
            this.size.width,
            this.size.height,
            window.innerWidth < PHONE_BREAKPOINT,
        );
        const metrics: CameraMetrics = {
            width: this.size.width,
            height: this.size.height,
            nowFraction: scale.nowFraction,
            priceStep: state.modePriceStep,
            cellPx: scale.cellPx,
            quotedRows: quotedRowKeys.size,
            quotedCols: quotedColKeys.size,
            rightGutter: scale.rightGutter,
            bottomGutter: scale.bottomGutter,
            minSeriesPrice: Number.isFinite(minSeriesPrice) ? minSeriesPrice : undefined,
            maxSeriesPrice: Number.isFinite(maxSeriesPrice) ? maxSeriesPrice : undefined,
        };
        const dtMs = this.lastPerf === null ? 0 : Math.max(0, perf - this.lastPerf);
        this.lastPerf = perf;
        this.lastNowMs = now;
        this.lastCenterPrice = middle;
        this.lastMetrics = metrics;

        const stepped = this.camera.step(perf, dtMs, now, middle, metrics, !!this.reduced?.matches);
        this.viewport = stepped.viewport;
        this.emitHud();
        return { v: stepped.viewport, live, target, points, moving: stepped.moving, isLive: stepped.isLive, maxQuotedEndTs };
    }

    private draw(state: State, now: number, perf: number) {
        const { v, live, target, points, moving, isLive, maxQuotedEndTs } = this.prepare(state, now, perf);
        const next = {
            pricePx: priceToY(v, live),
            second: Math.floor(now / 1000),
            timePx: (v.viewNowMs ?? now) / v.msPerPx,
        };
        const animating = Object.values(state.stacks).some(s => s.ticker === state.ticker && s.coins.some(c => Date.now() - (c.updatedAt ?? c.placedAt) < SETTLEMENT_DURATION_MS + 50));
        if (!this.dirty && !moving && this.lastCells === state.cells && this.lastStacks === state.stacks && this.previous && !shouldRedraw(this.previous, next) && Math.abs(live - target) < .000001 && !animating && !this.flash())
            return;
        const smoothed = this.drawn.sample(points, now, live, perf, !!this.reduced?.matches);
        const visibleLeftTs = xToTime(v, 0) - 2000;
        const visibleRightTs = Math.min(now, xToTime(v, plotWidth(v)) + 2000);
        const visiblePoints = decimateVisibleLine(smoothed, visibleLeftTs, visibleRightTs, v.msPerPx);
        const line = visiblePoints.map(p => ({ x: timeToX(v, p.ts), y: priceToY(v, p.price) }));
        const cells = visibleCells(state.cells, state.ticker, v);
        drawBoard(this.ctx, {
            viewport: v,
            cells,
            line,
            livePrice: live,
            priceStep: state.modePriceStep,
            stacks: state.stacks,
            flash: this.flash() ? { ...this.flash()!, untilMs: this.flash()!.untilMs + state.serverTimeOffset } : undefined,
            animationNowMs: Date.now(),
            reducedMotion: !!this.reduced?.matches,
            maxQuotedEndTs,
            dpr: this.dpr,
            themeMode: detectThemeMode(),
            isFollowing: isLive,
        });
        this.previous = next;
        this.dirty = false;
        this.lastCells = state.cells;
        this.lastStacks = state.stacks;
    }
}

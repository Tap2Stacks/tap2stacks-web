import { useGameStore, type CellData } from '../store';
import { bounds, drawBoard, type BoardScene } from './draw';
import { createChartClock } from './clock';
import { createSmoothValue } from './smooth';
import { cellRect, priceToY, timeToX, type BoardViewport } from './layout';
import { createDrawnSeries } from './drawnSeries';
import { visibleCells } from './retainedCells';
import { seriesFor, shouldRedraw } from './priceSeries';
type State = ReturnType<typeof useGameStore.getState>;
export class BoardRuntime {
    viewport: BoardViewport | null = null;
    private clock = createChartClock();
    private head = createSmoothValue();
    private drawn = createDrawnSeries();
    private center = createSmoothValue(400);
    private size = { width: 1000, height: 600 };
    private frame = 0;
    private dirty = true;
    private previous?: Parameters<typeof shouldRedraw>[0];
    private lastTicker = '';
    private lastCells?: CellData[];
    private lastStacks?: State['stacks'];
    private lastTs = 0;
    private reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    private observer: ResizeObserver;
    private el: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private flash: () => BoardScene['flash'];
    constructor(el: HTMLCanvasElement, ctx: CanvasRenderingContext2D, flash: () => BoardScene['flash']) {
        this.el = el; this.ctx = ctx; this.flash = flash;
        this.observer = new ResizeObserver(this.resize);
        this.observer.observe(el);
        this.resize();
        document.addEventListener('visibilitychange', this.visibility);
        if (!document.hidden)
            this.frame = requestAnimationFrame(this.render);
    }
    cellCenter(cellId: string): {x: number; y: number} | null {
        const state = useGameStore.getState();
        const cell = state.cells.find(c => c.id === cellId && c.original.ticker === state.ticker);
        const v = this.viewport;
        if (!cell || !v) return null;
        const rect = cellRect(v, bounds(cell));
        const x = rect.x + rect.w / 2;
        const y = rect.y + rect.h / 2;
        if (x < 0 || x > v.width || y < 0 || y > v.height) return null;
        const client = this.el.getBoundingClientRect();
        return {x: client.left + x * client.width / v.width, y: client.top + y * client.height / v.height};
    }
    dispose() { this.observer.disconnect(); cancelAnimationFrame(this.frame); document.removeEventListener('visibilitychange', this.visibility); }
    private resize = () => {
        const r = this.el.getBoundingClientRect();
        this.size = { width: r.width || 1000, height: r.height || 600 };
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.el.width = Math.round(this.size.width * dpr);
        this.el.height = Math.round(this.size.height * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.dirty = true;
    };
    private visibility = () => {
        cancelAnimationFrame(this.frame);
        this.clock.reset();
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
            this.lastTs = 0;
            this.lastTicker = state.ticker;
            this.dirty = true;
        }
        const points = seriesFor(state.ticker).since(now - 60000), latest = points.at(-1);
        const target = latest?.price ?? state.currentPrice;
        const gap = !!latest && latest.ts !== this.lastTs && this.lastTs > 0 && latest.ts - this.lastTs > 1200;
        if (latest)
            this.lastTs = latest.ts;
        const live = this.head.sample(target, perf, gap || !!this.reduced?.matches);
        const middle = this.center.sample(target, perf, !!this.reduced?.matches);
        // Six epoch-aligned windows can end almost 35 s from now. Keep the scale
        // fixed across column rolls so the entire curve never jumps horizontally.
        const v: BoardViewport = { ...this.size, nowMs: now, msPerPx: 35000 / (this.size.width * .7), centerPrice: middle, pricePerPx: state.modePriceStep * 20 / this.size.height };
        this.viewport = v;
        return { v, live, target, points };
    }
    private draw(state: State, now: number, perf: number) {
        const { v, live, target, points } = this.prepare(state, now, perf);
        const next = { pricePx: priceToY(v, live), second: Math.floor(now / 1000), timePx: now / v.msPerPx };
        const animating = Object.values(state.stacks).some(s => s.ticker === state.ticker && s.coins.some(c => Date.now() - (c.updatedAt ?? c.placedAt) < 650));
        if (!this.dirty && this.lastCells === state.cells && this.lastStacks === state.stacks && this.previous && !shouldRedraw(this.previous, next) && Math.abs(live - target) < .000001 && !animating && !this.flash())
            return;
        const smoothed = this.drawn.sample(points, now, live, perf, !!this.reduced?.matches);
        const line = smoothed.map(p => ({x: timeToX(v, p.ts), y: priceToY(v, p.price)}));
        const cells = visibleCells(state.cells, state.ticker, v);
        drawBoard(this.ctx, { viewport: v, cells, line, livePrice: live, stacks: state.stacks, flash: this.flash() ? {...this.flash()!, untilMs: this.flash()!.untilMs + state.serverTimeOffset} : undefined, animationNowMs: Date.now(), reducedMotion: !!this.reduced?.matches });
        this.previous = next;
        this.dirty = false;
        this.lastCells = state.cells;
        this.lastStacks = state.stacks;
    }
}

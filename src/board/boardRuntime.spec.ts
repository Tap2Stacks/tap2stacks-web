import { afterEach, expect, it, vi } from 'vitest';
import { BoardRuntime } from './boardRuntime';
import * as drawModule from './draw';
import { plotWidth, priceToY, timeToX } from './layout';
import { useGameStore } from '../store';
import { recordingContext } from '../test/recordingContext';
import { testCell } from './fixtures';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('caps DPR, keeps all quoted columns visible before right gutter, pauses hidden frames and resumes', () => {
    let frame: FrameRequestCallback = () => { }, hidden = false;
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { frame = cb; return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('ResizeObserver', class { observe() { } disconnect() { } });
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    vi.spyOn(Date, 'now').mockReturnValue(10000);
    vi.stubGlobal('devicePixelRatio', 3);
    const el = document.createElement('canvas');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ width: 1000, height: 600 } as DOMRect);
    useGameStore.setState({ ticker: 'NVDA', currentPrice: 155, cells: [testCell({ timeWindowEnd: 45000 })], stacks: {}, serverTimeOffset: 0 });
    const runtime = new BoardRuntime(el, recordingContext().ctx, () => undefined);
    try {
        frame(0);
        expect(el.width).toBe(2000);
        const vp = runtime.viewport!;
        expect(vp.rightGutter).toBeGreaterThan(0);
        // Square 84 px boxes: one 5 s column is 84 px wide, NOW sits at 38% of the plot
        expect(timeToX(vp, 15000) - timeToX(vp, 10000)).toBeCloseTo(84, 6);
        expect(timeToX(vp, 10000)).toBeCloseTo(plotWidth(vp) * 0.38, 6);
        hidden = true;
        document.dispatchEvent(new Event('visibilitychange'));
        const count = vi.mocked(requestAnimationFrame).mock.calls.length;
        frame(16);
        expect(requestAnimationFrame).toHaveBeenCalledTimes(count);
        hidden = false;
        document.dispatchEvent(new Event('visibilitychange'));
        expect(requestAnimationFrame).toHaveBeenCalledTimes(count + 1);
    } finally {
        runtime.dispose();
    }
});

it('keeps historical x coordinates continuous as the six-column quote horizon rolls', () => {
    let frame: FrameRequestCallback = () => { };
    let wall = 14999;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frame = cb; return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => { });
    vi.stubGlobal('ResizeObserver', class { observe() { } disconnect() { } });
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(Date, 'now').mockImplementation(() => wall);
    const el = document.createElement('canvas');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ width: 1000, height: 600 } as DOMRect);
    useGameStore.setState({ ticker: 'NVDA', currentPrice: 155, cells: [testCell({ timeWindowEnd: 45000 })], stacks: {}, serverTimeOffset: 0 });
    const runtime = new BoardRuntime(el, recordingContext().ctx, () => undefined);
    try {
        frame(0);
        const before = timeToX(runtime.viewport!, 5000);
        wall = 15000;
        useGameStore.setState({ cells: [testCell({ timeWindowEnd: 50000 })] });
        frame(1);
        expect(Math.abs(timeToX(runtime.viewport!, 5000) - before)).toBeLessThan(.1);
    } finally {
        runtime.dispose();
    }
});

it('cellCenter returns client coordinates only for visible cells of the current ticker', () => {
    let frame: FrameRequestCallback = () => { };
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frame = cb; return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => { });
    vi.stubGlobal('ResizeObserver', class { observe() { } disconnect() { } });
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(Date, 'now').mockReturnValue(10000);
    const el = document.createElement('canvas');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ left: 40, top: 80, width: 1000, height: 600 } as DOMRect);
    const visible = testCell();
    const other = testCell({ id: 'other', original: { ...visible.original, ticker: 'TSLA' } });
    const hidden = testCell({ id: 'hidden', original: { ...visible.original, lowerPrice: '900', upperPrice: '901' } });
    useGameStore.setState({ ticker: 'NVDA', currentPrice: 155, cells: [visible, other, hidden], stacks: {}, serverTimeOffset: 0 });
    const runtime = new BoardRuntime(el, recordingContext().ctx, () => undefined);
    try {
        expect(runtime.cellCenter(visible.id)).toBeNull();
        frame(0);
        const vp = runtime.viewport!;
        const expectedX = 40 + (timeToX(vp, 15000) + timeToX(vp, 20000)) / 2;
        const expectedY = 80 + (priceToY(vp, 155.03) + priceToY(vp, 155.00)) / 2;
        expect(runtime.cellCenter(visible.id)?.x).toBeCloseTo(expectedX, 2);
        expect(runtime.cellCenter(visible.id)?.y).toBeCloseTo(expectedY, 2);
        expect(runtime.cellCenter(other.id)).toBeNull();
        expect(runtime.cellCenter(hidden.id)).toBeNull();
        expect(runtime.cellCenter('missing')).toBeNull();
    } finally {
        runtime.dispose();
    }
});

it('keeps the same square 60 px phone boxes when switching between a 24-window and a 6-window ticker', () => {
    let frame: FrameRequestCallback = () => { };
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frame = cb; return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => { });
    vi.stubGlobal('ResizeObserver', class { observe() { } disconnect() { } });
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(Date, 'now').mockReturnValue(10000);
    const el = document.createElement('canvas');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ width: 375, height: 536 } as DOMRect);
    vi.stubGlobal('innerWidth', 375);

    const nvda24 = Array.from({ length: 24 }, (_, i) => {
        const startTs = 10000 + i * 5000;
        return testCell({
            id: `NVDA:${startTs}:${startTs + 5000}:155.00:155.03`,
            timeWindowStart: startTs,
            timeWindowEnd: startTs + 5000,
            original: { ...testCell().original, ticker: 'NVDA', startTs, endTs: startTs + 5000 },
        });
    });
    const tsla6 = Array.from({ length: 6 }, (_, i) => {
        const startTs = 10000 + i * 5000;
        return testCell({
            id: `TSLA:${startTs}:${startTs + 5000}:250.00:250.08`,
            timeWindowStart: startTs,
            timeWindowEnd: startTs + 5000,
            priceLevel: 250.04,
            original: { ...testCell().original, ticker: 'TSLA', startTs, endTs: startTs + 5000, lowerPrice: '250.00', upperPrice: '250.08' },
        });
    });

    useGameStore.setState({ ticker: 'NVDA', currentPrice: 155, cells: [...nvda24, ...tsla6], stacks: {}, serverTimeOffset: 0 });
    const runtime = new BoardRuntime(el, recordingContext().ctx, () => undefined);
    try {
        frame(0);
        const nvdaVp = runtime.viewport!;
        expect(timeToX(nvdaVp, nvdaVp.nowMs + 5000) - timeToX(nvdaVp, nvdaVp.nowMs)).toBeCloseTo(60, 6);
        expect(timeToX(nvdaVp, nvdaVp.nowMs)).toBeCloseTo(plotWidth(nvdaVp) * 0.35, 6);

        useGameStore.setState({ ticker: 'TSLA', currentPrice: 250.04 });
        frame(16);
        const tslaVp = runtime.viewport!;
        expect(timeToX(tslaVp, tslaVp.nowMs + 5000) - timeToX(tslaVp, tslaVp.nowMs)).toBeCloseTo(60, 6);
        expect(timeToX(tslaVp, tslaVp.nowMs)).toBeCloseTo(plotWidth(tslaVp) * 0.35, 6);
    } finally {
        runtime.dispose();
    }
});

it('setHover fades hover alpha in over ~120 ms on open cells, clears on locked/empty/ticker-switch, and snaps under reduced motion', () => {
    let frame: FrameRequestCallback = () => { };
    let wall = 10000;
    let reducedMatches = false;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frame = cb; return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => { });
    vi.stubGlobal('ResizeObserver', class { observe() { } disconnect() { } });
    vi.stubGlobal('matchMedia', () => ({ matches: reducedMatches }) as MediaQueryList);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(Date, 'now').mockImplementation(() => wall);

    const drawSpy = vi.spyOn(drawModule, 'drawBoard');
    const el = document.createElement('canvas');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 1000, height: 600 } as DOMRect);
    const openCell = testCell({ id: 'open-1', timeWindowStart: 15000, timeWindowEnd: 20000 });
    const lockedCell = testCell({ id: 'locked-1', timeWindowStart: 11000, timeWindowEnd: 16000 });
    useGameStore.setState({ ticker: 'NVDA', currentPrice: 155, cells: [openCell, lockedCell], stacks: {}, serverTimeOffset: 0 });

    const runtime = new BoardRuntime(el, recordingContext().ctx, () => undefined);
    try {
        frame(0);
        const vp = runtime.viewport!;
        const openX = (timeToX(vp, 15000) + timeToX(vp, 20000)) / 2;
        const openY = (priceToY(vp, 155.03) + priceToY(vp, 155.00)) / 2;
        runtime.setHover(openX, openY);
        for (let t = 16; t <= 200; t += 16) {
            frame(t);
        }
        const hoveredScene = drawSpy.mock.calls.at(-1)?.[1];
        expect(hoveredScene?.hover?.cellId).toBe('open-1');
        expect(hoveredScene?.hover?.alpha).toBeGreaterThanOrEqual(0.95);

        runtime.clearHover();
        for (let t = 216; t <= 600; t += 16) {
            frame(t);
        }
        expect(drawSpy.mock.calls.at(-1)?.[1].hover).toBeUndefined();

        runtime.setHover(openX, openY);
        frame(620);
        expect(drawSpy.mock.calls.at(-1)?.[1].hover?.cellId).toBe('open-1');
        const lockedX = timeToX(vp, 11500);
        runtime.setHover(lockedX, openY);
        for (let t = 636; t <= 1000; t += 16) {
            frame(t);
        }
        expect(drawSpy.mock.calls.at(-1)?.[1].hover).toBeUndefined();

        runtime.setHover(openX, openY);
        frame(1020);
        expect(drawSpy.mock.calls.at(-1)?.[1].hover?.cellId).toBe('open-1');
        useGameStore.setState({ ticker: 'TSLA' });
        frame(1036);
        expect(drawSpy.mock.calls.at(-1)?.[1].hover).toBeUndefined();
    } finally {
        runtime.dispose();
    }

    reducedMatches = true;
    drawSpy.mockClear();
    useGameStore.setState({ ticker: 'NVDA', currentPrice: 155, cells: [openCell], stacks: {}, serverTimeOffset: 0 });
    const reducedRuntime = new BoardRuntime(el, recordingContext().ctx, () => undefined);
    try {
        frame(0);
        const vp = reducedRuntime.viewport!;
        const openX = (timeToX(vp, 15000) + timeToX(vp, 20000)) / 2;
        const openY = (priceToY(vp, 155.03) + priceToY(vp, 155.00)) / 2;
        reducedRuntime.setHover(openX, openY);
        frame(16);
        expect(drawSpy.mock.calls.at(-1)?.[1].hover).toEqual({ cellId: 'open-1', alpha: 1 });
        reducedRuntime.clearHover();
        frame(32);
        expect(drawSpy.mock.calls.at(-1)?.[1].hover).toBeUndefined();
    } finally {
        reducedRuntime.dispose();
    }
});

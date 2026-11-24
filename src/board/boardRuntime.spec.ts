import { afterEach, expect, it, vi } from 'vitest';
import { BoardRuntime } from './boardRuntime';
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
        expect(timeToX(vp, 45000)).toBeCloseTo(plotWidth(vp));
        // Default zoom exposes 30-40 s of history to the left of NOW
        expect(timeToX(vp, 10000 - 35000)).toBeCloseTo(0);
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
        expect(timeToX(runtime.viewport!, 50000)).toBeCloseTo(plotWidth(runtime.viewport!));
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

it('switches cleanly between 24-window NVDA (~60 s default future) and 6-window TSLA (~35 s default future)', () => {
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
        // NVDA with 24 windows shows ~60 s ahead at 375 px
        expect(timeToX(nvdaVp, 10000 + 60_000)).toBeCloseTo(plotWidth(nvdaVp), 1);

        // Switching to TSLA (6 windows) resets horizon to 32 s on phone
        useGameStore.setState({ ticker: 'TSLA', currentPrice: 250.04 });
        frame(16);
        const tslaVp = runtime.viewport!;
        expect(timeToX(tslaVp, tslaVp.nowMs + 32_000)).toBeCloseTo(plotWidth(tslaVp), 1);
    } finally {
        runtime.dispose();
    }
});

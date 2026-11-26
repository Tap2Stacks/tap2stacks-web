import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { BoardCanvas } from './BoardCanvas';
import { BoardRuntime } from './boardRuntime';
import { useGameStore } from '../store';
import { fetchRecentPrices } from '../api/prices';
import { recordingContext } from '../test/recordingContext';
import { testCell } from './fixtures';
import { seriesFor } from './priceSeries';

vi.mock('../api/prices', () => ({ fetchRecentPrices: vi.fn(async () => ({ prevDayPx: null, points: [{ ts: 9000, price: 155 }] })) }));

let cleanup = () => { };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function pointerEvent(type: string, opts: { clientX: number; clientY: number; pointerId?: number }) {
    const ev = new MouseEvent(type, { bubbles: true, clientX: opts.clientX, clientY: opts.clientY });
    Object.defineProperty(ev, 'pointerId', { value: opts.pointerId ?? 1 });
    return ev;
}

function setupBoard() {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('ResizeObserver', class {
        observe() { }
        disconnect() { }
    });
    let frame: FrameRequestCallback = () => { };
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frame = cb; return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => { });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(recordingContext().ctx);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 1000, height: 600, left: 0, top: 0 } as DOMRect);
    vi.spyOn(Date, 'now').mockReturnValue(10000);
    const cell = testCell();
    useGameStore.setState({ ticker: 'NVDA', cells: [cell], currentPrice: 155, serverTimeOffset: 0 });
    const div = document.createElement('div');
    document.body.append(div);
    const root = createRoot(div);
    const tap = vi.fn();
    cleanup = () => { act(() => root.unmount()); div.remove(); };
    return { div, root, tap, cell, step: (perf = 0) => act(() => frame(perf)) };
}

it('BoardCanvas seeds recent prices on mount and ticker change; open taps work and locked taps do not', async () => {
    const { div, root, tap, cell, step } = setupBoard();
    await act(async () => root.render(<BoardCanvas onTapCell={tap} />));
    step(0);
    expect(fetchRecentPrices).toHaveBeenCalledWith('NVDA');
    expect(seriesFor('NVDA').since(0)).toContainEqual({ ts: 9000, price: 155 });
    const canvas = div.querySelector('canvas')!;
    // With nowFraction=0.38, rightGutter=58 (plotWidth=942), bottomGutter=20 (plotHeight=580) and 84 px
    // square boxes, testCell (15s..20s, 155.00..155.03) spans x=442..526, y=206..290.
    act(() => {
        canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 484, clientY: 248 }));
        canvas.dispatchEvent(pointerEvent('pointerup', { clientX: 484, clientY: 248 }));
    });
    expect(tap).toHaveBeenCalledWith(cell);
    useGameStore.setState({ cells: [testCell({ timeWindowStart: 11000 })] });
    act(() => {
        canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 510, clientY: 276 }));
        canvas.dispatchEvent(pointerEvent('pointerup', { clientX: 510, clientY: 276 }));
    });
    expect(tap).toHaveBeenCalledTimes(1);
    await act(async () => useGameStore.setState({ ticker: 'TSLA' }));
    expect(fetchRecentPrices).toHaveBeenCalledWith('TSLA');
});

it('dragging pans without firing tap, shows Live button, and Live button / double-tap snaps back', async () => {
    const { div, root, tap, step } = setupBoard();
    await act(async () => root.render(<BoardCanvas onTapCell={tap} />));
    step(0);
    const canvas = div.querySelector('canvas')!;
    expect(div.querySelector('button[aria-label="Return to live view"]')).toBeNull();

    // Drag across an open cell: must NOT fire tap, MUST reveal Live button
    act(() => {
        canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 450, clientY: 285 }));
        canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 520, clientY: 285 }));
        canvas.dispatchEvent(pointerEvent('pointerup', { clientX: 520, clientY: 285 }));
    });
    expect(tap).not.toHaveBeenCalled();
    const liveBtn = div.querySelector('button[aria-label="Return to live view"]') as HTMLButtonElement;
    expect(liveBtn).not.toBeNull();

    // Clicking Live snaps back and hides the button once settled
    act(() => liveBtn.click());
    step(500);
    expect(div.querySelector('button[aria-label="Return to live view"]')).toBeNull();

    // Drag away again, then double-tap in the past area to snap back
    act(() => {
        canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 200, clientY: 300 }));
        canvas.dispatchEvent(pointerEvent('pointermove', { clientX: 350, clientY: 300 }));
        canvas.dispatchEvent(pointerEvent('pointerup', { clientX: 350, clientY: 300 }));
    });
    expect(div.querySelector('button[aria-label="Return to live view"]')).not.toBeNull();

    act(() => {
        canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 300 }));
        canvas.dispatchEvent(pointerEvent('pointerup', { clientX: 100, clientY: 300 }));
        canvas.dispatchEvent(pointerEvent('pointerdown', { clientX: 102, clientY: 301 }));
        canvas.dispatchEvent(pointerEvent('pointerup', { clientX: 102, clientY: 301 }));
    });
    step(1000);
    expect(div.querySelector('button[aria-label="Return to live view"]')).toBeNull();
});

it('wheel zoom and two-finger pinch zoom never fire cell taps', async () => {
    const { div, root, tap, step } = setupBoard();
    await act(async () => root.render(<BoardCanvas onTapCell={tap} />));
    step(0);
    const canvas = div.querySelector('canvas')!;

    // Wheel zoom in reveals Live reset affordance (with one quoted box everything already fits, so zoom-out has no room)
    act(() => {
        canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -240, clientX: 450, clientY: 285 }));
    });
    expect(div.querySelector('button[aria-label="Return to live view"]')).not.toBeNull();

    // Two-finger pinch over an open cell does not tap
    act(() => {
        canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 1, clientX: 440, clientY: 285 }));
        canvas.dispatchEvent(pointerEvent('pointerdown', { pointerId: 2, clientX: 480, clientY: 285 }));
        canvas.dispatchEvent(pointerEvent('pointermove', { pointerId: 2, clientX: 540, clientY: 285 }));
        canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 2, clientX: 540, clientY: 285 }));
        canvas.dispatchEvent(pointerEvent('pointerup', { pointerId: 1, clientX: 440, clientY: 285 }));
    });
    expect(tap).not.toHaveBeenCalled();
});

it('a sideways trackpad swipe pans, and a vertical wheel zooms both directions with one factor', async () => {
    const { div, root, tap, step } = setupBoard();
    const pan = vi.spyOn(BoardRuntime.prototype, 'panBy');
    const zoom = vi.spyOn(BoardRuntime.prototype, 'zoomAt');
    await act(async () => root.render(<BoardCanvas onTapCell={tap} />));
    step(0);
    const canvas = div.querySelector('canvas')!;

    act(() => {
        canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 40, deltaY: 2, clientX: 450, clientY: 285 }));
    });
    expect(pan).toHaveBeenCalledTimes(1);
    expect(zoom).not.toHaveBeenCalled();

    act(() => {
        canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -120, shiftKey: true, clientX: 450, clientY: 285 }));
    });
    expect(zoom).toHaveBeenCalledTimes(1);
    const args = zoom.mock.calls[0];
    expect(args).toHaveLength(3);
    expect(args[0]).toBeGreaterThan(1);
});

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { BoardCanvas } from './BoardCanvas';
import { useGameStore } from '../store';
import { fetchRecentPrices } from '../api/prices';
import { recordingContext } from '../test/recordingContext';
import { testCell } from './fixtures';
import { seriesFor } from './priceSeries';
vi.mock('../api/prices', () => ({ fetchRecentPrices: vi.fn(async () => ({ prevDayPx: null, points: [{ ts: 9000, price: 155 }] })) }));
let cleanup = () => { };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('BoardCanvas seeds recent prices on mount and ticker change; open taps work and locked taps do not', async () => {
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
    await act(async () => root.render(<BoardCanvas onTapCell={tap}/>));
    act(() => frame(0));
    expect(fetchRecentPrices).toHaveBeenCalledWith('NVDA');
    expect(seriesFor('NVDA').since(0)).toContainEqual({ ts: 9000, price: 155 });
    const canvas = div.querySelector('canvas')!;
    act(() => canvas.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 450, clientY: 285 })));
    expect(tap).toHaveBeenCalledWith(cell);
    useGameStore.setState({ cells: [testCell({ timeWindowStart: 11000 })] });
    act(() => canvas.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 350, clientY: 285 })));
    expect(tap).toHaveBeenCalledTimes(1);
    await act(async () => useGameStore.setState({ ticker: 'TSLA' }));
    expect(fetchRecentPrices).toHaveBeenCalledWith('TSLA');
});

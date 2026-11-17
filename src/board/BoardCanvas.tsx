import { useEffect, useLayoutEffect, useRef } from 'react';
import { useGameStore, type CellData } from '../store';
import { fetchRecentPrices } from '../api/prices';
import { onPrice } from '../realtime/bus';
import { bounds, type BoardScene } from './draw';
import { hitTestCell, isLocked } from './layout';
import { seriesFor } from './priceSeries';
import { useStackRecovery } from './useStackRecovery';
import { BoardRuntime } from './boardRuntime';
export function BoardCanvas({ onTapCell, flash }: {
    onTapCell: (cell: CellData) => void;
    flash?: BoardScene['flash'];
}) {
    useStackRecovery();
    const canvas = useRef<HTMLCanvasElement>(null), runtime = useRef<BoardRuntime | null>(null);
    const flashRef = useRef(flash);
    useLayoutEffect(() => { flashRef.current = flash; }, [flash]);
    const ticker = useGameStore(s => s.ticker);
    useEffect(() => { let alive = true; void fetchRecentPrices(ticker).then(data => { if (alive)
        seriesFor(ticker).seed(data.points); }); return () => { alive = false; }; }, [ticker]);
    useEffect(() => onPrice((t, ts, price) => seriesFor(t).push(ts, price)), []);
    useEffect(() => {
        const el = canvas.current!, ctx = el.getContext('2d');
        if (!ctx)
            return;
        const board = new BoardRuntime(el, ctx, () => flashRef.current);
        runtime.current = board;
        return () => { board.dispose(); runtime.current = null; };
    }, []);
    return <canvas ref={canvas} aria-label="Live price and tap board" style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }} onPointerDown={event => {
            const v = runtime.current?.viewport;
            if (!v)
                return;
            const s = useGameStore.getState(), r = event.currentTarget.getBoundingClientRect();
            const cells = s.cells.filter(c => c.original.ticker === s.ticker).map(c => ({ ...bounds(c), cell: c }));
            const hit = hitTestCell(v, cells, (event.clientX - r.left) * v.width / r.width, (event.clientY - r.top) * v.height / r.height);
            if (hit && hit.cell.status === 'active' && !isLocked(hit.startTs, Date.now() + s.serverTimeOffset) && !s.feedStale[s.ticker])
                onTapCell(hit.cell);
        }}/>;
}

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useGameStore, type CellData } from '../store';
import { bounds, type BoardScene } from './draw';
import { hitTestCell, isLocked } from './layout';
import { usePriceSeries } from './usePriceSeries';
import { useStackRecovery } from './useStackRecovery';
import { registerBoardCenters } from './centers';
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
    usePriceSeries(ticker);
    useEffect(() => {
        const el = canvas.current!, ctx = el.getContext('2d');
        if (!ctx)
            return;
        const board = new BoardRuntime(el, ctx, () => flashRef.current);
        runtime.current = board;
        const unregister = registerBoardCenters(id => board.cellCenter(id));
        return () => { unregister(); board.dispose(); runtime.current = null; };
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

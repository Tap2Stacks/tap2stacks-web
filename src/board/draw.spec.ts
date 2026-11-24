import { describe, it, expect } from 'vitest';
import { drawBoard, type BoardScene } from './draw';
import { recordingContext } from '../test/recordingContext';
import { testCell } from './fixtures';
import { CellSpriteCache } from './cellSprites';
import { boardPalette } from './cellColor';

const scene: BoardScene = { viewport: { width: 1000, height: 600, nowMs: 10000, nowFraction: 0.3, msPerPx: 50, pricePerPx: .001, centerPrice: 155 }, cells: [testCell()], line: [{ x: 0, y: 300 }, { x: 300, y: 290 }], livePrice: 155.12, stacks: {} };

describe('drawBoard', () => {
    it('draws each open cell multiplier as x4.1 and price to 2 decimals', () => {
        const { ctx, calls } = recordingContext();
        drawBoard(ctx, scene);
        expect(calls.some(c => c.name === 'fillText' && c.args[0] === 'x4.1')).toBe(true);
        expect(calls.some(c => c.args[0] === '155.12')).toBe(true);
    });

    it('line uses bezierCurveTo, never lineTo between samples', () => {
        const { ctx, calls } = recordingContext();
        drawBoard(ctx, scene);
        expect(calls.some(c => c.name === 'bezierCurveTo')).toBe(true);
        expect(calls.some(c => c.name === 'lineTo')).toBe(false);
    });

    it('locked cells are drawn without heat and dimmed', () => {
        const { ctx, calls } = recordingContext();
        drawBoard(ctx, { ...scene, cells: [testCell({ timeWindowStart: 11000 })] });
        const lockedText = calls.find(c => c.name === 'fillText' && c.args[0] === 'x4.1');
        expect(lockedText?.alpha).toBe(0.3);
        // Locked tile starts at x = 300 + (11000-10000)/50 = 320
        const lockedTile = calls.find(c => c.name === 'fillRect' && Number(c.args[0]) >= 320 && Number(c.args[0]) < 330);
        expect(lockedTile?.alpha).toBe(0.3);
    });

    it('past cells show no odds at all while keeping coin stacks and results', () => {
        const { ctx, calls } = recordingContext();
        const pastCell = testCell({ timeWindowStart: 4000, timeWindowEnd: 9000 });
        drawBoard(ctx, {
            ...scene,
            cells: [pastCell],
            stacks: {
                [pastCell.id]: {
                    cellId: pastCell.id,
                    ticker: 'NVDA',
                    coins: ['a', 'b'].map(clientTapId => ({ clientTapId, amount: 5, rate: 4.1, status: 'open', placedAt: 0 })),
                },
            },
        });
        expect(calls.some(c => c.name === 'fillText' && c.args[0] === 'x4.1')).toBe(false);
        expect(calls.some(c => c.name === 'fillText' && c.args[0] === '$10')).toBe(true);
        expect(calls.some(c => c.name === 'fillText' && c.args[0] === 'x2')).toBe(true);

        calls.length = 0;
        const boundaryCell = testCell({ timeWindowStart: 5000, timeWindowEnd: 10000, status: 'past' });
        drawBoard(ctx, {
            ...scene,
            cells: [boundaryCell],
            stacks: {
                [boundaryCell.id]: {
                    cellId: boundaryCell.id,
                    ticker: 'NVDA',
                    coins: [{ clientTapId: 'a', amount: 5, rate: 4.1, status: 'void', placedAt: 0, updatedAt: 9900 }],
                },
            },
        });
        expect(calls.some(c => c.name === 'fillText' && c.args[0] === 'x4.1')).toBe(false);
        expect(calls.some(c => c.name === 'fillText' && c.args[0] === 'Refunded')).toBe(true);
    });

    it('fades far and high-multiplier cells smoothly while keeping cell tints stronger than faded text', () => {
        const { ctx, calls } = recordingContext();
        const nearCell = testCell({ id: 'near', multiplier: 3.2, timeWindowStart: 15000, timeWindowEnd: 20000 });
        const farCell = testCell({
            id: 'far',
            multiplier: 20,
            timeWindowStart: 40000,
            timeWindowEnd: 45000,
            original: { ...testCell().original, startTs: 40000, endTs: 45000, lowerPrice: '155.24', upperPrice: '155.27', rewardRate: '20' },
        });
        drawBoard(ctx, { ...scene, livePrice: 155.015, cells: [nearCell, farCell] });
        const nearText = calls.find(c => c.name === 'fillText' && c.args[0] === 'x3.2');
        const farText = calls.find(c => c.name === 'fillText' && c.args[0] === 'x20.0');
        const farTile = calls.find(c => c.name === 'fillRect' && Number(c.args[0]) > 850 && Number(c.args[2]) < 120);
        expect(nearText!.alpha).toBeGreaterThan(farText!.alpha);
        expect(farText!.alpha).toBeGreaterThanOrEqual(0.28);
        expect(farTile!.alpha).toBeGreaterThan(farText!.alpha);
        expect(farTile!.alpha).toBeLessThan(1);
    });

    it('uses pre-rendered cell sprites (drawImage) without shadowBlur when sprite cache is active', () => {
        const cache = new CellSpriteCache((w, h) => {
            const { ctx: sctx } = recordingContext();
            return { canvas: { width: w, height: h } as unknown as HTMLCanvasElement, ctx: sctx };
        });
        const { ctx, calls } = recordingContext();
        drawBoard(ctx, { ...scene, spriteCache: cache, dpr: 2 });
        expect(calls.some(c => c.name === 'drawImage')).toBe(true);
        expect(calls.some(c => c.name === 'lineTo')).toBe(false);
    });

    it('renders a clear not-open-yet state beyond quoted future windows', () => {
        const { ctx, calls } = recordingContext();
        drawBoard(ctx, {
            ...scene,
            viewport: { ...scene.viewport, msPerPx: 120 }, // shows ~84 s ahead
            maxQuotedEndTs: 40000, // only 30 s quoted -> 54 s unquoted gap visible
        });
        expect(calls.some(c => c.name === 'fillText' && c.args[0] === 'Not open yet')).toBe(true);
    });

    it('supports dark mode surface and ink palette cleanly', () => {
        const { ctx, calls } = recordingContext();
        drawBoard(ctx, { ...scene, themeMode: 'dark' });
        const bg = calls.find(c => c.name === 'fillRect' && c.args[0] === 0 && c.args[1] === 0);
        expect(bg?.fill).toBe(boardPalette('dark').surface);
    });

    it('draws left price-axis labels after the price curve with surface backing so labels stay readable', () => {
        const { ctx, calls } = recordingContext();
        drawBoard(ctx, scene);
        const curveIdx = calls.findIndex(c => c.name === 'bezierCurveTo');
        const axisLabelIdx = calls.findIndex(c => c.name === 'fillText' && c.args[0] === '155.03' && c.args[1] === 5);
        expect(curveIdx).toBeGreaterThan(-1);
        expect(axisLabelIdx).toBeGreaterThan(curveIdx);
        // Surface backing fill precedes the axis label text
        const backingFill = calls.slice(curveIdx, axisLabelIdx).some(c => c.name === 'fill' && c.fill === boardPalette('light').surface);
        expect(backingFill).toBe(true);
    });

    it('clips cells before the reserved right gutter and places the live price tag cleanly inside the gutter', () => {
        const { ctx, calls } = recordingContext();
        drawBoard(ctx, {
            ...scene,
            viewport: { ...scene.viewport, rightGutter: 58 },
        });
        // Clip rect restricts chart content to plotWidth = 942
        expect(calls.some(c => c.name === 'rect' && c.args[0] === 0 && c.args[2] === 942)).toBe(true);
        // Live price text is centered strictly inside the right gutter (x > 942)
        const liveText = calls.find(c => c.name === 'fillText' && c.args[0] === '155.12');
        expect(Number(liveText?.args[1])).toBeGreaterThan(942);
    });

    it('shows a compact arrow+price axis edge marker when panned into history instead of a full live tag over the chart', () => {
        const { ctx, calls } = recordingContext();
        drawBoard(ctx, {
            ...scene,
            isFollowing: false,
            viewport: { ...scene.viewport, viewNowMs: -50_000, rightGutter: 58 }, // panned 60 s back into history
        });
        // Right-edge arrow marker pointing toward live (155.12→)
        const marker = calls.find(c => c.name === 'fillText' && c.args[0] === '155.12→');
        expect(marker).toBeDefined();
        expect(Number(marker?.args[1])).toBeGreaterThan(942);
        // No full bare live tag text and no dashed reference line across history
        expect(calls.some(c => c.name === 'fillText' && c.args[0] === '155.12')).toBe(false);
        expect(calls.some(c => c.name === 'setLineDash' && Array.isArray(c.args[0]) && (c.args[0] as number[])[0] === 3)).toBe(false);

        // When panned far into the future (live off-screen left), shows left-edge marker (←155.12)
        calls.length = 0;
        drawBoard(ctx, {
            ...scene,
            isFollowing: false,
            viewport: { ...scene.viewport, viewNowMs: 80_000, rightGutter: 58 },
        });
        const leftMarker = calls.find(c => c.name === 'fillText' && c.args[0] === '←155.12');
        expect(leftMarker).toBeDefined();
        expect(Number(leftMarker?.args[1])).toBeLessThan(60);
    });

    it('suppresses half-cut odds labels and fades tiles clipped by the right gutter', () => {
        const { ctx, calls } = recordingContext();
        // plotWidth = 942, nowX = 942 * 0.3 = 282.6; cell at x = 892.6..992.6 is 50% clipped at right gutter
        const clippedCell = testCell({
            id: 'clipped',
            multiplier: 4.1,
            timeWindowStart: 10000 + Math.round((892.6 - 282.6) * 50),
            timeWindowEnd: 10000 + Math.round((992.6 - 282.6) * 50),
        });
        drawBoard(ctx, {
            ...scene,
            viewport: { ...scene.viewport, rightGutter: 58 },
            cells: [clippedCell],
        });
        expect(calls.some(c => c.name === 'fillText' && c.args[0] === 'x4.1')).toBe(false);
        // Tile still draws with reduced edge fade alpha
        const tileFill = calls.find(c => c.name === 'fillRect' && Number(c.args[0]) > 880 && Number(c.args[2]) < 120);
        expect(tileFill).toBeDefined();
        expect(tileFill!.alpha).toBeLessThan(0.5);
    });

    it('places NOW and time axis labels in a dedicated bottom lane strictly below the cell plot area', () => {
        const { ctx, calls } = recordingContext();
        drawBoard(ctx, {
            ...scene,
            viewport: { ...scene.viewport, rightGutter: 58, bottomGutter: 20 },
        });
        // Plot clip height stops at 580 (height - bottomGutter)
        expect(calls.some(c => c.name === 'rect' && c.args[0] === 0 && c.args[1] === 0 && c.args[2] === 942 && c.args[3] === 580)).toBe(true);
        // NOW label sits inside y in (580, 600) — never overlapping bottom row cells
        const nowLabel = calls.find(c => c.name === 'fillText' && c.args[0] === 'NOW');
        expect(nowLabel).toBeDefined();
        expect(Number(nowLabel?.args[2])).toBeGreaterThan(580);
        expect(Number(nowLabel?.args[2])).toBeLessThan(600);
    });

    it('omits Not open yet when 24 quoted windows already span the full 2-minute horizon', () => {
        const { ctx, calls } = recordingContext();
        drawBoard(ctx, {
            ...scene,
            viewport: { ...scene.viewport, msPerPx: 180, rightGutter: 58 },
            maxQuotedEndTs: scene.viewport.nowMs + 120_000,
        });
        expect(calls.some(c => c.name === 'fillText' && c.args[0] === 'Not open yet')).toBe(false);
    });
});

it('drawStack draws a count badge x3 and the total $15', () => {
    const { ctx, calls } = recordingContext();
    drawBoard(ctx, { ...scene, stacks: { [scene.cells[0].id]: { cellId: scene.cells[0].id, ticker: 'NVDA', coins: ['a', 'b', 'c'].map(clientTapId => ({ clientTapId, amount: 5, rate: 4.1, status: 'open', placedAt: 0 })) } } });
    expect(calls.some(c => c.args[0] === 'x3')).toBe(true);
    expect(calls.some(c => c.args[0] === '$15')).toBe(true);
});

it('animates settlements in local time despite server clock offset and fades pending additions', () => {
    const { ctx, calls } = recordingContext();
    const cell = scene.cells[0];
    const coins = ['a', 'b', 'c', 'd'].map((clientTapId, i) => ({ clientTapId, amount: 5, rate: 4.1, status: i === 3 ? 'pending' as const : 'open' as const, placedAt: 10000 }));
    drawBoard(ctx, { ...scene, viewport: { ...scene.viewport, nowMs: 70000 }, animationNowMs: 10100, stacks: { [cell.id]: { cellId: cell.id, ticker: 'NVDA', coins } } });
    expect(calls.some(c => c.name === 'ellipse' && c.alpha === .5)).toBe(true);
    calls.length = 0;
    drawBoard(ctx, { ...scene, viewport: { ...scene.viewport, nowMs: 70000 }, animationNowMs: 10100, stacks: { [cell.id]: { cellId: cell.id, ticker: 'NVDA', coins: coins.map(c => ({ ...c, status: 'lost', updatedAt: 10000 })) } } });
    expect(calls.some(c => c.args[0] === 'Missed')).toBe(true);
});

it('shows distinct outcomes on settled stacks without mislabeling mixed results', () => {
    const cell = scene.cells[0];
    for (const [statuses, expected] of [[['won'], 'Won'], [['lost'], 'Missed'], [['won', 'lost'], 'Settled']] as const) {
        const { ctx, calls } = recordingContext();
        drawBoard(ctx, { ...scene, animationNowMs: 10100, stacks: { [cell.id]: { cellId: cell.id, ticker: 'NVDA', coins: statuses.map((status, i) => ({ clientTapId: String(i), amount: 5, rate: 4.1, status, placedAt: 9000, updatedAt: 10000 })) } } });
        expect(calls.some(c => c.name === 'fillText' && c.args[0] === expected)).toBe(true);
    }
});

it('gives the live point a quiet pulse without moving its price and respects reduced motion', () => {
    const animated = recordingContext();
    drawBoard(animated.ctx, scene);
    const still = recordingContext();
    drawBoard(still.ctx, { ...scene, reducedMotion: true });
    const animatedArcs = animated.calls.filter(c => c.name === 'arc');
    const stillArcs = still.calls.filter(c => c.name === 'arc');
    expect(animatedArcs).toHaveLength(stillArcs.length + 1);
    expect(animatedArcs[0].args.slice(0, 2)).toEqual(stillArcs[0].args.slice(0, 2));
});

it('keeps a mixed stack visible from its latest settlement, regardless of coin order', () => {
    const cell = scene.cells[0];
    const { ctx, calls } = recordingContext();
    drawBoard(ctx, {
        ...scene,
        animationNowMs: 10100,
        stacks: {
            [cell.id]: {
                cellId: cell.id,
                ticker: 'NVDA',
                coins: [
                    { clientTapId: 'a', amount: 5, rate: 4.1, status: 'won', placedAt: 1000, updatedAt: 10000 },
                    { clientTapId: 'b', amount: 5, rate: 4.1, status: 'lost', placedAt: 2000, updatedAt: 8000 },
                ],
            },
        },
    });
    expect(calls.some(c => c.name === 'fillText' && c.args[0] === 'Settled')).toBe(true);
});

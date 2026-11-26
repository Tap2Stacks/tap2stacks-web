import { describe, expect, it } from 'vitest';
import { THEME } from '../ui/theme';
import { recordingContext } from '../test/recordingContext';
import { boardPalette } from './cellColor';
import { TAIL_MS, drawLiveDot, drawPriceLine } from './drawLine';

describe('drawLine', () => {
    it('exports a 4 s gold tail window', () => {
        expect(TAIL_MS).toBe(4_000);
    });

    it('uses bezierCurveTo only, never lineTo, and paints a gold gradient tail over the last segment', () => {
        const { ctx, calls } = recordingContext();
        const bp = boardPalette('light');
        const line = [
            { x: 40, y: 310 },
            { x: 120, y: 300 },
            { x: 200, y: 295 },
            { x: 280, y: 280 },
            { x: 320, y: 270 },
        ];

        drawPriceLine(ctx, line, 200, bp);

        expect(calls.some((c) => c.name === 'bezierCurveTo')).toBe(true);
        expect(calls.some((c) => c.name === 'lineTo')).toBe(false);

        const gradients = calls.filter((c) => c.name === 'createLinearGradient');
        expect(gradients).toHaveLength(1);
        expect(gradients[0].args[0]).toBe(200);
        expect(gradients[0].args[2]).toBe(320);
        const stops = gradients[0].args[4] as { offset: number; color: string }[];
        expect(stops.some((s) => s.color === THEME.highlight)).toBe(true);

        const strokes = calls.filter((c) => c.name === 'stroke');
        expect(strokes).toHaveLength(2);
    });

    it('draws only the ink curve when all samples fall before tailStartX', () => {
        const { ctx, calls } = recordingContext();
        const bp = boardPalette('dark');
        const line = [
            { x: 20, y: 310 },
            { x: 90, y: 290 },
        ];

        drawPriceLine(ctx, line, 200, bp);

        expect(calls.some((c) => c.name === 'createLinearGradient')).toBe(false);
        expect(calls.filter((c) => c.name === 'stroke')).toHaveLength(1);
    });

    it('drawLiveDot draws a pulsing gold radial halo (~14 px) that holds steady under reduced motion', () => {
        const bp = boardPalette('light');

        const { ctx: c1, calls: calls1 } = recordingContext();
        drawLiveDot(c1, 300, 250, 0, false, bp);
        const { ctx: c2, calls: calls2 } = recordingContext();
        drawLiveDot(c2, 300, 250, 800, false, bp);

        const g1 = calls1.find((c) => c.name === 'createRadialGradient');
        const g2 = calls2.find((c) => c.name === 'createRadialGradient');
        expect(g1).toBeDefined();
        expect(g2).toBeDefined();
        expect(Number(g1!.args[5])).toBeGreaterThanOrEqual(11);
        expect(Number(g2!.args[5])).toBeGreaterThan(Number(g1!.args[5]));

        const { ctx: r1, calls: rCalls1 } = recordingContext();
        drawLiveDot(r1, 300, 250, 0, true, bp);
        const { ctx: r2, calls: rCalls2 } = recordingContext();
        drawLiveDot(r2, 300, 250, 800, true, bp);

        const rg1 = rCalls1.find((c) => c.name === 'createRadialGradient');
        const rg2 = rCalls2.find((c) => c.name === 'createRadialGradient');
        expect(Number(rg1!.args[5])).toBeCloseTo(14, 1);
        expect(Number(rg2!.args[5])).toBeCloseTo(14, 1);

        const dotFill = rCalls1.filter((c) => c.name === 'fill').at(-1);
        expect(dotFill?.fill).toBe(bp.ink);
    });
});

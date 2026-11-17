import { expect, it } from "vitest";
import { smoothDrawnHistory, rawPriceAt, createDrawnSeries } from "./drawnSeries";
import type { PriceSample } from "./priceSeries";
const step: PriceSample[] = Array.from({ length: 10 }, (_, i) => ({ ts: i * 1000, price: i < 4 ? 154 : 154.01 }));
it("a 1-cent step held for 3 s has no flat run followed by a jump steeper than 0.0075 dollars per second", () => {
    const line = smoothDrawnHistory(step, 9000, 154.01);
    const slopes = line.slice(1).map((p, i) => Math.abs(p.price - line[i].price) / (p.ts - line[i].ts) * 1000);
    expect(Math.max(...slopes)).toBeLessThan(0.0075);
    expect(line.some(p => p.ts === 3200 && p.price > 154)).toBe(true);
});
it("smoothed line stays within 1 cent of the raw segment path, including sharp reversals", () => {
    const points = [154, 154, 154.01, 154, 154.2, 154.1, 154.1, 154.11].map((price, i) => ({ ts: i * 1000, price }));
    for (const p of smoothDrawnHistory(points, 7000, 154.11))
        expect(Math.abs(p.price - rawPriceAt(points, p.ts))).toBeLessThanOrEqual(0.010000001);
});
it("centered smoothing shifts monotone crossings by at most 500 ms", () => {
    const line = smoothDrawnHistory(step, 9000, 154.01);
    for (const price of [154.002, 154.005, 154.008]) {
        const crossing = line.findIndex(p => p.price >= price);
        const a = line[crossing - 1], b = line[crossing];
        const actual = a.ts + (price - a.price) / (b.price - a.price) * (b.ts - a.ts);
        const raw = 3000 + (price - 154) / 0.01 * 1000;
        expect(Math.abs(actual - raw)).toBeLessThanOrEqual(500);
    }
});
it("appending a sample cannot move points older than 2 s by more than 0.5 px", () => {
    const before = smoothDrawnHistory(step.slice(0, -1), 8000, 154.01);
    const after = smoothDrawnHistory([...step.slice(0, -1), { ts: 9000, price: 154.1 }], 9000, 154.1);
    for (const a of before.filter(p => p.ts < 7000)) {
        const b = after.find(p => p.ts === a.ts)!;
        expect(Math.abs(a.price - b.price) / 0.00075).toBeLessThanOrEqual(0.5);
    }
});
it("the eased head is exact, receives a tangent-continuous tail, and new quotes do not jump existing tail points", () => {
    const series = createDrawnSeries();
    const before = series.sample(step.slice(0, -1), 8500, 154.01, 0);
    const after = series.sample([...step.slice(0, -1), { ts: 8500, price: 154.02 }], 8500, 154.01, 0);
    expect(after.at(-1)).toEqual({ ts: 8500, price: 154.01 });
    for (const a of before.filter(p => p.ts > 6500 && p.ts < 8500))
        expect(after.find(p => p.ts === a.ts)?.price).toBeCloseTo(a.price, 8);
});
it("multi-step 1-cent staircase flows smoothly through intermediate levels without flat shelves", () => {
    const staircase: PriceSample[] = [
        154.02, 154.02, 154.02, 154.01, 154.01, 154.01, 154.00, 154.00, 154.00,
    ].map((price, i) => ({ ts: i * 1000, price }));
    const line = smoothDrawnHistory(staircase, 8000, 154.00);
    const mid = line.filter(p => p.ts >= 2000 && p.ts <= 6000);
    for (let i = 1; i < mid.length; i++) {
        expect(mid[i].price).toBeLessThan(mid[i - 1].price);
    }
});
it("stays monotonic into the easing live dot when a new sample arrives ahead of the head", () => {
    const points: PriceSample[] = [
        { ts: 6000, price: 154.00 },
        { ts: 7000, price: 154.00 },
        { ts: 8000, price: 154.00 },
        { ts: 9000, price: 154.10 },
    ];
    const line = smoothDrawnHistory(points, 9000, 154.015);
    const tail = line.filter(p => p.ts >= 7600);
    for (let i = 1; i < tail.length; i++) {
        expect(tail[i].price).toBeGreaterThanOrEqual(tail[i - 1].price - 1e-9);
        expect(tail[i].price).toBeLessThanOrEqual(154.015 + 1e-9);
    }
});

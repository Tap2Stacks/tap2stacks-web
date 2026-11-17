import { describe, expect, it } from "vitest";
import { monotoneSegments, type Bezier, type Pt } from "./curve";

function evalBezierY(seg: Bezier, t: number): number {
  const mt = 1 - t;
  return (
    mt * mt * mt * seg.y0 +
    3 * mt * mt * t * seg.c1y +
    3 * mt * t * t * seg.c2y +
    t * t * t * seg.y1
  );
}

function evalBezierX(seg: Bezier, t: number): number {
  const mt = 1 - t;
  return (
    mt * mt * mt * seg.x0 +
    3 * mt * mt * t * seg.c1x +
    3 * mt * t * t * seg.c2x +
    t * t * t * seg.x1
  );
}

describe("monotoneSegments (Fritsch-Carlson)", () => {
  it("returns [] for 0 or 1 points", () => {
    expect(monotoneSegments([])).toEqual([]);
    expect(monotoneSegments([{ x: 10, y: 20 }])).toEqual([]);
  });

  it("returns one segment for 2 points", () => {
    const segs = monotoneSegments([
      { x: 0, y: 100 },
      { x: 50, y: 150 },
    ]);
    expect(segs).toHaveLength(1);
    expect(segs[0].x0).toBe(0);
    expect(segs[0].y0).toBe(100);
    expect(segs[0].x1).toBe(50);
    expect(segs[0].y1).toBe(150);
  });

  it("passes through every point and keeps y within [min(y0, y1), max(y0, y1)] for 20 t-values per segment", () => {
    const pts: Pt[] = [
      { x: 0, y: 100 },
      { x: 10, y: 102 },
      { x: 20, y: 140 }, // steep jump
      { x: 30, y: 141 }, // sharp plateau after steep jump (Catmull-Rom would overshoot here)
      { x: 40, y: 110 }, // reversal
      { x: 55, y: 110 }, // flat equal neighbors
      { x: 70, y: 95 },
    ];

    const segs = monotoneSegments(pts);
    expect(segs).toHaveLength(pts.length - 1);

    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      expect(s.x0).toBe(pts[i].x);
      expect(s.y0).toBe(pts[i].y);
      expect(s.x1).toBe(pts[i + 1].x);
      expect(s.y1).toBe(pts[i + 1].y);

      expect(evalBezierX(s, 0)).toBeCloseTo(s.x0, 9);
      expect(evalBezierY(s, 0)).toBeCloseTo(s.y0, 9);
      expect(evalBezierX(s, 1)).toBeCloseTo(s.x1, 9);
      expect(evalBezierY(s, 1)).toBeCloseTo(s.y1, 9);

      const minY = Math.min(s.y0, s.y1);
      const maxY = Math.max(s.y0, s.y1);

      for (let k = 0; k <= 20; k++) {
        const t = k / 20;
        const y = evalBezierY(s, t);
        expect(y).toBeGreaterThanOrEqual(minY - 1e-9);
        expect(y).toBeLessThanOrEqual(maxY + 1e-9);
      }
    }
  });

  it("gives a completely flat segment for equal neighbors", () => {
    const segs = monotoneSegments([
      { x: 0, y: 10 },
      { x: 10, y: 50 },
      { x: 20, y: 50 },
      { x: 30, y: 80 },
    ]);

    expect(segs[1].y0).toBe(50);
    expect(segs[1].c1y).toBe(50);
    expect(segs[1].c2y).toBe(50);
    expect(segs[1].y1).toBe(50);
  });
});

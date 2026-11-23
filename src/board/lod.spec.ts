import { describe, expect, it } from "vitest";
import { testCell } from "./fixtures";
import type { BoardViewport } from "./layout";
import { MAX_DRAWN_CELLS, planCellLod } from "./lod";

const baseViewport: BoardViewport = {
  width: 375,
  height: 500,
  nowMs: 10_000,
  nowFraction: 0.2,
  msPerPx: 1120, // zoomed all the way out (~7 min across 375 px)
  centerPrice: 155,
  pricePerPx: 0.005, // ~2.50 price range visible (~83 rows)
};

function makeGrid(cols: number, rows: number) {
  const cells = [];
  for (let c = 0; c < cols; c++) {
    const startTs = 15_000 + c * 5000;
    const endTs = startTs + 5000;
    for (let r = 0; r < rows; r++) {
      const lower = 155 + (r - rows / 2) * 0.03;
      const upper = lower + 0.03;
      const mult = 2 + Math.abs(r - rows / 2) * 0.8 + c * 0.3;
      cells.push(
        testCell({
          id: `NVDA:${startTs}:${endTs}:${lower.toFixed(2)}:${upper.toFixed(2)}`,
          timeWindowStart: startTs,
          timeWindowEnd: endTs,
          priceLevel: (lower + upper) / 2,
          multiplier: mult,
          original: {
            ...testCell().original,
            startTs,
            endTs,
            lowerPrice: lower.toFixed(2),
            upperPrice: upper.toFixed(2),
            rewardRate: mult.toFixed(2),
          },
        }),
      );
    }
  }
  return cells;
}

describe("planCellLod", () => {
  it("keeps individual cells with full labels at normal zoom", () => {
    const normalVp: BoardViewport = {
      width: 1000,
      height: 600,
      nowMs: 10_000,
      nowFraction: 0.3,
      msPerPx: 50,
      centerPrice: 155,
      pricePerPx: 0.001,
    };
    const cells = makeGrid(6, 10);
    const plan = planCellLod(cells, normalVp, 0.03, {});
    expect(plan.merged).toBe(false);
    expect(plan.textMode).toBe("full");
    expect(plan.tiles).toHaveLength(cells.length);
  });

  it("merges tiny cells and hides odds text when zoomed out so drawn count stays bounded", () => {
    // 24 five-second windows (2 full minutes) x 60 rows = 1,440 cells!
    const cells = makeGrid(24, 60);
    const plan = planCellLod(cells, baseViewport, 0.03, {});
    expect(plan.merged).toBe(true);
    expect(plan.textMode).toBe("none");
    expect(plan.tiles.length).toBeLessThanOrEqual(MAX_DRAWN_CELLS);
    expect(plan.tiles.length).toBeGreaterThan(0);
    // Representative multiplier uses probability-mean (harmonic mean) and stays positive & finite
    for (const tile of plan.tiles) {
      expect(Number.isFinite(tile.multiplier)).toBe(true);
      expect(tile.multiplier).toBeGreaterThan(1);
    }
  });

  it("excludes past cells from future tile rendering", () => {
    const past = testCell({ id: "past", timeWindowStart: 2000, timeWindowEnd: 7000 });
    const future = testCell({ id: "future", timeWindowStart: 15_000, timeWindowEnd: 20_000 });
    const plan = planCellLod([past, future], baseViewport, 0.03, {});
    expect(plan.tiles).toHaveLength(1);
    expect(plan.tiles[0].startTs).toBe(15_000);
  });
});

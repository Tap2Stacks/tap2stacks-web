import { describe, expect, it } from "vitest";
import { recordingContext } from "../test/recordingContext";
import { boardPalette } from "./cellColor";
import { drawCellGrid, drawCellLabels } from "./drawCells";
import { testCell } from "./fixtures";
import type { BoardViewport } from "./layout";
import { planCellLod } from "./lod";

const vp: BoardViewport = {
  width: 1000,
  height: 600,
  nowMs: 10_000,
  nowFraction: 0.3,
  msPerPx: 50,
  centerPrice: 155,
  pricePerPx: 0.001,
};

describe("drawCells", () => {
  it("draws an open unbet cell label with no filled tile or sprite", () => {
    const { ctx, calls } = recordingContext();
    const bp = boardPalette("light");
    const plan = planCellLod([testCell({ multiplier: 4.1 })], vp, 0.03);
    drawCellLabels(ctx, plan, vp, "light", bp);

    expect(calls.some((c) => c.name === "fillText" && c.args[0] === "x4.1")).toBe(true);
    expect(calls.some((c) => c.name === "drawImage")).toBe(false);
    expect(calls.some((c) => c.name === "fill")).toBe(false);
    expect(calls.some((c) => c.name === "fillRect")).toBe(false);
  });

  it("draws nothing for locked cells (< 5 s ahead)", () => {
    const { ctx, calls } = recordingContext();
    const bp = boardPalette("light");
    const locked = testCell({ timeWindowStart: 11_000, timeWindowEnd: 16_000 });
    const plan = planCellLod([locked], vp, 0.03);
    drawCellLabels(ctx, plan, vp, "light", bp);

    expect(calls.some((c) => c.name === "fillText")).toBe(false);
  });

  it("draws one vertical line per visible column edge right of NOW and none left of NOW", () => {
    const { ctx, calls } = recordingContext();
    const bp = boardPalette("light");
    // NOW is at ts = 10_000 (x = 300). 5_000 is left of NOW, 15_000 and 20_000 are right of NOW.
    drawCellGrid(ctx, vp, [5_000, 10_000, 15_000, 20_000], [155.0, 155.03], bp);

    const verticals = calls.filter(
      (c) => c.name === "fillRect" && Number(c.args[3]) === 600 && Number(c.args[2]) < 2,
    );
    const xs = verticals.map((c) => Number(c.args[0]));
    expect(xs).toEqual([300, 400, 500]);
    expect(xs.some((x) => x < 300)).toBe(false);

    const horizontals = calls.filter(
      (c) => c.name === "fillRect" && Number(c.args[2]) === 1000 && Number(c.args[3]) < 2,
    );
    expect(horizontals).toHaveLength(2);
  });
});

import { describe, expect, it } from "vitest";
import { recordingContext } from "../test/recordingContext";
import { THEME } from "../ui/theme";
import { boardPalette } from "./cellColor";
import { drawBoard } from "./draw";
import { drawCellGrid, drawCellLabels, drawCellTile } from "./drawCells";
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

  it("labels a column that is 70% inside the plot, faded, so phones show one more open column", () => {
    const { ctx, calls } = recordingContext();
    const bp = boardPalette("light");
    // plotWidth = 942, NOW at x = 282.6; this 100 px cell spans 872..972, so 70 px are visible
    const v = { ...vp, rightGutter: 58 };
    const partial = testCell({ multiplier: 4.1, timeWindowStart: 39_470, timeWindowEnd: 44_470 });
    drawCellLabels(ctx, planCellLod([partial], v, 0.03), v, "light", bp);

    const label = calls.find((c) => c.name === "fillText" && c.args[0] === "x4.1");
    expect(label).toBeDefined();
    expect(label!.alpha ?? 1).toBeGreaterThan(0);
    expect(label!.alpha ?? 1).toBeLessThan(0.9);
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

  it("drawCellTile draws a rounded filled tile with soft coin gold for bets and low-alpha ink for hover", () => {
    const bp = boardPalette("light");
    const bet = recordingContext();
    drawCellTile(bet.ctx, { x: 100, y: 100, w: 84, h: 84 }, "bet", 1, bp);
    const betFill = bet.calls.find((c) => c.name === "fill");
    expect(betFill).toBeDefined();
    expect(betFill!.fill).toBe(THEME.highlight);
    expect(betFill!.alpha).toBeGreaterThan(0);
    expect(betFill!.alpha).toBeLessThan(0.5);

    const hover = recordingContext();
    drawCellTile(hover.ctx, { x: 100, y: 100, w: 84, h: 84 }, "hover", 0.5, bp);
    const hoverFill = hover.calls.find((c) => c.name === "fill");
    expect(hoverFill).toBeDefined();
    expect(hoverFill!.fill).toBe(bp.ink);
    expect(hoverFill!.alpha).toBeGreaterThan(0);
    expect(hoverFill!.alpha).toBeLessThan(0.2);
  });

  it("drawBoard draws a bet tile under every cell that has a stack before the stack, and ignores hover on locked/past/bet cells", () => {
    const openCell = testCell({ id: "open-bet", timeWindowStart: 15_000, timeWindowEnd: 20_000 });
    const pastCell = testCell({ id: "past-bet", timeWindowStart: 2_000, timeWindowEnd: 7_000, status: "past" });
    const lockedCell = testCell({ id: "locked-cell", timeWindowStart: 11_000, timeWindowEnd: 16_000 });
    const { ctx, calls } = recordingContext();
    drawBoard(ctx, {
      viewport: vp,
      cells: [openCell, pastCell, lockedCell],
      line: [],
      livePrice: 155,
      hover: { cellId: lockedCell.id, alpha: 1 },
      stacks: {
        [openCell.id]: {
          cellId: openCell.id,
          ticker: "NVDA",
          coins: [{ clientTapId: "a", amount: 5, rate: 4.1, status: "open", placedAt: 0 }],
        },
        [pastCell.id]: {
          cellId: pastCell.id,
          ticker: "NVDA",
          coins: [{ clientTapId: "b", amount: 5, rate: 4.1, status: "open", placedAt: 0 }],
        },
      },
    });

    const betFills = calls
      .map((c, idx) => ({ ...c, idx }))
      .filter((c) => c.name === "fill" && c.fill === THEME.highlight);
    expect(betFills).toHaveLength(2);
    const firstEllipseIdx = calls.findIndex((c) => c.name === "ellipse");
    expect(betFills[0].idx).toBeLessThan(firstEllipseIdx);
    // Locked hover tile must NOT be drawn
    expect(calls.some((c) => c.name === "fill" && c.fill === boardPalette("light").ink && c.alpha < 0.2)).toBe(false);

    // Hover over a cell with a bet keeps the bet tile and does not draw a hover tile over it
    calls.length = 0;
    drawBoard(ctx, {
      viewport: vp,
      cells: [openCell],
      line: [],
      livePrice: 155,
      hover: { cellId: openCell.id, alpha: 1 },
      stacks: {
        [openCell.id]: {
          cellId: openCell.id,
          ticker: "NVDA",
          coins: [{ clientTapId: "a", amount: 5, rate: 4.1, status: "open", placedAt: 0 }],
        },
      },
    });
    expect(calls.some((c) => c.name === "fill" && c.fill === THEME.highlight)).toBe(true);
    expect(calls.some((c) => c.name === "fill" && c.fill === boardPalette("light").ink && c.alpha < 0.2)).toBe(false);
  });
});

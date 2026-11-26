import { expect, it, vi, afterEach } from "vitest";
import { useGameStore } from "../store";
import { testCell } from "./fixtures";
import { visibleCells } from "./retainedCells";
import { drawBoard } from "./draw";
import { recordingContext } from "../test/recordingContext";
const viewport = { width: 1000, height: 600, nowMs: 17000, nowFraction: 0.3, msPerPx: 50, centerPrice: 155, pricePerPx: 0.001 };
afterEach(() => vi.restoreAllMocks());
it("a cell disappearing from quotes stays retained through lock and live windows without odds text until it scrolls off", () => {
    vi.spyOn(Date, "now").mockReturnValue(10000);
    const cell = testCell();
    useGameStore.setState({ cells: [], ticker: "NVDA", stacks: {} });
    useGameStore.getState().updateGrid({ ticker: "NVDA", gridTs: 10000, cells: [cell.original] });
    useGameStore.getState().updateGrid({ ticker: "NVDA", gridTs: 12000, cells: [] });
    const cells = visibleCells(useGameStore.getState().cells, "NVDA", viewport);
    expect(cells).toHaveLength(1);
    const { ctx, calls } = recordingContext();
    drawBoard(ctx, { viewport, cells, line: [], livePrice: 155, stacks: {} });
    expect(calls.some(c => c.name === "fillText" && c.args[0] === "x4.1")).toBe(false);
    expect(calls.some(c => c.name === "fillRect" && Number(c.args[0]) === 360 && Number(c.args[3]) === 600)).toBe(true);
    expect(visibleCells(cells, "NVDA", { ...viewport, nowMs: 35001 })).toHaveLength(0);
});
it("the live column grid and a locked stack stay visible until its outcome", () => {
    const cell = testCell();
    const { ctx, calls } = recordingContext();
    drawBoard(ctx, { viewport, cells: [cell], line: [], livePrice: 155, stacks: { [cell.id]: { cellId: cell.id, ticker: "NVDA", coins: [{ clientTapId: "a", status: "open", amount: 5, rate: 4.1, placedAt: 0 }] } } });
    expect(calls.some(c => c.name === "fillRect" && Number(c.args[0]) === 360 && Number(c.args[3]) === 600)).toBe(true);
    expect(calls.some(c => c.args[0] === "$5")).toBe(true);
    expect(calls.some(c => c.name === "fillRect" && c.args[0] === 0 && c.args[2] === 1000 && c.args[3] === 0.5 && (c.alpha ?? 1) < 0.2)).toBe(true);

    calls.length = 0;
    drawBoard(ctx, {
        viewport,
        animationNowMs: 17300,
        cells: [cell],
        line: [],
        livePrice: 155,
        stacks: { [cell.id]: { cellId: cell.id, ticker: "NVDA", coins: [{ clientTapId: "a", status: "void", amount: 5, rate: 4.1, placedAt: 0, updatedAt: 17000 }] } },
    });
    expect(calls.some(c => c.args[0] === "Refunded")).toBe(true);

    calls.length = 0;
    drawBoard(ctx, {
        viewport,
        animationNowMs: 18250,
        cells: [cell],
        line: [],
        livePrice: 155,
        stacks: { [cell.id]: { cellId: cell.id, ticker: "NVDA", coins: [{ clientTapId: "a", status: "lost", amount: 5, rate: 4.1, placedAt: 0, updatedAt: 17000 }] } },
    });
    expect(calls.some(c => c.args[0] === "$5")).toBe(false);
});

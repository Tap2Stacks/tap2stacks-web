import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TradePage } from "./TradePage";
import { useGameStore } from "../store";
import { testCell } from "../board/fixtures";
vi.mock("wagmi", () => ({ useAccount: () => ({ address: "0xabc" }) }));
vi.mock("../board/BoardCanvas", () => ({ BoardCanvas: ({ onTapCell }: {
        onTapCell: (cell: ReturnType<typeof testCell>) => void;
    }) => <button onClick={() => onTapCell(testCell({ timeWindowStart: Date.now() + 20000 }))}>Tap board</button> }));
beforeEach(() => useGameStore.setState({ ticker: "NVDA", betAmount: 5, currentPrice: 154.68, balance: 0, stacks: {}, feedStale: { NVDA: false, TSLA: false }, serverTimeOffset: 0 }));
afterEach(cleanup);
it("ticker switch calls setTicker; chips start at $5 and select stakes", () => {
    render(<TradePage />);
    expect(screen.getByRole("button", { name: "Stake $5" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "TSLA" }));
    expect(useGameStore.getState().ticker).toBe("TSLA");
    fireEvent.click(screen.getByRole("button", { name: "Stake $10" }));
    expect(useGameStore.getState().betAmount).toBe(10);
});
it("keys 1 to 4 select stakes and ignore input focus", () => {
    render(<TradePage />);
    ["1", "2", "3", "4"].forEach((key, i) => {
        fireEvent.keyDown(window, { key });
        expect(useGameStore.getState().betAmount).toBe([1, 5, 10, 25][i]);
    });
    const input = document.createElement("input");
    document.body.append(input);
    fireEvent.keyDown(input, { key: "1" });
    expect(useGameStore.getState().betAmount).toBe(25);
    input.remove();
});
it("shows PAUSED, exact testnet copy, and insufficient balance shakes without placing", () => {
    useGameStore.setState({ feedStale: { NVDA: true, TSLA: false } });
    const { unmount } = render(<TradePage />);
    expect(screen.getByText("PAUSED")).toBeTruthy();
    expect(screen.getByText("Testnet game. Test USDC has no value. Not for US persons. 18+.")).toBeTruthy();
    unmount();
    useGameStore.setState({ feedStale: { NVDA: false, TSLA: false }, wssKey: "abcd", socket: { emit: vi.fn() } as never });
    render(<TradePage />);
    fireEvent.click(screen.getByText("Tap board"));
    expect(screen.getByLabelText("Stake chips").className).toContain("fx-shake");
    expect(useGameStore.getState().stacks).toEqual({});
});
it("shows one row per stack with coins, stake, odds, and summary", () => {
    useGameStore.setState({ stacks: Object.fromEntries(["a", "b", "c"].map(cellId => [cellId, { cellId, ticker: "NVDA", coins: [{ clientTapId: cellId, amount: 25, rate: 4.1, status: "open", placedAt: 0 }] }])) });
    render(<TradePage />);
    expect(screen.getByText("3 open taps / $75 on the board")).toBeTruthy();
    expect(screen.getAllByText(/1 coin/)).toHaveLength(3);
    expect(screen.getAllByText(/x4.1/)).toHaveLength(3);
});

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testCell } from "../board/fixtures";
import { useGameStore } from "../store";

const mockOnTapCell = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0xabc" }),
}));

vi.mock("../board/BoardCanvas", () => ({
  BoardCanvas: ({
    onTapCell,
  }: {
    onTapCell: (cell: ReturnType<typeof testCell>) => void;
  }) => (
    <canvas
      aria-label="Live price and tap board"
      style={{ touchAction: "none" }}
      onPointerDown={() => {
        const cell = testCell({ timeWindowStart: Date.now() + 20000 });
        mockOnTapCell(cell);
        onTapCell(cell);
      }}
    />
  ),
}));

import { TradePage } from "./TradePage";

function setWidth(w: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: w,
  });
}

describe("phone trade page", () => {
  beforeEach(() => {
    mockOnTapCell.mockReset();
    useGameStore.setState({
      ticker: "NVDA",
      betAmount: 5,
      currentPrice: 154.68,
      balance: 100,
      stacks: {},
      feedStale: { NVDA: false, TSLA: false },
      serverTimeOffset: 0,
      wssKey: "00112233",
      socket: { emit: vi.fn() } as never,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("at 390 px renders ticker row, board, open-taps line, chips, and testnet line in order without desktop SidePanel", () => {
    setWidth(390);
    const { container } = render(<TradePage />);

    expect(screen.queryByText("Drop a coin")).toBeNull();
    expect(screen.queryByText("Your open taps")).toBeNull();

    const nvdaBtn = screen.getByRole("button", { name: "NVDA" });
    const board = screen.getByLabelText("Live price and tap board");
    const openTapsBtn = screen.getByRole("button", {
      name: /0 open taps \/ \$0 on the board/i,
    });
    const chips = screen.getByLabelText("Stake chips");
    const testnet = screen.getByText(
      "Testnet game. Test USDC has no value. Not for US persons. 18+.",
    );

    const ordered = [nvdaBtn, board, openTapsBtn, chips, testnet];
    for (let i = 1; i < ordered.length; i++) {
      const relation = ordered[i - 1].compareDocumentPosition(ordered[i]);
      expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(container.querySelector("aside")).toBeNull();
  });

  it("open-taps line shows '2 open taps / $6 on the board' and expands to the list on tap", () => {
    setWidth(390);
    useGameStore.setState({
      stacks: {
        "NVDA:1000:6000:154.00:154.03": {
          cellId: "NVDA:1000:6000:154.00:154.03",
          ticker: "NVDA",
          coins: [
            {
              clientTapId: "c1",
              amount: 1,
              rate: 4.1,
              status: "open",
              placedAt: 0,
            },
            {
              clientTapId: "c2",
              amount: 5,
              rate: 4.1,
              status: "open",
              placedAt: 1,
            },
          ],
        },
      },
    });

    render(<TradePage />);
    const toggle = screen.getByRole("button", {
      name: /2 open taps \/ \$6 on the board/i,
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/2 coins/)).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/2 coins/)).toBeTruthy();
  });

  it("one pointerdown on an open cell places one coin once and keeps touchAction none", () => {
    setWidth(390);
    render(<TradePage />);
    const board = screen.getByLabelText("Live price and tap board");
    expect(board.style.touchAction).toBe("none");

    fireEvent.pointerDown(board);
    expect(mockOnTapCell).toHaveBeenCalledTimes(1);
  });

  it("at 1440 px renders desktop SidePanel", () => {
    setWidth(1440);
    render(<TradePage />);
    expect(screen.getByText("Drop a coin")).toBeTruthy();
    expect(screen.getByText("Your open taps")).toBeTruthy();
  });
});

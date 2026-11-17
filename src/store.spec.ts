import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore, type RemoteCell } from "./store";

describe("useGameStore.updateGrid", () => {
  beforeEach(() => {
    useGameStore.setState({
      cells: [],
      bets: {},
      betRates: {},
      pendingBets: {},
      pendingWins: {},
    });
  });

  it("maps RemoteCell to CellData with id = ${ticker}:${startTs}:${endTs}:${lowerPrice}:${upperPrice}", () => {
    const now = Date.now();
    const remoteCell: RemoteCell = {
      ticker: "NVDA",
      gridTs: now,
      startTs: now + 10_000,
      endTs: now + 15_000,
      lowerPrice: "157.50",
      upperPrice: "157.53",
      rewardRate: "2.4500",
      gridSignature: "sig-1",
    };

    useGameStore.getState().updateGrid([remoteCell]);

    const { cells } = useGameStore.getState();
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({
      id: `NVDA:${remoteCell.startTs}:${remoteCell.endTs}:157.50:157.53`,
      timeWindowStart: remoteCell.startTs,
      timeWindowEnd: remoteCell.endTs,
      priceLevel: 157.515,
      multiplier: 2.45,
      status: "active",
      original: remoteCell,
    });
  });

  it("keeps locked bet rate when a bet exists on the ticker-prefixed cellId", () => {
    const now = Date.now();
    const startTs = now + 10_000;
    const endTs = now + 15_000;
    const cellId = `AAPL:${startTs}:${endTs}:225.00:225.03`;

    useGameStore.setState({
      bets: { [cellId]: 5 },
      betRates: { [cellId]: 3.2 },
    });

    const remoteCell: RemoteCell = {
      ticker: "AAPL",
      gridTs: now,
      startTs,
      endTs,
      lowerPrice: "225.00",
      upperPrice: "225.03",
      rewardRate: "1.8000",
      gridSignature: "sig-2",
    };

    useGameStore.getState().updateGrid([remoteCell]);

    const { cells } = useGameStore.getState();
    expect(cells).toHaveLength(1);
    expect(cells[0].id).toBe(cellId);
    expect(cells[0].multiplier).toBe(3.2);
  });
});

import { describe, expect, it } from "vitest";
import { useGameStore } from "../store";
import { PERP_PRICE_LABEL, PRICE_STEP_BY_TICKER, TICKERS } from "./tickers";

describe("supported tickers", () => {
  it("covers NVDA, TSLA, AAPL, and SP500 in initial state", () => {
    const state = useGameStore.getState();
    expect(TICKERS).toEqual(["NVDA", "TSLA", "AAPL", "SP500"]);
    expect(Object.keys(state.feedStale).sort()).toEqual([...TICKERS].sort());
    expect(state.priceStepByTicker).toMatchObject(PRICE_STEP_BY_TICKER);
    expect(PERP_PRICE_LABEL).toBe("Perp price · Hyperliquid trade.xyz");
  });
});

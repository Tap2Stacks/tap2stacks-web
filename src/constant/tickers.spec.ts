import { describe, expect, it } from "vitest";
import { useGameStore } from "../store";
import {
  DERIBIT_PRICE_LABEL,
  PERP_PRICE_LABEL,
  PRICE_STEP_BY_TICKER,
  priceLabelForSource,
  TICKERS,
} from "./tickers";

describe("supported tickers", () => {
  it("covers NVDA, TSLA, AAPL, and SP500 in initial state", () => {
    const state = useGameStore.getState();
    expect(TICKERS).toEqual(["NVDA", "TSLA", "AAPL", "SP500"]);
    expect(Object.keys(state.feedStale).sort()).toEqual([...TICKERS].sort());
    expect(state.priceStepByTicker).toMatchObject(PRICE_STEP_BY_TICKER);
    expect(PERP_PRICE_LABEL).toBe("Perp price · Hyperliquid trade.xyz");
    expect(DERIBIT_PRICE_LABEL).toBe("Index price · Coinbase Derivatives (Deribit)");
  });

  it("maps backend price source to the matching user-facing label with HL fallback", () => {
    expect(priceLabelForSource("hyperliquid-xyz-perp")).toBe(
      "Perp price · Hyperliquid trade.xyz",
    );
    expect(priceLabelForSource("deribit-perp-index")).toBe(
      "Index price · Coinbase Derivatives (Deribit)",
    );
    expect(priceLabelForSource(null)).toBe("Perp price · Hyperliquid trade.xyz");
    expect(priceLabelForSource(undefined)).toBe("Perp price · Hyperliquid trade.xyz");
    expect(priceLabelForSource("unknown-source")).toBe(
      "Perp price · Hyperliquid trade.xyz",
    );
  });
});

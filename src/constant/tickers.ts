export const TICKERS = ["NVDA", "TSLA", "AAPL", "SP500"] as const;

export type Ticker = (typeof TICKERS)[number];

export const PRICE_STEP_BY_TICKER: Record<Ticker, number> = {
  NVDA: 0.03,
  TSLA: 0.08,
  AAPL: 0.08,
  SP500: 1.5,
};

export const PERP_PRICE_LABEL = "Perp price · Hyperliquid trade.xyz";

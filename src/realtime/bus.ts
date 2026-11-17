import type { TradeFeedEntry } from "../feed/types";

export type PriceListener = (ticker: string, ts: number, price: number) => void;
export type TradeFeedListener = (entry: TradeFeedEntry) => void;

const priceListeners = new Set<PriceListener>();
const tradeFeedListeners = new Set<TradeFeedListener>();

/** Subscribe to live price ticks emitted by the realtime socket. */
export function onPrice(listener: PriceListener): () => void {
  priceListeners.add(listener);
  return () => {
    priceListeners.delete(listener);
  };
}

/** Subscribe to public settled trade feed entries emitted by the realtime socket. */
export function onTradeFeed(listener: TradeFeedListener): () => void {
  tradeFeedListeners.add(listener);
  return () => {
    tradeFeedListeners.delete(listener);
  };
}

export function emitPrice(ticker: string, ts: number, price: number): void {
  for (const listener of priceListeners) {
    listener(ticker, ts, price);
  }
}

export function emitTradeFeed(entry: TradeFeedEntry): void {
  for (const listener of tradeFeedListeners) {
    listener(entry);
  }
}

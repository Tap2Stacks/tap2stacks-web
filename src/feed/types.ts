export interface TradeFeedEntry {
  id: string; // `${playerShort}:${cellId}:${ts}`
  ticker: string;
  playerShort: string; // "0x3f4a..a1"
  isBot: boolean;
  multiplier: string; // 1 decimal, "4.1"
  stake: string; // "15"
  payout: string; // "61.5"; "0" on loss
  result: "win" | "loss";
  big: boolean;
  ts: number;
}

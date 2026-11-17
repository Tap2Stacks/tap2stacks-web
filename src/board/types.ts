export type CoinStatus =
  | "pending"
  | "open"
  | "won"
  | "lost"
  | "void"
  | "rejected";

export interface Coin {
  clientTapId: string;
  orderId?: string;
  amount: number;
  rate: number;
  status: CoinStatus;
  placedAt: number;
  updatedAt?: number;
}

export interface CoinStack {
  cellId: string;
  ticker: string;
  coins: Coin[];
}

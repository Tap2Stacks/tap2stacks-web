export type RejectReason =
  | "WINDOW_CLOSING"
  | "STALE_QUOTE"
  | "FEED_PAUSED"
  | "BAD_AMOUNT"
  | "INSUFFICIENT_BALANCE"
  | (string & {});

const REJECT_MESSAGES: Record<string, string> = {
  WINDOW_CLOSING: "Too close to start. Tap a later column.",
  STALE_QUOTE: "Odds moved. Tap again.",
  FEED_PAUSED: "Price feed paused. Taps are off for now.",
  BAD_AMOUNT: "Stake must be 1-25.",
  INSUFFICIENT_BALANCE: "Not enough balance. Deposit or use the faucet.",
};

/** Map a backend tap-rejection reason code to a human-readable toast message. */
export function rejectMessage(reason?: RejectReason | null): string {
  if (!reason) {
    return "Tap rejected. Please try again.";
  }
  return REJECT_MESSAGES[reason] ?? "Tap rejected. Please try again.";
}

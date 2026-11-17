import { describe, expect, it } from "vitest";
import { rejectMessage } from "./rejectReasons";

describe("rejectMessage", () => {
  it("maps known backend reject reasons to readable copy", () => {
    expect(rejectMessage("WINDOW_CLOSING")).toBe(
      "Too close to start. Tap a later column.",
    );
    expect(rejectMessage("STALE_QUOTE")).toBe("Odds moved. Tap again.");
    expect(rejectMessage("FEED_PAUSED")).toBe(
      "Price feed paused. Taps are off for now.",
    );
    expect(rejectMessage("BAD_AMOUNT")).toBe("Stake must be 1-25.");
    expect(rejectMessage("INSUFFICIENT_BALANCE")).toBe(
      "Not enough balance. Deposit or use the faucet.",
    );
  });

  it("returns a readable fallback for unknown or missing reasons", () => {
    expect(rejectMessage("SOME_UNKNOWN_ERROR")).toBe(
      "Tap rejected. Please try again.",
    );
    expect(rejectMessage(undefined)).toBe("Tap rejected. Please try again.");
  });
});

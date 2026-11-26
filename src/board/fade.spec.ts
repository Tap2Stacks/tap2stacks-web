import { describe, expect, it } from "vitest";
import { payoutEmphasis } from "./fade";

describe("payoutEmphasis", () => {
  it("strictly increases alpha with payout while keeping low payouts readable", () => {
    const low = payoutEmphasis(1.1);
    const two = payoutEmphasis(2);
    const five = payoutEmphasis(5);
    const high = payoutEmphasis(25);

    expect(low.textAlpha).toBeGreaterThanOrEqual(0.7);
    expect(two.textAlpha).toBeGreaterThan(low.textAlpha);
    expect(five.textAlpha).toBeGreaterThan(two.textAlpha);
    expect(high.textAlpha).toBeGreaterThan(five.textAlpha);
    expect(high.textAlpha).toBe(1);
    expect(high.fontWeight).toBe(700);
    expect(low.fontWeight).toBeLessThanOrEqual(five.fontWeight);
  });
});

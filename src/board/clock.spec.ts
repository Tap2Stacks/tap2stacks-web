import { describe, expect, it } from "vitest";
import { createChartClock } from "./clock";

describe("createChartClock", () => {
  it("re-syncs when drift > 1000 ms and not at 999 ms", () => {
    const clock = createChartClock();

    expect(clock.sample(10_000, 100)).toBe(10_000);
    // Expected anchored time at perfMs=1100 is 11000. Drift = |11000 - 11999| = 999 -> no resync
    expect(clock.sample(11_999, 1_100)).toBe(11_000);
    // Drift = |11000 - 12001| = 1001 -> resyncs to 12001
    expect(clock.sample(12_001, 1_100)).toBe(12_001);

    clock.reset();
    expect(clock.sample(20_000, 50)).toBe(20_000);
  });
});

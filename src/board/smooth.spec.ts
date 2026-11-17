import { describe, expect, it } from "vitest";
import { createSmoothValue } from "./smooth";

describe("createSmoothValue", () => {
  it("uses default tau of 95 ms and eases within 1200 ms", () => {
    const s = createSmoothValue();
    expect(s.value).toBeNull();

    expect(s.sample(100, 0)).toBe(100);
    expect(s.value).toBe(100);

    // After dt = 95ms (1 tau), reaches 1 - e^-1 of target
    const next = s.sample(200, 95);
    expect(next).toBeCloseTo(100 + 100 * (1 - Math.exp(-1)), 6);
  });

  it("snaps when gap > 1200 ms, after a 5 s hidden tab, or when snap=true", () => {
    const s = createSmoothValue();
    s.sample(100, 0);

    // Gap exactly 1200 ms does not snap
    const eased = s.sample(200, 1200);
    expect(eased).toBeLessThan(200);

    // Gap 1201 ms snaps
    expect(s.sample(250, 2401)).toBe(250);

    // 5 s hidden tab snaps
    expect(s.sample(300, 7401)).toBe(300);

    // Explicit snap
    expect(s.sample(350, 7417, true)).toBe(350);

    s.reset();
    expect(s.value).toBeNull();
  });
});

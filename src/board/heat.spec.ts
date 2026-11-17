import { describe, expect, it } from "vitest";
import { heatFor } from "./heat";

describe("heatFor", () => {
  it("classifies multiplier into heat tiers", () => {
    expect(heatFor(2.99)).toBe("none");
    expect(heatFor(3)).toBe("lavender");
    expect(heatFor(7.99)).toBe("lavender");
    expect(heatFor(8)).toBe("yellow");
    expect(heatFor(15.99)).toBe("yellow");
    expect(heatFor(16)).toBe("pink");
    expect(heatFor(Number.NaN)).toBe("none");
  });
});

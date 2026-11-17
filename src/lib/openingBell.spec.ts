import { expect, it } from "vitest";
import { nextOpeningBell, formatChange } from "./openingBell";
it.each([
    ["2026-11-17T14:00:00Z", "2026-11-17T14:30:00.000Z", false],
    ["2026-11-17T14:45:00Z", "2026-11-17T14:30:00.000Z", true],
    ["2026-11-20T16:00:00Z", "2026-11-23T14:30:00.000Z", false],
    ["2026-07-10T16:00:00Z", "2026-07-13T13:30:00.000Z", false],
])("nextOpeningBell %s", (now, at, live) => {
    const result = nextOpeningBell(new Date(now));
    expect(result.at.toISOString()).toBe(at);
    expect(result.live).toBe(live);
});
it("formatChange uses a valid reference", () => {
    expect(formatChange(154.68, 154.03)).toBe("+0.42%");
    expect(formatChange(154, null)).toBeNull();
    expect(formatChange(154, 0)).toBeNull();
});

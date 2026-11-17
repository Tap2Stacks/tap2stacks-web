import { describe, expect, it } from "vitest";
import { seriesFor, shouldRedraw } from "./priceSeries";

describe("seriesFor", () => {
  it("drops points older than 120 s and ignores out-of-order points", () => {
    const s = seriesFor("TEST_ORDER");
    s.push(10_000, 150);
    s.push(20_000, 151);
    s.push(15_000, 999); // out of order -> ignored
    expect(s.since(0)).toEqual([
      { ts: 10_000, price: 150 },
      { ts: 20_000, price: 151 },
    ]);

    // Push at 135_000 drops 10_000 (125_000 > 120_000) and keeps 20_000 (115_000 <= 120_000)
    s.push(135_000, 152);
    expect(s.since(0)).toEqual([
      { ts: 20_000, price: 151 },
      { ts: 135_000, price: 152 },
    ]);
  });

  it("seed then push keeps ascending order", () => {
    const s = seriesFor("TEST_SEED");
    s.seed([
      { ts: 3_000, price: 102 },
      { ts: 1_000, price: 100 },
      { ts: 2_000, price: 101 },
    ]);
    s.push(4_000, 103);

    expect(s.since(1_500)).toEqual([
      { ts: 2_000, price: 101 },
      { ts: 3_000, price: 102 },
      { ts: 4_000, price: 103 },
    ]);
  });
});

describe("shouldRedraw", () => {
  it("returns true when price moved >= 0.04 px, false at 0.039 px unless second changed or time moved >= 0.08 px", () => {
    const base = { pricePx: 100, second: 10, timePx: 200 };

    expect(shouldRedraw(base, { pricePx: 100.04, second: 10, timePx: 200 })).toBe(
      true,
    );
    expect(shouldRedraw(base, { pricePx: 100.039, second: 10, timePx: 200 })).toBe(
      false,
    );
    expect(shouldRedraw(base, { pricePx: 100.039, second: 11, timePx: 200 })).toBe(
      true,
    );
    expect(
      shouldRedraw(base, { pricePx: 100.039, second: 10, timePx: 200.08 }),
    ).toBe(true);
    expect(
      shouldRedraw(base, { pricePx: 100.039, second: 10, timePx: 200.079 }),
    ).toBe(false);
  });
});

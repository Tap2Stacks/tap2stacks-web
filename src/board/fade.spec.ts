import { describe, expect, it } from "vitest";
import {
  cellFade,
  MIN_ODDS_ALPHA,
  MIN_TINT_ALPHA,
  TWO_MINUTES_MS,
} from "./fade";

const base = {
  multiplier: 3,
  cellLower: 155.0,
  cellUpper: 155.03,
  livePrice: 155.015,
  startTs: 15_000,
  endTs: 20_000,
  nowMs: 10_000,
  visibleAheadMs: 35_000,
};

describe("cellFade", () => {
  it("keeps near, low-multiplier, nearest-column cells bright", () => {
    const near = cellFade({ ...base, multiplier: 2.0 });
    expect(near.textAlpha).toBeGreaterThan(0.95);
    expect(near.tintAlpha).toBeGreaterThan(0.95);
  });

  it("drops odds opacity smoothly with row distance from livePrice", () => {
    const row0 = cellFade(base);
    const row2 = cellFade({ ...base, cellLower: 155.06, cellUpper: 155.09 });
    const row5 = cellFade({ ...base, cellLower: 155.15, cellUpper: 155.18 });
    const row9 = cellFade({ ...base, cellLower: 155.27, cellUpper: 155.30 });

    expect(row0.textAlpha).toBeGreaterThan(row2.textAlpha);
    expect(row2.textAlpha).toBeGreaterThan(row5.textAlpha);
    expect(row5.textAlpha).toBeGreaterThan(row9.textAlpha);
    expect(row9.textAlpha).toBeGreaterThanOrEqual(MIN_ODDS_ALPHA);
  });

  it("fades toward the right edge when visibleAheadMs is under 2 minutes", () => {
    const col1 = cellFade({ ...base, startTs: 15_000, endTs: 20_000 });
    const col3 = cellFade({ ...base, startTs: 25_000, endTs: 30_000 });
    const col6 = cellFade({ ...base, startTs: 40_000, endTs: 45_000 });

    expect(col1.textAlpha).toBeGreaterThan(col3.textAlpha);
    expect(col3.textAlpha).toBeGreaterThan(col6.textAlpha);

    // Same 30-35s cell fades much less if the board actually shows 3 minutes ahead
    const widerHorizon = cellFade({
      ...base,
      startTs: 40_000,
      endTs: 45_000,
      visibleAheadMs: 180_000,
    });
    expect(widerHorizon.textAlpha).toBeGreaterThan(col6.textAlpha);
  });

  it("drops odds opacity smoothly with multiplier size", () => {
    const x2 = cellFade({ ...base, multiplier: 2 });
    const x4 = cellFade({ ...base, multiplier: 4 });
    const x8 = cellFade({ ...base, multiplier: 8 });
    const x16 = cellFade({ ...base, multiplier: 16 });
    const x32 = cellFade({ ...base, multiplier: 32 });

    expect(x2.textAlpha).toBeGreaterThan(x4.textAlpha);
    expect(x4.textAlpha).toBeGreaterThan(x8.textAlpha);
    expect(x8.textAlpha).toBeGreaterThan(x16.textAlpha);
    expect(x16.textAlpha).toBeGreaterThan(x32.textAlpha);
  });

  it("makes x16+ and >2min cells faint yet still readable", () => {
    const highMult = cellFade({ ...base, multiplier: 18 });
    expect(highMult.textAlpha).toBeLessThanOrEqual(0.5);
    expect(highMult.textAlpha).toBeGreaterThanOrEqual(MIN_ODDS_ALPHA);

    const farTime = cellFade({
      ...base,
      startTs: base.nowMs + TWO_MINUTES_MS + 10_000,
      endTs: base.nowMs + TWO_MINUTES_MS + 15_000,
      visibleAheadMs: 180_000,
    });
    expect(farTime.textAlpha).toBeLessThanOrEqual(0.5);
    expect(farTime.textAlpha).toBeGreaterThanOrEqual(MIN_ODDS_ALPHA);

    const extreme = cellFade({
      ...base,
      multiplier: 60,
      cellLower: 155.45,
      cellUpper: 155.48,
      startTs: 40_000,
      endTs: 45_000,
    });
    expect(extreme.textAlpha).toBeGreaterThanOrEqual(MIN_ODDS_ALPHA);
  });

  it("fades heat tint gently while keeping heat colors stronger than faded numbers", () => {
    const near = cellFade({ ...base, multiplier: 3.5 });
    const far = cellFade({
      ...base,
      multiplier: 20,
      cellLower: 155.24,
      cellUpper: 155.27,
      startTs: 40_000,
      endTs: 45_000,
    });

    expect(near.tintAlpha).toBeGreaterThan(far.tintAlpha);
    expect(far.tintAlpha).toBeGreaterThan(far.textAlpha);
    expect(far.tintAlpha).toBeGreaterThanOrEqual(MIN_TINT_ALPHA);
  });

  it("drops odds font weight alongside opacity as win probability decreases", () => {
    const likely = cellFade({ ...base, multiplier: 2.0 });
    const moderate = cellFade({ ...base, multiplier: 5.0 });
    const longshot = cellFade({ ...base, multiplier: 20.0 });

    expect(likely.fontWeight).toBe(700);
    expect(moderate.fontWeight).toBeLessThan(likely.fontWeight);
    expect(longshot.fontWeight).toBe(400);
    expect(likely.textAlpha).toBeGreaterThan(moderate.textAlpha);
    expect(moderate.textAlpha).toBeGreaterThan(longshot.textAlpha);
  });
});

import { describe, expect, it } from "vitest";
import {
  cellOklch,
  cellPalette,
  COLOR_BUCKETS,
  impliedProbability,
  logOdds,
  oklchToSrgb,
  probabilityHeat,
} from "./cellColor";

describe("computed perceptual cell colour scale (OKLCH on log-odds)", () => {
  it("maps multipliers to clamped win probabilities and log-odds", () => {
    expect(impliedProbability(2)).toBeCloseTo(0.5, 6);
    expect(impliedProbability(10)).toBeCloseTo(0.1, 6);
    expect(impliedProbability(1000)).toBeCloseTo(0.005, 6);
    expect(impliedProbability(0.5)).toBeCloseTo(0.95, 6);
    expect(impliedProbability(Number.NaN)).toBeCloseTo(0.5, 6);

    expect(logOdds(0.5)).toBeCloseTo(0, 6);
    expect(logOdds(0.75)).toBeGreaterThan(0);
    expect(logOdds(0.1)).toBeLessThan(0);
  });

  it("maps multipliers smoothly and monotonically along log-odds heat t in [0, 1]", () => {
    const ms = [1.3, 1.8, 2.5, 4, 8, 16, 32, 64, 120];
    const heats = ms.map(probabilityHeat);
    for (let i = 0; i < heats.length; i++) {
      expect(heats[i]).toBeGreaterThanOrEqual(0);
      expect(heats[i]).toBeLessThanOrEqual(1);
      if (i > 0) {
        expect(heats[i]).toBeGreaterThanOrEqual(heats[i - 1]);
      }
    }
    // Doubling multiplier produces roughly uniform perceptual steps (no abrupt tier jumps)
    const step2to4 = probabilityHeat(4) - probabilityHeat(2);
    const step4to8 = probabilityHeat(8) - probabilityHeat(4);
    const step8to16 = probabilityHeat(16) - probabilityHeat(8);
    expect(Math.abs(step4to8 - step8to16)).toBeLessThan(0.03);
    expect(step2to4).toBeGreaterThan(0.1);
  });

  it("moves lightness toward background and drops chroma as win probability decreases in both light and dark modes", () => {
    const lightLikely = cellOklch(2, "light");
    const lightMid = cellOklch(8, "light");
    const lightRare = cellOklch(32, "light");

    // Warm paper is light (L ~ 0.94): less probable cells become lighter & less chromatic
    expect(lightRare.L).toBeGreaterThan(lightMid.L);
    expect(lightMid.L).toBeGreaterThan(lightLikely.L);
    expect(lightLikely.C).toBeGreaterThan(lightMid.C);
    expect(lightMid.C).toBeGreaterThan(lightRare.C);

    const darkLikely = cellOklch(2, "dark");
    const darkMid = cellOklch(8, "dark");
    const darkRare = cellOklch(32, "dark");

    // Dark surface is dark (L ~ 0.19): less probable cells become darker & less chromatic
    expect(darkRare.L).toBeLessThan(darkMid.L);
    expect(darkMid.L).toBeLessThan(darkLikely.L);
    expect(darkLikely.C).toBeGreaterThan(darkMid.C);
    expect(darkMid.C).toBeGreaterThan(darkRare.C);
  });

  it("converts OKLCH to valid in-gamut sRGB hex across the entire multiplier range", () => {
    for (const mode of ["light", "dark"] as const) {
      for (const m of [1.2, 2, 3, 5, 8, 12, 16, 25, 50, 100]) {
        const pal = cellPalette(m, mode);
        expect(pal.fill).toMatch(/^#[0-9a-f]{6}$/i);
        expect(pal.topTone).toMatch(/^#[0-9a-f]{6}$/i);
        expect(pal.bottomTone).toMatch(/^#[0-9a-f]{6}$/i);
        expect(pal.border).toMatch(/^#[0-9a-f]{6}$/i);
        expect(pal.bucket).toBeGreaterThanOrEqual(0);
        expect(pal.bucket).toBeLessThan(COLOR_BUCKETS);
      }
    }

    // Extreme chroma is gamut-clamped cleanly without NaN or out-of-range channels
    const clamped = oklchToSrgb(0.85, 0.4, 90);
    expect(clamped.r).toBeGreaterThanOrEqual(0);
    expect(clamped.r).toBeLessThanOrEqual(255);
    expect(clamped.g).toBeGreaterThanOrEqual(0);
    expect(clamped.g).toBeLessThanOrEqual(255);
    expect(clamped.b).toBeGreaterThanOrEqual(0);
    expect(clamped.b).toBeLessThanOrEqual(255);
  });

  it("gives likely cells slightly stronger drop shadows than distant longshots", () => {
    const likely = cellPalette(2, "light");
    const rare = cellPalette(40, "light");
    expect(likely.shadowAlpha).toBeGreaterThan(rare.shadowAlpha);
  });
});

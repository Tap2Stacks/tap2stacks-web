import { describe, expect, it } from "vitest";
import { fromBaseUnits, toBaseUnits } from "./units";

describe("units (6 decimals)", () => {
  it('toBaseUnits("12.5") is 12_500_000n', () => {
    expect(toBaseUnits("12.5")).toBe(12_500_000n);
  });

  it("toBaseUnits accepts integer and up to 6 decimals", () => {
    expect(toBaseUnits("0")).toBe(0n);
    expect(toBaseUnits("1")).toBe(1_000_000n);
    expect(toBaseUnits("0.000001")).toBe(1n);
    expect(toBaseUnits("12.345678")).toBe(12_345_678n);
  });

  it("toBaseUnits rejects more than 6 decimals", () => {
    expect(() => toBaseUnits("1.0000001")).toThrow();
    expect(() => toBaseUnits("0.1234567")).toThrow();
    expect(() => toBaseUnits("1.0000000")).toThrow();
  });

  it("toBaseUnits rejects invalid or negative amounts", () => {
    expect(() => toBaseUnits("")).toThrow();
    expect(() => toBaseUnits("-1")).toThrow();
    expect(() => toBaseUnits("abc")).toThrow();
  });

  it('fromBaseUnits(1n) is "0.000001"', () => {
    expect(fromBaseUnits(1n)).toBe("0.000001");
  });

  it("fromBaseUnits formats whole and fractional amounts", () => {
    expect(fromBaseUnits(0n)).toBe("0");
    expect(fromBaseUnits(12_500_000n)).toBe("12.5");
  });
});

import { describe, expect, it } from "vitest";
import { boardScale } from "./boardScale";

describe("boardScale", () => {
  it("uses 84 px square boxes with NOW at 38% on desktop", () => {
    expect(boardScale(1280, 720, false)).toEqual({ nowFraction: 0.38, cellPx: 84, rightGutter: 58, bottomGutter: 20 });
  });

  it("uses 60 px square boxes with NOW at 22% on phone, so 3-4 open columns fit", () => {
    expect(boardScale(390, 700, true)).toEqual({ nowFraction: 0.22, cellPx: 60, rightGutter: 50, bottomGutter: 20 });
  });
});

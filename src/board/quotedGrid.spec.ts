import { describe, expect, it } from "vitest";
import { testCell } from "./fixtures";
import { quotedGridSize } from "./quotedGrid";

function cell(ticker: string, gridTs: number, startTs: number, lower: string) {
  return testCell({
    id: `${ticker}:${gridTs}:${startTs}:${lower}`,
    timeWindowStart: startTs,
    timeWindowEnd: startTs + 5000,
    original: { ...testCell().original, ticker, gridTs, startTs, endTs: startTs + 5000, lowerPrice: lower, upperPrice: String(Number(lower) + 0.03) },
  });
}

describe("quotedGridSize", () => {
  it("counts only the newest grid, not older re-centred rows or the locked windows kept from earlier grids", () => {
    const old = [0, 1, 2, 3, 4, 5].flatMap((c) => ["150.00", "150.03", "150.06"].map((l) => cell("NVDA", 1000, 12000 + c * 5000, l)));
    const fresh = [0, 1, 2].flatMap((c) => ["155.00", "155.03", "155.06", "155.09"].map((l) => cell("NVDA", 2000, 20000 + c * 5000, l)));
    expect(quotedGridSize([...old, ...fresh], "NVDA", 10000, 0.03)).toEqual({ rows: 4, cols: 3 });
  });

  it("ignores other tickers and windows that have ended", () => {
    const cells = [cell("NVDA", 2000, 20000, "155.00"), cell("NVDA", 2000, 4000, "155.03"), cell("TSLA", 3000, 20000, "250.00")];
    expect(quotedGridSize(cells, "NVDA", 10000, 0.03)).toEqual({ rows: 1, cols: 1 });
  });

  it("counts one row even when its price is written differently", () => {
    const cells = [cell("NVDA", 2000, 20000, "155.00"), cell("NVDA", 2000, 25000, "155.0")];
    expect(quotedGridSize(cells, "NVDA", 10000, 0.03)).toEqual({ rows: 1, cols: 2 });
  });

  it("returns zero rows and columns when nothing is quoted", () => {
    expect(quotedGridSize([], "NVDA", 10000, 0.03)).toEqual({ rows: 0, cols: 0 });
  });
});

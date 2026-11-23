import { describe, expect, it, vi } from "vitest";
import { recordingContext } from "../test/recordingContext";
import { CellSpriteCache, quantizeCellSize } from "./cellSprites";
import { LOCKED_BUCKET } from "./cellColor";

function makeFakeFactory() {
  const created: { width: number; height: number; calls: ReturnType<typeof recordingContext>["calls"] }[] = [];
  const factory = (width: number, height: number) => {
    const { ctx, calls } = recordingContext();
    const surface = { width, height, getContext: () => ctx };
    created.push({ width, height, calls });
    return { canvas: surface as unknown as HTMLCanvasElement, ctx };
  };
  return { created, factory };
}

describe("CellSpriteCache", () => {
  it("quantizes cell dimensions to 2 px steps for high cache reuse", () => {
    expect(quantizeCellSize(99.4, 29.8)).toEqual({ qw: 100, qh: 30 });
    expect(quantizeCellSize(100.3, 30.2)).toEqual({ qw: 100, qh: 30 });
    expect(quantizeCellSize(2, 2)).toEqual({ qw: 4, qh: 4 });
  });

  it("caches pre-rendered depth sprites by mode, bucket, quantized size, and DPR with zero shadowBlur", () => {
    const { created, factory } = makeFakeFactory();
    const cache = new CellSpriteCache(factory, 8);

    const a = cache.get(4, 100, 30, 2, "light");
    const b = cache.get(4, 100.4, 29.7, 2, "light");
    expect(a).not.toBeNull();
    expect(b).toBe(a); // Cache hit!
    expect(created).toHaveLength(1);

    // Physical canvas size includes shadow padding and DPR
    expect(created[0].width).toBe((100 + a!.pad * 2) * 2);
    expect(created[0].height).toBe((30 + a!.pad * 2) * 2);

    // Verify gloss / inner edge / rounded corners drawn, and NEVER shadowBlur or lineTo
    const names = created[0].calls.map((c) => c.name);
    expect(names).toContain("quadraticCurveTo");
    expect(names).toContain("fill");
    expect(names).toContain("stroke");
    expect(names).not.toContain("lineTo");

    // Different bucket or theme creates a distinct sprite
    const locked = cache.get(LOCKED_BUCKET, 100, 30, 2, "light");
    const dark = cache.get(4, 100, 30, 2, "dark");
    expect(locked).not.toBe(a);
    expect(dark).not.toBe(a);
    expect(created).toHaveLength(3);
  });

  it("evicts least-recently-used entries when exceeding max capacity", () => {
    const { created, factory } = makeFakeFactory();
    const cache = new CellSpriteCache(factory, 3);

    const s0 = cache.get(0, 80, 30, 1, "light");
    cache.get(1, 80, 30, 1, "light");
    cache.get(2, 80, 30, 1, "light");
    // Touch s0 so bucket 1 becomes oldest
    expect(cache.get(0, 80, 30, 1, "light")).toBe(s0);
    // Insert bucket 3 -> evicts bucket 1
    cache.get(3, 80, 30, 1, "light");
    expect(cache.size).toBe(3);

    const countBefore = created.length;
    expect(cache.get(0, 80, 30, 1, "light")).toBe(s0);
    expect(created.length).toBe(countBefore); // Still cached!

    cache.get(1, 80, 30, 1, "light");
    expect(created.length).toBe(countBefore + 1); // Re-rendered after eviction
  });

  it("returns null gracefully when offscreen 2D context is unavailable", () => {
    const factory = vi.fn(() => null);
    const cache = new CellSpriteCache(factory, 4);
    expect(cache.get(2, 100, 30, 1, "light")).toBeNull();
  });
});

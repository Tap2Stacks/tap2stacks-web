/**
 * Ported from Optionality/near-mvp/api/src/chart-clock.ts.
 * Keeps a monotonic display clock anchored to performance time and re-syncs when drift > 1000 ms.
 */
export function createChartClock() {
  let wallAnchor: number | null = null;
  let performanceAnchor = 0;
  return {
    sample(wallMs: number, perfMs: number): number {
      if (
        wallAnchor === null ||
        Math.abs(wallAnchor + perfMs - performanceAnchor - wallMs) > 1000
      ) {
        wallAnchor = wallMs;
        performanceAnchor = perfMs;
      }
      return wallAnchor + perfMs - performanceAnchor;
    },
    reset() {
      wallAnchor = null;
    },
  };
}

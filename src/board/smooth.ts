/**
 * Ported from createSmoothValue in Optionality/near-mvp/api/src/indicators.ts.
 * Exponential damper for sub-second tick interpolation; snaps on gaps > 1200 ms.
 */
export function createSmoothValue(tauMs = 95) {
  let current: number | null = null;
  let lastPerfMs: number | null = null;
  return {
    sample(target: number, perfMs: number, snap = false): number {
      const dt = lastPerfMs === null ? 0 : Math.max(0, perfMs - lastPerfMs);
      lastPerfMs = perfMs;
      if (current === null || snap || dt > 1200) {
        current = target;
      } else {
        current += (target - current) * (1 - Math.exp(-dt / tauMs));
      }
      return current;
    },
    get value(): number | null {
      return current;
    },
    reset(): void {
      current = null;
      lastPerfMs = null;
    },
  };
}

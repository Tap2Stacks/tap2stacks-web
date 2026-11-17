export function countUp(from: number, to: number, durationMs: number, elapsedMs: number): number {
  const t = durationMs <= 0 ? 1 : Math.max(0, Math.min(1, elapsedMs / durationMs));
  return from + (to - from) * (1 - (1 - t) ** 3);
}

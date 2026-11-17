export type Heat = "none" | "lavender" | "yellow" | "pink";

export function heatFor(multiplier: number): Heat {
  if (!Number.isFinite(multiplier) || multiplier < 3) return "none";
  if (multiplier < 8) return "lavender";
  if (multiplier < 16) return "yellow";
  return "pink";
}

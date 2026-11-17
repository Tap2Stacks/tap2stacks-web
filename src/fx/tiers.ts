export type Tier = "small" | "medium" | "big";

export function winTier(stake: number, payout: number): Tier {
  if (stake >= 25 || payout >= 100) return "big";
  return stake >= 5 ? "medium" : "small";
}

export function rainDurationMs(payout: number, reducedMotion: boolean): number {
  return reducedMotion ? 1000 : Math.max(1200, Math.min(4000, 1000 + payout * 10));
}

export function rainCoinCount(tier: Tier, payout: number, reducedMotion: boolean): number {
  if (tier === "small") return 0;
  if (reducedMotion) return 15;
  if (tier === "medium") return Math.round(20 + Math.min(10, Math.max(0, payout) / 10));
  return Math.round(60 + Math.min(30, Math.max(0, payout) / 20));
}

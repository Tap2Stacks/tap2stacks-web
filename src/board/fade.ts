export type OddsFontWeight = 500 | 600 | 700;

export interface PayoutEmphasisResult {
  textAlpha: number;
  fontWeight: OddsFontWeight;
}

/**
 * Emphasizes higher-payout multipliers with stronger opacity and weight while
 * keeping low-multiplier cells readable.
 */
export function payoutEmphasis(multiplier: number): PayoutEmphasisResult {
  const safe = Number.isFinite(multiplier) && multiplier > 1 ? multiplier : 1;
  const u = Math.max(0, Math.min(1, Math.log(safe) / Math.log(25)));
  const textAlpha = 0.72 + 0.28 * Math.pow(u, 0.85);
  const fontWeight: OddsFontWeight = u >= 0.55 ? 700 : u >= 0.2 ? 600 : 500;
  return { textAlpha, fontWeight };
}

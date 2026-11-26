/**
 * Perceptual cell colour calculation (OKLCH on a log-odds axis).
 *
 * Formula:
 *   1. Implied win probability:
 *        p = clamp(1 / multiplier, 0.005, 0.95)
 *   2. Log-odds (logit):
 *        l = ln(p / (1 - p))
 *   3. Normalized probability-heat coordinate t in [0, 1]:
 *        l_high = ln(0.75 / 0.25)  ≈ +1.0986  (m ≈ 1.33, likely)
 *        l_low  = ln(0.015 / 0.985) ≈ -4.1846 (m ≈ 66.7, longshot)
 *        t = clamp((l_high - l) / (l_high - l_low), 0, 1)
 *      Each doubling of multiplier shifts t by ~0.137 (perceptually uniform,
 *      with zero abrupt tier jumps).
 *   4. Continuous OKLCH trajectory:
 *        H(t) = (92 - 107 * t + 360) mod 360
 *          (warm champagne-gold -> apricot -> coral-rose -> misty rose-lavender)
 *      Light mode (warm paper #F4EBE0, L_bg ≈ 0.942):
 *        L(t) = 0.880 + 0.056 * t^0.9       (recedes toward paper as p falls)
 *        C(t) = 0.092 * (1 - 0.68 * t^1.15) + 0.012
 *      Dark mode (warm obsidian #171513, L_bg ≈ 0.195):
 *        L(t) = 0.345 - 0.115 * t^0.9       (recedes toward dark surface as p falls)
 *        C(t) = 0.088 * (1 - 0.65 * t^1.15) + 0.010
 *   5. Conversion to sRGB uses Björn Ottosson's OKLab -> linear sRGB matrix
 *      with chroma-bisection gamut clamping so every colour is valid sRGB.
 */

import { THEME } from "../ui/theme";

export type BoardThemeMode = "light" | "dark";

export const COLOR_BUCKETS = 24;
export const LOCKED_BUCKET = -1;

const MIN_PROB = 0.005;
const MAX_PROB = 0.95;
const LOG_ODDS_HIGH = Math.log(0.75 / 0.25);
const LOG_ODDS_LOW = Math.log(0.015 / 0.985);
const LOG_ODDS_SPAN = LOG_ODDS_HIGH - LOG_ODDS_LOW;

export interface OklchColor {
  L: number;
  C: number;
  H: number;
}

export interface SrgbColor {
  r: number;
  g: number;
  b: number;
  hex: string;
}

export interface CellPalette {
  bucket: number;
  t: number;
  probability: number;
  oklch: OklchColor;
  fill: string;
  topTone: string;
  bottomTone: string;
  border: string;
  glossTop: string;
  glossBottom: string;
  innerTop: string;
  innerBottom: string;
  shadowColor: string;
  shadowAlpha: number;
}

export interface BoardPalette {
  surface: string;
  ink: string;
  lockedFill: string;
  lockedTop: string;
  lockedBottom: string;
  lockedBorder: string;
  guideAlpha: number;
  axisAlpha: number;
  notOpenWashAlpha: number;
  highlight: string;
  win: string;
  loss: string;
}

export function boardPalette(mode: BoardThemeMode = "light"): BoardPalette {
  if (mode === "dark") {
    return {
      surface: "#171513",
      ink: "#F4EBE0",
      lockedFill: "#201D1A",
      lockedTop: "#25211E",
      lockedBottom: "#1C1917",
      lockedBorder: "#3A342E",
      guideAlpha: 0.11,
      axisAlpha: 0.72,
      notOpenWashAlpha: 0.08,
      highlight: THEME.highlight,
      win: THEME.winOnInk,
      loss: "#E07A6B",
    };
  }
  return {
    surface: THEME.paper,
    ink: THEME.ink,
    lockedFill: THEME.paper,
    lockedTop: "#F8F2EA",
    lockedBottom: "#ECE1D4",
    lockedBorder: "#C5B8A8",
    guideAlpha: 0.08,
    axisAlpha: 0.65,
    notOpenWashAlpha: 0.045,
    highlight: THEME.highlight,
    win: THEME.win,
    loss: THEME.loss,
  };
}

export function impliedProbability(multiplier: number): number {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return 0.5;
  return Math.max(MIN_PROB, Math.min(MAX_PROB, 1 / multiplier));
}

export function logOdds(probability: number): number {
  const p = Math.max(MIN_PROB, Math.min(MAX_PROB, probability));
  return Math.log(p / (1 - p));
}

/** Normalized log-odds coordinate t in [0, 1] (0 = likely, 1 = longshot). */
export function probabilityHeat(multiplier: number): number {
  const p = impliedProbability(multiplier);
  const l = logOdds(p);
  return Math.max(0, Math.min(1, (LOG_ODDS_HIGH - l) / LOG_ODDS_SPAN));
}

export function cellOklch(
  multiplier: number,
  mode: BoardThemeMode = "light",
): OklchColor & { t: number; probability: number } {
  const probability = impliedProbability(multiplier);
  const t = probabilityHeat(multiplier);
  return { ...oklchFromHeat(t, mode), t, probability };
}

export function oklchFromHeat(t: number, mode: BoardThemeMode = "light"): OklchColor {
  const ct = Math.max(0, Math.min(1, t));
  const H = (92 - 107 * ct + 360) % 360;
  if (mode === "dark") {
    const L = 0.345 - 0.115 * Math.pow(ct, 0.9);
    const C = 0.088 * (1 - 0.65 * Math.pow(ct, 1.15)) + 0.01;
    return { L, C, H };
  }
  const L = 0.88 + 0.056 * Math.pow(ct, 0.9);
  const C = 0.092 * (1 - 0.68 * Math.pow(ct, 1.15)) + 0.012;
  return { L, C, H };
}

function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [r, g, bl];
}

function inGamut(r: number, g: number, b: number): boolean {
  return r >= -1e-4 && r <= 1.0001 && g >= -1e-4 && g <= 1.0001 && b >= -1e-4 && b <= 1.0001;
}

function linearToSrgbChannel(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  const encoded = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(encoded * 255)));
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

export function oklchToSrgb(L: number, C: number, H: number): SrgbColor {
  const safeL = Math.max(0, Math.min(1, L));
  const rad = (H * Math.PI) / 180;
  const cosH = Math.cos(rad);
  const sinH = Math.sin(rad);

  const c = Math.max(0, C);
  let [lr, lg, lb] = oklabToLinearSrgb(safeL, c * cosH, c * sinH);

  // Gamut clamp by reducing chroma while preserving perceptual lightness & hue
  if (!inGamut(lr, lg, lb) && c > 0) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) * 0.5;
      const [tr, tg, tb] = oklabToLinearSrgb(safeL, mid * cosH, mid * sinH);
      if (inGamut(tr, tg, tb)) {
        lo = mid;
        lr = tr;
        lg = tg;
        lb = tb;
      } else {
        hi = mid;
      }
    }
  }

  const r = linearToSrgbChannel(lr);
  const g = linearToSrgbChannel(lg);
  const b = linearToSrgbChannel(lb);
  return { r, g, b, hex: `#${toHex(r)}${toHex(g)}${toHex(b)}` };
}

export function bucketForHeat(t: number): number {
  const ct = Math.max(0, Math.min(1, t));
  return Math.min(COLOR_BUCKETS - 1, Math.floor(ct * COLOR_BUCKETS));
}

export function paletteForBucket(bucket: number, mode: BoardThemeMode = "light"): CellPalette {
  if (bucket === LOCKED_BUCKET) {
    const bp = boardPalette(mode);
    return {
      bucket: LOCKED_BUCKET,
      t: 1,
      probability: 0,
      oklch: { L: mode === "dark" ? 0.22 : 0.94, C: 0.01, H: 75 },
      fill: bp.lockedFill,
      topTone: bp.lockedTop,
      bottomTone: bp.lockedBottom,
      border: bp.lockedBorder,
      glossTop: mode === "dark" ? "rgba(255, 248, 235, 0.05)" : "rgba(255, 255, 255, 0.25)",
      glossBottom: "rgba(255, 255, 255, 0)",
      innerTop: mode === "dark" ? "rgba(255, 248, 235, 0.06)" : "rgba(255, 255, 255, 0.35)",
      innerBottom: mode === "dark" ? "rgba(0, 0, 0, 0.2)" : "rgba(29, 27, 24, 0.06)",
      shadowColor: mode === "dark" ? "0, 0, 0" : "29, 27, 24",
      shadowAlpha: mode === "dark" ? 0.14 : 0.04,
    };
  }

  const clampedBucket = Math.max(0, Math.min(COLOR_BUCKETS - 1, Math.floor(bucket)));
  const t = (clampedBucket + 0.5) / COLOR_BUCKETS;
  return buildCellPalette(clampedBucket, t, Math.exp(-(LOG_ODDS_HIGH - t * LOG_ODDS_SPAN)), mode);
}

function buildCellPalette(
  bucket: number,
  t: number,
  probability: number,
  mode: BoardThemeMode,
): CellPalette {
  const oklch = oklchFromHeat(t, mode);
  const fill = oklchToSrgb(oklch.L, oklch.C, oklch.H).hex;

  if (mode === "dark") {
    const topTone = oklchToSrgb(Math.min(0.95, oklch.L + 0.042), oklch.C * 0.9, oklch.H).hex;
    const bottomTone = oklchToSrgb(Math.max(0.08, oklch.L - 0.032), oklch.C * 1.05, oklch.H).hex;
    const border = oklchToSrgb(Math.min(0.75, oklch.L + 0.13), oklch.C * 0.72, oklch.H).hex;
    return {
      bucket,
      t,
      probability,
      oklch,
      fill,
      topTone,
      bottomTone,
      border,
      glossTop: `rgba(255, 248, 235, ${(0.16 * (1 - 0.45 * t)).toFixed(3)})`,
      glossBottom: "rgba(255, 248, 235, 0)",
      innerTop: `rgba(255, 248, 235, ${(0.14 * (1 - 0.4 * t)).toFixed(3)})`,
      innerBottom: "rgba(0, 0, 0, 0.34)",
      shadowColor: "0, 0, 0",
      shadowAlpha: 0.34 * (1 - 0.35 * t),
    };
  }

  const topTone = oklchToSrgb(Math.min(0.985, oklch.L + 0.03), oklch.C * 0.85, oklch.H).hex;
  const bottomTone = oklchToSrgb(Math.max(0.2, oklch.L - 0.028), oklch.C * 1.06, oklch.H).hex;
  const border = oklchToSrgb(Math.max(0.35, oklch.L - 0.17 + 0.04 * t), oklch.C * 0.65, oklch.H).hex;
  return {
    bucket,
    t,
    probability,
    oklch,
    fill,
    topTone,
    bottomTone,
    border,
    glossTop: `rgba(255, 255, 255, ${(0.58 * (1 - 0.35 * t)).toFixed(3)})`,
    glossBottom: "rgba(255, 255, 255, 0)",
    innerTop: `rgba(255, 255, 255, ${(0.72 * (1 - 0.35 * t)).toFixed(3)})`,
    innerBottom: `rgba(29, 27, 24, ${(0.11 * (1 - 0.4 * t)).toFixed(3)})`,
    shadowColor: "29, 27, 24",
    shadowAlpha: 0.14 * (1 - 0.48 * t),
  };
}

export function cellPalette(multiplier: number, mode: BoardThemeMode = "light"): CellPalette {
  const probability = impliedProbability(multiplier);
  const t = probabilityHeat(multiplier);
  const bucket = bucketForHeat(t);
  return buildCellPalette(bucket, t, probability, mode);
}

export function cellTextColor(multiplier: number, mode: BoardThemeMode = "light"): string {
  const t = probabilityHeat(multiplier);
  const H = (92 - 107 * t + 360) % 360;
  const L = mode === "dark" ? 0.82 : 0.48;
  return oklchToSrgb(L, 0.13, H).hex;
}

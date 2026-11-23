# Trading Board Colour, Typography, Depth & Viewport Math

This note documents the perceptual formulas implemented in `src/board/cellColor.ts`, `src/board/fade.ts`, `src/board/cellSprites.ts`, `src/board/lod.ts`, and `src/board/camera.ts`.

## 1. Perceptual Cell Colour (OKLCH on Log-Odds)

Instead of discrete multiplier tiers, every open cell's colour is derived continuously from its implied win probability:

1. **Implied win probability** (clamped to avoid singularities):
   $$p = \mathrm{clamp}\!\left(\frac{1}{m},\; 0.005,\; 0.95\right)$$
2. **Log-odds (logit)**:
   $$\ell = \ln\!\left(\frac{p}{1 - p}\right)$$
3. **Normalized probability-heat coordinate $t \in [0, 1]$** ($t = 0$ is likely, $t = 1$ is longshot):
   $$\ell_{\text{high}} = \ln\!\left(\frac{0.75}{0.25}\right) \approx +1.0986, \qquad \ell_{\text{low}} = \ln\!\left(\frac{0.015}{0.985}\right) \approx -4.1846$$
   $$t(m) = \mathrm{clamp}_{[0, 1]}\!\left(\frac{\ell_{\text{high}} - \ell}{\ell_{\text{high}} - \ell_{\text{low}}}\right)$$
   Each doubling of multiplier advances $t$ by roughly $0.137$, giving uniform perceptual steps with no tier cliffs.
4. **OKLCH trajectory** (warm champagne-gold $\rightarrow$ apricot $\rightarrow$ coral-rose $\rightarrow$ misty rose-lavender):
   $$H(t) = (92 - 107\,t + 360) \bmod 360$$
   - **Warm-paper light mode** (`#F4EBE0`, $L_{\text{bg}} \approx 0.942$):
     $$L(t) = 0.880 + 0.056\,t^{0.9}, \qquad C(t) = 0.092\,(1 - 0.68\,t^{1.15}) + 0.012$$
   - **Dark mode** (`#171513`, $L_{\text{bg}} \approx 0.195$):
     $$L(t) = 0.345 - 0.115\,t^{0.9}, \qquad C(t) = 0.088\,(1 - 0.65\,t^{1.15}) + 0.010$$
   As win probability drops, both lightness (moving toward the background surface) and chroma decrease so unlikely cells recede smoothly.
5. **sRGB conversion**: Exact OKLab $\rightarrow$ linear sRGB matrix with 10-step chroma-bisection gamut clamping, preserving lightness and hue inside `[0, 255]`.

## 2. Probability-Coupled Odds Typography

`cellFade()` combines three multiplicative weights:
- **Price distance**: $w_{\text{row}} = \bigl(1 + (d_{\text{row}} / 5.5)^{1.6}\bigr)^{-1}$
- **Time ahead**: $w_{\text{time}} = 1 - 0.75\,u^{1.1}$ over the visible horizon (capped at 2 minutes)
- **Log-odds probability** (shared with `cellColor.ts`):
  $$w_{\text{prob}}(m) = \begin{cases} 1 & m \le 2 \\ \left(\dfrac{1 - t(m)}{1 - t(2)}\right)^{1.85} & m > 2 \end{cases}$$

From $w = w_{\text{row}}\,w_{\text{time}}\,w_{\text{prob}}$:
- `textAlpha` interpolates smoothly from `MIN_ODDS_ALPHA = 0.28` to `1.0`.
- `tintAlpha` interpolates from `MIN_TINT_ALPHA = 0.48` to `1.0`.
- `fontWeight` steps down with $w$: `700` ($\ge 0.62$) $\rightarrow$ `600` ($\ge 0.38$) $\rightarrow$ `500` ($\ge 0.18$) $\rightarrow$ `400` ($< 0.18$).

## 3. Depth Sprites & 60 fps Mobile Budget

- `cellSprites.ts` quantizes $t$ into `24` open buckets (+ `1` locked bucket) and tile sizes to `2 px` increments, caching offscreen `DPR`-scaled sprites (LRU cap `160`).
- Each sprite pre-bakes a layered soft drop shadow (zero `shadowBlur`), OKLCH body gradient, top gloss reflection, subtle 1 px inner bevel, and crisp border. Per-frame rendering is a single `drawImage`.
- `lod.ts` caps rendered tiles at `MAX_DRAWN_CELLS = 240` by merging cells when zoomed out (using harmonic/probability-mean multiplier $1 / \bar{p}$) and switching odds labels through `full` $\rightarrow$ `compact` $\rightarrow$ `none` as tiles shrink.
- `camera.ts` enforces the `[-5 min, +2 min]` time clamp with iOS-style hyperbolic edge resistance (`rubberBand`), inertial decay (`325 ms`), and snap-back spring (`105 ms`).

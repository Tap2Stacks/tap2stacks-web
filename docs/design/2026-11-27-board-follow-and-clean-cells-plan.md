# Board that follows the price, with clean cells: Implementation Plan

**Goal:** The board always follows the live price (zoom included; a drag glides back after 3 s), open cells become a thin grid with the multiplier only, closed columns are blank, filled tiles appear only for the player's bets and the touched cell, and the line gets a gold tail and a haloed live dot.

**Architecture:** Camera rule changes stay in `camera.ts` (zoom keeps following; an idle timer in `step()` starts a return that keeps the zoom). Drawing moves out of `draw.ts` into two focused files: `drawCells.ts` (grid, multiplier text, bet and hover tiles) and `drawLine.ts` (curve, gold tail, live dot). `boardRuntime.ts` tracks the hovered cell and its fade; `BoardCanvas.tsx` feeds pointer hover and touch.

**Tech Stack:** TypeScript, React 19, canvas 2D, vitest (`src/test/recordingContext.ts` records canvas calls).

**Spec:** `docs/design/2026-11-27-board-follow-and-clean-cells-design.md`

## Global Constraints
- Auto-return delay after a drag: `3000` ms of no drag, pan or momentum. The return keeps the current zoom. The return button still resets zoom to 1.
- Locked rule unchanged: a column is locked when its window starts less than 5 s ahead (`isLocked` in `layout.ts`). Locked and past columns draw no tile and no number.
- Multiplier format: `x2.1` below 10, `x13` at 10 and above (rounded, no `.0`). Micro mode keeps `x13`/`x2`.
- Cream and gold stay; no new fonts. Colours come from `THEME` and `cellColor.ts`.
- Files stay under 800 lines; `draw.ts` must shrink, not grow.
- Gates: `bunx tsc -b`, `bunx vitest run`, `bunx vite build`. Commit as `nvq2309 <nvq2309@gmail.com>` with `core.hooksPath .githooks`. No push.

## Review Focus
1. A drag that ends with a fling: the 3 s timer starts only after momentum and edge spring-back stop, not at finger lift (test in Task 1).
2. Zoom by wheel or pinch while the auto-return timer is running restarts the 3 s timer and keeps the zoom when it returns (test in Task 1).
3. Hover over a locked, past or empty area shows no hover tile; hover over a cell with a bet keeps the bet tile (test in Task 3).
4. Ticker switch while a hover tile is fading: no tile is drawn for the old ticker's cell (test in Task 3).
5. Reduced motion: no tail glow pulse, no hover fade (instant), auto-return jumps without animation (tests in Tasks 1, 3, 4).

---

### Task 1: Camera always follows; drag returns after 3 s

**Files:** Modify `src/board/camera.ts`; Test `src/board/camera.spec.ts`

**Interfaces:**
- Produces: `AUTO_RETURN_MS = 3_000`; `BoardCamera.returnToLive(perfMs: number, nowMs: number, liveCenterPrice: number, reducedMotion: boolean, keepZoom: boolean): void`; `snapToLive(...)` keeps its signature and calls `returnToLive(..., false)`. `SnapAnimation` gains `toZoom: number`.

- [ ] **Step 1: Update and add tests in `camera.spec.ts`**
  - Replace `anchors cursor world coordinate when zooming, and pauses tracking when zooming from live view` and `pauses tracking the price when zooming from live view, keeping the point under the cursor` with `keeps following the live price while zooming from live view`: `zoomAt(0.7, …)` in follow mode → `isFollowing` true, `isZoomed` true, next `step()` viewport has `viewNowMs === nowMs` and `centerPrice === liveCenterPrice`.
  - Keep `anchors cursor world coordinate when zooming while panned away` (drag first, then zoom).
  - `returns to the live price 3 s after a drag, keeping the zoom`: zoom to 0.7, drag 200 px, `endDrag(0, 0)`, step at perf +2999 → `isLive` false; step at +3000 → animation starts; after `SNAP_DURATION_MS` more → `isLive` true, `isFollowing` true, zoom still 0.7 (box side 0.7 × default).
  - `starts the 3 s only after momentum stops`: `endDrag(1.5, 0)`; step every 16 ms; still not live 3000 ms after release while `moving` was true until perf T; live by T + 3000 + `SNAP_DURATION_MS`.
  - `a new drag or zoom restarts the 3 s`: release, step to +2500, `dragBy(10, 0)` + `endDrag(0,0)`, step to +5000 → not live; +5500 → returning.
  - `reduced motion returns at once after 3 s`.
  - Adapt `snapToLive smoothly returns to auto-follow and default zoom` (unchanged behaviour: zoom back to 1).
- [ ] **Step 2: Run** `bunx vitest run src/board/camera.spec.ts` → the new tests FAIL.
- [ ] **Step 3: Implement in `camera.ts`**
  - `zoomAt`: when `following`, only set `this.zoom` (NOW and the live price stay the anchor) and return. When panned away, keep today's cursor anchoring and reset the idle timer.
  - Add `private idleSincePerf: number | null`. `beginDrag`, `dragBy`, `panByPx`, `zoomAt` (panned away) set it to `null`. In `step()`, panned-away branch: if `dragging` or `moving` → `null`; else if `null` → `perfMs`; else if `perfMs - idleSincePerf >= AUTO_RETURN_MS` → `returnToLive(perfMs, nowMs, liveCenterPrice, reducedMotion, true)` and return the snap frame.
  - The snap animation interpolates zoom from `fromZoom` to `toZoom` (1 for the button, the current zoom for the auto-return).
- [ ] **Step 4: Run** `bunx vitest run src/board/camera.spec.ts` → PASS.
- [ ] **Step 5: Commit** `feat: board keeps following the price while zooming; a drag glides back after 3 s`

### Task 2: Clean cells: thin grid and multiplier only

**Files:** Create `src/board/drawCells.ts`; Modify `src/board/draw.ts`, `src/board/lod.ts`, `src/board/fade.ts`, `src/board/cellColor.ts`; Test `src/board/drawCells.spec.ts`, `src/board/draw.spec.ts`, `src/board/lod.spec.ts`, `src/board/fade.spec.ts`

**Interfaces:**
- Produces: `drawCellGrid(ctx, v: BoardViewport, cols: number[], rows: number[], bp: BoardPalette): void` (column edges in ms, row edges in price); `drawCellLabels(ctx, plan: CellLodPlan, v: BoardViewport, mode: BoardThemeMode, bp: BoardPalette): void`; `payoutEmphasis(multiplier: number): { textAlpha: number; fontWeight: 500 | 600 | 700 }` in `fade.ts`; `cellTextColor(multiplier: number, mode: BoardThemeMode): string` in `cellColor.ts`.
- `cellFade` and the cell sprite path are no longer used for open cells; delete what has no caller (keep `cellSprites.ts` only if Task 3 uses it).

- [ ] **Step 1: Write tests**
  - `formatLodMultiplier`: `2.14 → "x2.1"`, `9.96 → "x10"`, `13.4 → "x13"`, `25 → "x25"` in full mode.
  - `payoutEmphasis`: alpha strictly rises from `x1.1` to `x2` to `x5` to `x25`; `x25` alpha is 1 and weight 700; `x1.1` alpha ≥ 0.45 (still readable).
  - `cellTextColor` (light): hue near gold for `x1.3`, near rose for `x25`; contrast against `boardPalette('light').surface` ≥ 4.5:1 for every bucket.
  - `drawCells.spec.ts`: an open unbet cell draws its label and no `drawImage`/`fill` tile; a locked cell (starts 1 s ahead) draws no `fillText`; the grid draws one vertical line per visible column edge right of NOW and none left of NOW.
  - `draw.spec.ts`: replace `locked cells are drawn without heat and dimmed`, `fades far and high-multiplier cells…`, `uses pre-rendered cell sprites…` with the new rules; keep the rest green.
- [ ] **Step 2: Run** `bunx vitest run src/board` → new tests FAIL.
- [ ] **Step 3: Implement**
  - `drawCellGrid`: vertical lines at column edges from NOW's column to the last quoted column, horizontal lines at row edges across the plot; ink at low alpha (start at 0.08, tune by eye); past side keeps row lines only.
  - `drawCellLabels`: skip locked tiles; skip merged tiles' text as today; colour `cellTextColor`, alpha/weight from `payoutEmphasis`; keep the clipped-edge fades from today's `drawTile`.
  - `cellTextColor`: OKLCH with the heat hue `H(t)` from `cellColor.ts`, `L ≈ 0.48`, `C ≈ 0.13` in light mode (dark mode `L ≈ 0.82`), gamut-clamped with the existing converter.
  - `draw.ts` calls `drawCellGrid` and `drawCellLabels` in place of the tile loop; the "Not open yet" wash stays.
- [ ] **Step 4: Run** `bunx vitest run src/board` → PASS.
- [ ] **Step 5: Commit** `feat: board cells are a thin grid with the multiplier only; closed columns are blank`

### Task 3: Bet tiles and the touched cell

**Files:** Modify `src/board/drawCells.ts`, `src/board/boardRuntime.ts`, `src/board/BoardCanvas.tsx`, `src/board/draw.ts` (`BoardScene`); Test `src/board/drawCells.spec.ts`, `src/board/boardRuntime.spec.ts`, `src/board/BoardCanvas.spec.tsx`

**Interfaces:**
- Consumes: `drawCellLabels` from Task 2.
- Produces: `BoardScene.hover?: { cellId: string; alpha: number }`; `drawCellTile(ctx, r: {x,y,w,h}, kind: 'bet' | 'hover', alpha: number, bp: BoardPalette): void`; `BoardRuntime.setHover(clientX: number, clientY: number): void` and `BoardRuntime.clearHover(): void`.

- [ ] **Step 1: Write tests**
  - `drawCellTile` draws a rounded filled tile; `bet` uses the coin gold at low alpha, `hover` uses ink at low alpha.
  - `drawBoard` draws a bet tile under every cell that has a stack (open or past), before the stack.
  - `boardRuntime.spec.ts`: `setHover` over a tappable cell sets the scene hover to that cell with alpha rising to ≥ 0.95 within 200 ms; over a locked or empty point it clears; `clearHover` fades to 0; a ticker switch clears it; reduced motion jumps to 1/0.
  - `BoardCanvas.spec.tsx`: mouse `pointermove` without buttons calls `setHover`; `pointerleave` calls `clearHover`; touch `pointerdown` calls `setHover`, `pointerup` calls `clearHover`; a drag clears it.
- [ ] **Step 2: Run** the three spec files → FAIL.
- [ ] **Step 3: Implement** the hover state in `BoardRuntime` with `createSmoothValue(40)` for the alpha (about 120 ms to settle), keeping the last cell id while it fades out; keep redrawing while the alpha is moving (add it to the redraw check in `draw()`). Wire the pointer events in `BoardCanvas.tsx` (add `onPointerLeave`).
- [ ] **Step 4: Run** the spec files → PASS.
- [ ] **Step 5: Commit** `feat: filled tiles only for the player's bets and the touched cell`

### Task 4: Line with a gold tail and a haloed live dot

**Files:** Create `src/board/drawLine.ts`; Modify `src/board/draw.ts`; Test `src/board/drawLine.spec.ts`, `src/board/draw.spec.ts`

**Interfaces:**
- Produces: `TAIL_MS = 4_000`; `drawPriceLine(ctx, line: Pt[], tailStartX: number, bp: BoardPalette): void`; `drawLiveDot(ctx, x: number, y: number, nowMs: number, reducedMotion: boolean, bp: BoardPalette): void`.

- [ ] **Step 1: Write tests**
  - The line still uses `bezierCurveTo` and never `lineTo` (move today's test).
  - The tail is a second stroke over the points with `x >= tailStartX`, using a linear gradient from transparent ink-gold at `tailStartX` to `THEME` gold at the head.
  - `drawLiveDot` draws a radial-gradient halo and a solid dot; with reduced motion the halo radius is constant across `nowMs`.
  - The dashed live guide is drawn with alpha ≤ 0.35.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**: main stroke 3 px ink; tail 3.5 px; halo radius about 14 px with the existing 1.6 s pulse; `draw.ts` computes `tailStartX = timeToX(v, v.nowMs - TAIL_MS)` and calls both.
- [ ] **Step 4: Run** `bunx vitest run src/board` → PASS.
- [ ] **Step 5: Commit** `feat: price line with a gold tail and a haloed live dot`

### Task 5: Look check and gates

**Files:** Tuning only in the files above.

- [ ] **Step 1:** `DEV_BACKEND_PROXY=https://45-77-250-147.sslip.io bun run dev`; take screenshots at 1440×900 and 390×844 (scale 2) of `/trade` three times 2 s apart, plus one while hovering a cell and one zoomed out.
- [ ] **Step 2:** Tune grid alpha, label emphasis, tail and halo until: the line reads first; labels are readable on the phone; nothing is drawn in closed columns or behind the line.
- [ ] **Step 3:** `bunx tsc -b && bunx vitest run && bunx vite build` → all pass. `bunx eslint src/board` → no new errors.
- [ ] **Step 4: Commit** `style: tune board grid, labels and line by eye` (only if Step 2 changed anything).

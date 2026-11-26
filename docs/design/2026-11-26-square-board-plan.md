# Square board (step 1, web only) Implementation Plan

**Goal:** Square boxes (84 px desktop, 60 px phone by default) with one zoom that scales both directions, zooming out to every priced box (max about 200, never below 28 px).

**Architecture:** The camera keeps one zoom `z` on a default box side `cellPx`; `msPerPx = 5000 / (cellPx·z)` and `pricePerPx = priceStep / (cellPx·z)`, so boxes stay square. `boardScale` supplies `cellPx` and NOW's position per device; the runtime passes the quoted row and column counts so the camera can compute the zoom-out limit.

**Tech Stack:** TypeScript, React, canvas 2D, vitest.

**Spec:** `docs/design/2026-11-26-square-board-design.md`

## Global Constraints
- Column width `5_000` ms. Default side `84` px desktop, `60` px phone. Zoom in max `2×` default. Floor `28` px. Max priced boxes in view `200`.
- NOW at `0.38` of plot width on desktop, `0.35` on phone. Gutters unchanged: right 58 / 50 px, bottom 20 px.
- Zooming while following stays live; zoom anchors on the cursor only when panned away; Live resets zoom.
- Gates: `npx tsc -b --noEmit`, `npx vitest run`, `npx vite build`. Commit as nvq2309 with the repo hooks.

## Review Focus
1. No quotes yet (0 quoted rows or columns): the zoom-out limit falls back to the 28 px floor, with no division by zero (test in Task 1).
2. Ticker switch with a different price step (0.01 vs 0.05): boxes stay square (test in Task 1).
3. Window resize or phone rotation: the current zoom is re-clamped to the new limits (test in Task 1).
4. Horizontal trackpad swipe still pans and does not zoom (test in Task 2).
5. Pinch or wheel while following keeps the board live (test in Task 1).

---

### Task 1: Square camera with one zoom

**Files:** Modify `src/board/camera.ts`; Test `src/board/camera.spec.ts`

**Interfaces:**
- Produces: `WINDOW_MS = 5_000`, `MAX_CELL_ZOOM = 2`, `MIN_CELL_PX = 28`, `MAX_PRICED_CELLS_IN_VIEW = 200`; `CameraMetrics` gains `cellPx: number`, `quotedRows: number`, `quotedCols: number` and drops `visibleRows`, `defaultAheadMs`; `minCellPx(metrics: CameraMetrics): number`; `baseScaleFor(metrics) → { baseMsPerPx, basePricePerPx, minZoom }`; `clampZoom(zoom: number, minZoom: number): number`; `BoardCamera.zoomAt(factor, anchorX, anchorY, metrics, nowMs, liveCenterPrice)`. `MAX_TIME_ZOOM`, `MIN_PRICE_ZOOM`, `MAX_PRICE_ZOOM` are removed.

- [ ] **Step 1: Rewrite the zoom tests in `camera.spec.ts` (keep the pan, rubber-band and momentum tests, adapted to the new metrics)**
  - `square at default`: desktop metrics (1280×720, gutters 58/20, nowFraction 0.38, cellPx 84, step 0.03, rows 20, cols 6) → `viewport.msPerPx * 84 ≈ 5000` and `viewport.pricePerPx * 84 ≈ 0.03`.
  - `stays square after zoom`: after `zoomAt(0.6, …)` and `zoomAt(1.7, …)`, `5000 / msPerPx ≈ priceStep / pricePerPx`; same with priceStep 0.01 and 0.05.
  - `zoom in stops at 2× default`: repeated `zoomAt(1.35)` → box side 168 px.
  - `minCellPx`: rows 20 × cols 6 → 35; rows 20 × cols 10 → 35; rows 20 × cols 24 → about 51.5 (±0.5) and the priced boxes in view at that side ≤ 200; 375×500 phone (gutters 50/20, nowFraction 0.35, rows 20, cols 6) → 28; rows 0 or cols 0 → 28.
  - `re-clamps on resize`: zoomed fully out on 1280×720, then `step` with 1280×400 metrics → side ≥ the new `minCellPx`.
  - `zoom while following stays live`: `zoomAt(0.7)` in follow mode → `isFollowing` true, `isZoomed` true.
  - Adapt: `anchors cursor world coordinate when panned away`; `snapToLive resets zoom to 1`.
- [ ] **Step 2:** `npx vitest run src/board/camera.spec.ts` → FAIL (new exports and fields missing).
- [ ] **Step 3: Implement in `camera.ts`.** Replace `timeZoom`/`priceZoom` with one `zoom` everywhere (state, snap animation, step, drag, pan). `minCellPx` = max of: fit-all side `min(plotH / quotedRows, futureW / quotedCols)` (`futureW = plotW·(1 − nowFraction)`), the smallest side at which `min(rows, plotH/s) · min(cols, futureW/s) ≤ 200` (continuous counts), and 28; quotedRows or quotedCols ≤ 0 → 28. `minZoom = min(1, minCellPx / cellPx)`.
- [ ] **Step 4:** `npx vitest run src/board/camera.spec.ts` → PASS.

### Task 2: Device scale, runtime counts and gestures

**Files:** Modify `src/board/boardScale.ts`, `src/board/boardRuntime.ts`, `src/board/BoardCanvas.tsx`; Test `src/board/boardScale.spec.ts`, `src/board/BoardCanvas.spec.tsx`

**Interfaces:**
- Consumes: Task 1's `CameraMetrics` and `zoomAt(factor, …)`.
- Produces: `boardScale(width, height, isPhone) → { nowFraction, cellPx, rightGutter, bottomGutter }`; `BoardRuntime.zoomAt(factor: number, canvasX: number, canvasY: number)`.

- [ ] **Step 1: Tests.** `boardScale.spec.ts`: desktop → `{ nowFraction: 0.38, cellPx: 84, rightGutter: 58, bottomGutter: 20 }`; phone → `{ 0.35, 60, 50, 20 }`. `BoardCanvas.spec.tsx`: a horizontal wheel (`deltaX` 40, `deltaY` 2) calls `panBy` and not `zoomAt`; a vertical wheel calls `zoomAt` with one factor.
- [ ] **Step 2:** run both specs → FAIL.
- [ ] **Step 3: Implement.** `boardScale` drops `visibleRows`, `defaultAheadMs`, the `quotedAheadMs` parameter and the extended-horizon branch. The runtime counts `quotedRows` (distinct `lowerPrice`) and `quotedCols` (distinct window start) over quoted future cells and passes them with `cellPx`. The wheel uses one factor (shift and alt variants removed); pinch passes its scale as the factor.
- [ ] **Step 4:** `npx vitest run src/board` → PASS.

### Task 3: Labels grow with the box

**Files:** Modify `src/board/lod.ts`, `src/board/draw.ts`; Test `src/board/lod.spec.ts`

**Interfaces:** Produces `labelFontPx(mode: CellTextMode, cellW: number): number` (used by `draw.ts` instead of its inline sizes).

- [ ] **Step 1: Test** `labelFontPx`: full at 84 → 17, at 168 → 20, at 40 → 11; compact at 28 → 9.5, at 30 → 10; micro → 8.5.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement:** full = `min(20, max(11, round(cellW·0.2)))`; compact and micro keep today's values.
- [ ] **Step 4:** run → PASS.

### Task 4: Verify, commit, deploy

- [ ] **Step 1:** `npx tsc -b --noEmit` (clean), `npx vitest run` (all pass; report the count), `npx vite build` (OK).
- [ ] **Step 2:** Look at the board locally at 1280×720 and 390×844: default boxes square at 84 / 60 px; zoomed fully out shows all quoted boxes with multipliers.
- [ ] **Step 3:** Commit: `feat: square board with one zoom and larger boxes`.
- [ ] **Step 4:** Deploy web: `ST_TEST_HOST=t2s-host tools/remote/st-test.sh deploy web`; check the live page loads (200) and shows the new board. Pushing to GitHub waits for the owner's go.

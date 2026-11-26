# Board that follows the price, with clean cells

Approved by the owner on 2026-11-27.

## Intent and why
The price line should be the main thing on the board, like the clean tap-trading boards players already know: the live dot stays put while the grid glides under it, and the cells are light enough that the line and the payouts read at a glance. Today the board draws filled pastel tiles everywhere, including the closed columns under the live dot, and it stops following the price as soon as the player zooms or drags. The look stays ours (cream and gold); only clarity and motion change.

## Goals, non-goals, anti-goals
| Type | Item |
|---|---|
| Goal | The board always follows the live price. Zooming changes the box size around the live dot and keeps following. Dragging lets the player look back; 3 s after the finger lifts, the board glides back to the live price. |
| Goal | Open cells have no filled tile: a thin grid and the multiplier only. Bigger payouts read stronger. |
| Goal | Columns that are closed or about to close (start less than 5 s ahead) are blank: no tile, no number. |
| Goal | The past side (left of the live dot) shows only the line on a faint grid. |
| Goal | A filled tile appears only for the player's own bets (with the coin stack) and for the cell under the finger or cursor. |
| Goal | The line is a smooth curve with a glowing live dot and a short bright tail that fades into the line. |
| Non-goal | Dark board, new colours or fonts. Cream and gold stay. |
| Non-goal | Odds, engine, backend, tap rules, settlement. |
| Anti-goal | A copy of another product's look (its colours, fonts or layout details). |
| Anti-goal | Dropping below 60 fps on a phone, or multipliers too faint to read. |

## Constraints
- Web only: `src/board/camera.ts`, `boardRuntime.ts`, `BoardCanvas.tsx` (gestures), `draw.ts`, `lod.ts`, `fade.ts`, `cellColor.ts`, `cellSprites.ts`.
- Builds on the square board (2026-11-26): square boxes, one zoom, 84 px desktop / 60 px phone, NOW at 38% / 35%, zoom limits unchanged.
- Gates stay green: `tsc`, `vitest`, `vite build`. Tests that encode "zooming pauses tracking" are updated to the new rule.

## Approaches
| Approach | Trade-off | Picked |
|---|---|---|
| Change the existing 2D canvas renderer and camera | Small, keeps all tested camera, gesture and stack code | **Yes** |
| Rewrite the board in WebGL for glow effects | Nicer glow, but a rewrite one week before the deadline | No |
| DOM or CSS grid for cells | Slower with hundreds of moving cells | No |

## Decided details
**Following.** `zoomAt` keeps `following = true` when the board was following; NOW keeps its screen position and the live dot stays the anchor (reverts the "zooming pauses tracking" rule). A drag still pauses following; when the last finger lifts and no drag or momentum is active, a 3 s timer starts, then the camera glides back (existing snap animation, at the current zoom). A new drag cancels the timer. The return button stays: it shows while away from live or zoomed, and tapping it returns at once and resets the box size.

**Cells.**
- Grid: thin vertical column lines and horizontal row lines across the quoted area, low ink alpha; the past side keeps faint row lines only.
- Text: multiplier only, centred. Emphasis (alpha and weight) rises with the payout. Colour from the existing heat palette. Format `x2.1` below 10, `x13` at 10 and above (no `.0`).
- Locked or closed columns: nothing drawn but the grid.
- Bets: the existing coin stack sits on a soft gold tile.
- Touch or hover: a soft rounded tile fades in under the pointer (about 120 ms) and fades out when it leaves.

**Line.** Same smoothing as today. Slightly thicker stroke; the last few seconds are drawn in gold, fading into ink; the live dot gets a soft gold halo with the existing pulse. The dashed live-price guide gets fainter.

**Phone layout (owner's call after review, 2026-11-27).** On phones NOW moves from 35% to 22% of the plot width, so 3-4 open columns fit beside the live dot instead of 2. Desktop stays at 38%.

## Left to the builder
Exact alphas, line widths, tail length, halo size, emphasis curve and the hover fade timing, tuned by eye on desktop and phone screenshots. How tests are split.

# Square board: bigger boxes, one zoom, up to 200 priced boxes

Approved by the owner on 2026-11-26.

## Intent and why
Boxes near the live price should feel inviting to tap: bigger and square, not thin wide strips. Players should still sense the reach of the board, so zooming out reveals more priced boxes, up to about 200, and boxes further ahead in time are priced and drawn too.

## Goals, non-goals, anti-goals
| Type | Item |
|---|---|
| Goal | Every box is square on screen at every zoom level: one box is 5 seconds wide and one price step tall, drawn the same number of pixels both ways. |
| Goal | Default box side: **84 px on desktop, 60 px on phone**. |
| Goal | Zooming out shows more priced boxes, stopping when about 200 are in view (or when every priced box fits, whichever comes first). Zooming in stops at 2× the default side. |
| Goal | The engine prices **10 columns (50 s ahead) × 20 rows = 200 boxes**, after the odds check below passes. |
| Non-goal | New odds maths. Columns 7-10 use the current model unchanged. |
| Non-goal | Changes to taps, settlement, proofs or the backend. The backend already accepts any column. |
| Anti-goal | Odds hidden when zoomed out (boxes so small that the multipliers disappear). |
| Anti-goal | Turning on 10 columns live before the owner has seen the odds check. |

## Constraints
- Web: `src/board/camera.ts`, `boardScale.ts`, `BoardCanvas.tsx` (wheel and pinch), `lod.ts` (label sizes). The board already draws up to 240 tiles (`MAX_DRAWN_CELLS`) and supports 2 minutes ahead (`FUTURE_LIMIT_MS`).
- Engine: the column count comes from `ENGINE_QUOTE_WINDOWS` (default 6) in `tools/remote/docker-compose.yml` (the owner's deploy folder, outside the four repos). No engine code change is expected.
- Odds pass rule (owner, unchanged): every player style's pooled edge is above 0, and the average is 2-5%.
- Existing web gates stay green: `tsc`, `vitest` (296 tests today), `vite build`.

## Approaches
| Approach | Trade-off | Picked |
|---|---|---|
| One zoom: the camera keeps a single box side `s` (px); time and price scales both derive from it | Square at every zoom; one gesture model; replaces the two-zoom camera state | **Yes** |
| Keep separate time and price zoom, start square | The first pinch breaks the square | No |
| Square only at the default view | Same problem; zoom undoes it | No |
| Extra boxes from more price rows (34 × 6) | Mostly far long shots at the x25 cap; no reach in time | No (owner picked more time) |

Delivery is in two steps so something testable ships fast:
1. **Web only:** square boxes, the new default size and one zoom go live with today's 120 priced boxes. Zoom-out then shows all 120.
2. **Engine setting:** run the odds check for 10 columns. Only if it passes and the owner has seen it, set `ENGINE_QUOTE_WINDOWS=10` and deploy the engine. The web picks up 200 boxes with no further change.

## Decided details
**Scale.** With box side `s` px, column width 5 000 ms and row height `priceStep`:
`msPerPx = 5000 / s` and `pricePerPx = priceStep / s`. The camera stores `s` (or a zoom factor on `s_default`) instead of `timeZoom` and `priceZoom`.

**Zoom limits.**
- `s_max = 2 × s_default`.
- `s_min` = the largest of: (a) the side at which every priced box fits (rows: plot height / quoted rows; columns: future width / quoted columns); (b) the side at which the priced boxes in view number 200; (c) a readability floor of **28 px**, so multipliers always show.
- Desktop today (20 rows, 6 columns): about 34 px when fully out. Phone: the 28 px floor binds, so not every box fits, and that is accepted.

**NOW position.** Desktop puts NOW at 38% of the plot width, phone at 35%. At the default size that shows about 8 columns ahead on desktop and about 3-4 on phone; with 6 priced columns the rest of the future area stays empty until step 2.

**Gestures.** Wheel and pinch apply one factor to `s` (ctrl-wheel and pinch as today; plain vertical wheel zooms too). **Zooming while following the live price stays live:** NOW keeps its position and the board keeps moving, so a player can watch a zoomed-out board in real time. Only when the player has panned away (not following) does the point under the finger or cursor stay fixed while zooming. The Live button shows when panned or zoomed, as today; pressing it re-follows NOW and resets `s` to the default. Vertical panning stays within the quoted rows plus the existing rubber band.

**Labels.** Multiplier text scales with the box: full labels at the default size, compact at small sizes. The 28 px floor keeps at least compact labels on every priced box.

**Odds check (step 2).** Step 2 waits for the 2026-11-28 price-feed decision and tests **whatever setup is live after it** (feed, model and cap). On the analysis server, re-run the existing player-style backtest with 10 windows on that decision run's price data. Report, **per ticker**, per style and per column (1-10): pooled edge, average edge and the count of taps. Columns 7-10 are judged on their own against the owner's rule; any style that already fails on columns 1-6 under the live setup is reported separately as an existing issue, not as a reason the new columns fail. The owner sees the table and decides before anything changes.

**Switch per ticker.** A ticker whose columns 7-10 pass gets 10 columns through `ENGINE_QUOTE_WINDOWS_BY_TICKER` (for example `NVDA=10`); a ticker that fails stays at 6. Checked live on 2026-11-26: `ENGINE_QUOTE_WINDOWS=6` and the per-ticker override is empty, so both tickers price 120 boxes today. The web's existing 24-column path stays as it is (unused).

## Left to the builder
How the single zoom is stored (side in px or a factor), the exact label font sizes, the zoom sensitivity, and how tests are split. Keep the camera's existing momentum, rubber band and snap behaviour.

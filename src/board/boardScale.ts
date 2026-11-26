export const TIME_AXIS_HEIGHT = 20;

/** Default square box side in px: one 5-second window wide, one price step tall. */
export const DESKTOP_CELL_PX = 84;
export const PHONE_CELL_PX = 60;

/**
 * Default board layout per device. Boxes are square (see camera.ts); NOW sits
 * left of centre so more of the future shows. A right gutter holds the live
 * price tag and a bottom lane holds the time axis, so NOW never overlaps boxes.
 */
export function boardScale(
  _width: number,
  _height: number,
  isPhone: boolean,
): {
  nowFraction: number;
  cellPx: number;
  rightGutter: number;
  bottomGutter: number;
} {
  if (!isPhone) {
    return { nowFraction: 0.38, cellPx: DESKTOP_CELL_PX, rightGutter: 58, bottomGutter: TIME_AXIS_HEIGHT };
  }
  return { nowFraction: 0.22, cellPx: PHONE_CELL_PX, rightGutter: 50, bottomGutter: TIME_AXIS_HEIGHT };
}

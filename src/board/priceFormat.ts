/** Format a price with exactly the number of decimals required by the row step. */
export function formatBoardPrice(price: number, step: number): string {
  if (!Number.isFinite(price)) return '–';
  const safeStep = Number.isFinite(step) && step > 0 ? step : .01;
  let precision = 0;
  while (precision < 10 && Math.abs(safeStep * 10 ** precision - Math.round(safeStep * 10 ** precision)) > 1e-8) precision++;
  return price.toFixed(precision);
}

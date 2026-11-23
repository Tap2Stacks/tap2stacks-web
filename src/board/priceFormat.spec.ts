import { describe, expect, it } from 'vitest';
import { formatBoardPrice } from './priceFormat';
describe('formatBoardPrice', () => {
  it('uses the precision of the price step with fixed decimals and no excess padding', () => {
    expect(formatBoardPrice(155.126, .01)).toBe('155.13');
    expect(formatBoardPrice(143.6, .01)).toBe('143.60');
    expect(formatBoardPrice(155.1, .01)).toBe('155.10');
    expect(formatBoardPrice(155, .01)).toBe('155.00');
    expect(formatBoardPrice(155.126, .1)).toBe('155.1');
    expect(formatBoardPrice(155.1236, .001)).toBe('155.124');
    expect(formatBoardPrice(7076, 1.5)).toBe('7076.0');
    expect(formatBoardPrice(7077.5, 1.5)).toBe('7077.5');
  });
});

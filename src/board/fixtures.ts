import type { CellData } from '../store';
export function testCell(overrides: Partial<CellData> = {}): CellData {
    return { id: 'NVDA:15000:20000:155.00:155.03', timeWindowStart: 15000, timeWindowEnd: 20000, priceLevel: 155.015, multiplier: 4.1, status: 'active', original: { ticker: 'NVDA', gridTs: 10000, startTs: 15000, endTs: 20000, lowerPrice: '155.00', upperPrice: '155.03', rewardRate: '4.1', gridSignature: 'sig' }, ...overrides };
}

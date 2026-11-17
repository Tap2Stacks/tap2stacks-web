import { describe, it, expect } from 'vitest';
import { addPendingCoin, applyOrderUpdate, stackTotals, expirePending, stacksFromOpenOrders } from './stacks';
import type { Coin } from './types';
const coin = (id: string, amount = 5): Coin => ({ clientTapId: id, amount, rate: 4.1, status: 'pending', placedAt: 0 });
const initial = () => addPendingCoin(addPendingCoin({}, 'c', 'NVDA', coin('a')), 'c', 'NVDA', coin('b', 10));
describe('stacks', () => {
    it('two taps on one cell make a stack of 2 with stake 15 immutably', () => { const s = initial(); expect(stackTotals(s.c)).toEqual({ count: 2, stake: 15, openStake: 15 }); expect(addPendingCoin(s, 'c', 'NVDA', coin('d')).c.coins).toHaveLength(3); expect(s.c.coins).toHaveLength(2); });
    it('server OPEN with the same clientTapId confirms that coin; replay is idempotent', () => { const u = { cellId: 'c', clientTapId: 'a', orderId: 'o', status: 'OPEN' }; const s = applyOrderUpdate(initial(), u); expect(s.c.coins[0].status).toBe('open'); expect(applyOrderUpdate(s, u).c.coins).toHaveLength(2); });
    it('REJECTED pops the coin and keeps others', () => { const s = applyOrderUpdate(initial(), { cellId: 'c', clientTapId: 'a', status: 'REJECTED' }); expect(stackTotals(s.c)).toEqual({ count: 1, stake: 10, openStake: 10 }); expect(s.c.coins[0].status).toBe('rejected'); });
    it.each([['WIN', 'won'], ['LOSS', 'lost'], ['VOIDED', 'void'], ['SETTLED', 'lost']])('maps %s to %s', (status, result) => { expect(applyOrderUpdate(initial(), { cellId: 'c', clientTapId: 'a', status }).c.coins[0].status).toBe(result); });
    it('rebuilds stacks from open orders after reconnect', () => { const s = stacksFromOpenOrders([{ cellId: 'c', orderId: '1', status: 'OPEN', amount: '5', ticker: 'NVDA' }, { cellId: 'c', orderId: '2', status: 'OPEN', amount: '10', ticker: 'NVDA' }, { cellId: 'd', orderId: '3', status: 'OPEN', amount: '1', ticker: 'TSLA' }]); expect(Object.keys(s)).toHaveLength(2); expect(stackTotals(s.c).stake).toBe(15); });
    it('pending coin times out to rejected after 5 s', () => { expect(expirePending(initial(), 4999).c.coins[0].status).toBe('pending'); expect(expirePending(initial(), 5001).c.coins.every(c => c.status === 'rejected')).toBe(true); });
});
it('keeps references when nothing expires; ignores unknown and late updates',()=>{
 const s=initial();expect(expirePending(s,100)).toBe(s);expect(applyOrderUpdate(s,{})).toBe(s);expect(applyOrderUpdate(s,{cellId:'c',status:'OPEN'})).toBe(s);
 const won=applyOrderUpdate(s,{clientTapId:'a',status:'WIN'});expect(applyOrderUpdate(won,{clientTapId:'a',status:'OPEN'})).toBe(won);
});
it('builds missing cellId from order bounds and settles by orderId',()=>{
 const s=stacksFromOpenOrders([{orderId:'o',status:'OPEN',amount:5,cell:{ticker:'NVDA',startTs:15000,endTs:20000,lowerPrice:'155.00',upperPrice:'155.03',rewardRate:'4.1'}}]);const key=Object.keys(s)[0];
 expect(key).toBe('NVDA:15000:20000:155.00:155.03');expect(applyOrderUpdate(s,{orderId:'o',status:'SETTLED',settledWin:'true'})[key].coins[0].status).toBe('won');
});

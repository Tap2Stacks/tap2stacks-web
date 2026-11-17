import { beforeEach, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { placeTap } from './placeTap';
import { useGameStore } from '../store';
import { testCell } from './fixtures';
const args = () => ({ cell: testCell(), amount: 5, balance: 100, feedStale: false, nowMs: 10000, socket: { emit: vi.fn() }, wssKey: 'abcd', address: '0xabc' });
beforeEach(() => useGameStore.setState({ stacks: {} }));
it('placeTap signs HMAC-SHA256 and immediately adds a pending coin', () => { const a = args(), r = placeTap(a); expect(r.ok).toBe(true); expect(a.socket.emit).toHaveBeenCalledWith('place_bet', expect.objectContaining({ userSignature: createHmac('sha256', Buffer.from('abcd', 'hex')).update(`10000:${a.cell.id}:5`).digest('hex') })); expect(useGameStore.getState().stacks[a.cell.id].coins).toHaveLength(1); });
it('refuses taps while feed is stale before signing', () => { const a = { ...args(), feedStale: true }; expect(placeTap(a)).toEqual({ ok: false, reason: 'FEED_PAUSED' }); expect(a.socket.emit).not.toHaveBeenCalled(); });
it('refuses when the cell would pass $100', () => { const a = args(); for (let i = 0; i < 4; i++)
    placeTap({ ...a, amount: 25 }); expect(placeTap(a)).toEqual({ ok: false, reason: 'CELL_LIMIT' }); });
it('refuses when amount > balance', () => expect(placeTap({ ...args(), balance: 1 })).toEqual({ ok: false, reason: 'INSUFFICIENT_BALANCE' }));
it('refuses locked, unsigned, and invalid taps', () => { expect(placeTap({ ...args(), nowMs: 10001 })).toEqual({ ok: false, reason: 'WINDOW_CLOSING' }); expect(placeTap({ ...args(), wssKey: null })).toEqual({ ok: false, reason: 'NOT_SIGNED_IN' }); expect(placeTap({ ...args(), amount: NaN }).ok).toBe(false); });
it('reserves pending balance across different cells and releases rejection',()=>{
 const a={...args(),balance:5};expect(placeTap(a).ok).toBe(true);
 const second={...a,cell:testCell({id:'second'})};expect(placeTap(second)).toEqual({ok:false,reason:'INSUFFICIENT_BALANCE'});
 const pending=useGameStore.getState().stacks[a.cell.id].coins[0];useGameStore.getState().updateOrder({cellId:a.cell.id,clientTapId:pending.clientTapId,status:'REJECTED'});
 expect(placeTap(second).ok).toBe(true);
});
it('emit failure rejects pending coin',()=>{const a=args();a.socket.emit.mockImplementation(()=>{throw new Error('closed');});expect(placeTap(a).ok).toBe(false);expect(useGameStore.getState().stacks[a.cell.id].coins[0].status).toBe('rejected');});

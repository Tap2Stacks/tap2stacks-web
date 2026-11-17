import CryptoJS from 'crypto-js';
import { useGameStore, type CellData } from '../store';
import { isLocked } from './layout';
import { stackTotals } from './stacks';
type Reason = 'FEED_PAUSED' | 'WINDOW_CLOSING' | 'INSUFFICIENT_BALANCE' | 'NOT_SIGNED_IN' | 'CELL_LIMIT';
export function placeTap(args: {
    cell: CellData;
    amount: number;
    balance: number;
    feedStale: boolean;
    nowMs: number;
    socket: {
        emit(ev: string, p: unknown): void;
    } | null;
    wssKey: string | null;
    address: string | null;
}): {
    ok: true;
    clientTapId: string;
} | {
    ok: false;
    reason: Reason;
} {
    const { cell, amount, balance, feedStale, nowMs, socket, wssKey, address } = args;
    if (feedStale)
        return { ok: false, reason: 'FEED_PAUSED' };
    if (isLocked(cell.timeWindowStart, nowMs) || cell.status !== 'active')
        return { ok: false, reason: 'WINDOW_CLOSING' };
    if (!socket || !wssKey || !address)
        return { ok: false, reason: 'NOT_SIGNED_IN' };
    if (!Number.isFinite(amount) || amount < 1 || amount > 25 || amount > balance)
        return { ok: false, reason: 'INSUFFICIENT_BALANCE' };
    const state = useGameStore.getState(), stack = state.stacks[cell.id];
    if ((stack ? stackTotals(stack).openStake : 0) + amount > 100)
        return { ok: false, reason: 'CELL_LIMIT' };
    const pending = Object.values(state.stacks).flatMap(s => s.coins).filter(c => c.status === 'pending').reduce((n, c) => n + c.amount, 0);
    if (amount > balance - pending)
        return { ok: false, reason: 'INSUFFICIENT_BALANCE' };
    const clientTapId = crypto.randomUUID();
    const signature = CryptoJS.HmacSHA256(`${cell.original.gridTs}:${cell.id}:${amount}`, CryptoJS.enc.Hex.parse(wssKey)).toString(CryptoJS.enc.Hex);
    const coin = { clientTapId, amount, rate: cell.multiplier, status: 'pending' as const, placedAt: Date.now() };
    state.addPendingCoin(cell.id, cell.original.ticker, coin);
    try {
        socket.emit('place_bet', { userId: address, marketId: cell.original.ticker, amount: String(amount), cell: cell.original, userSignature: signature, clientTapId });
    }
    catch {
        useGameStore.getState().updateOrder({ cellId: cell.id, clientTapId, status: 'REJECTED' });
        return { ok: false, reason: 'NOT_SIGNED_IN' };
    }
    return { ok: true, clientTapId };
}

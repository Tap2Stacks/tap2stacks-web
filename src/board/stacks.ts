import type { OrderUpdatePayload } from '../store';
import type { Coin, CoinStack, CoinStatus } from './types';
type Stacks = Record<string, CoinStack>;
export function addPendingCoin(stacks: Stacks, cellId: string, ticker: string, coin: Coin): Stacks {
    const stack = stacks[cellId] ?? { cellId, ticker, coins: [] };
    return { ...stacks, [cellId]: { ...stack, coins: [...stack.coins, { ...coin }] } };
}
function cellIdentity(u: OrderUpdatePayload): string | undefined {
    if (u.cellId)
        return u.cellId;
    const ticker = u.ticker ?? u.cell?.ticker ?? u.marketId;
    const start = u.cellTimeStart ?? u.cell?.startTs ?? u.startTs, end = u.cellTimeEnd ?? u.cell?.endTs ?? u.endTs;
    const lower = u.lowerPrice ?? u.cell?.lowerPrice, upper = u.upperPrice ?? u.cell?.upperPrice;
    return ticker && start !== undefined && end !== undefined && lower !== undefined && upper !== undefined ? `${ticker}:${start}:${end}:${lower}:${upper}` : undefined;
}
function statusFor(u: OrderUpdatePayload): CoinStatus | undefined {
    if (u.status === 'REJECTED')
        return 'rejected';
    if (u.status === 'OPEN')
        return 'open';
    if (u.status === 'VOIDED')
        return 'void';
    if (u.status === 'WIN' || u.settledWin === true || u.settledWin === 'true')
        return 'won';
    if (['SETTLED', 'LOSS', 'LOST', 'MISSED'].includes(u.status ?? ''))
        return 'lost';
}
export function applyOrderUpdate(stacks: Stacks, u: OrderUpdatePayload & {
    orderId?: string;
    clientTapId?: string;
}): Stacks {
    const found = Object.values(stacks).find(s => s.coins.some(c => (u.orderId && c.orderId === u.orderId) || (u.clientTapId && c.clientTapId === u.clientTapId)));
    const cellId = cellIdentity(u) ?? found?.cellId, status = statusFor(u);
    if (!cellId || !status)
        return stacks;
    const stack = stacks[cellId] ?? { cellId, ticker: u.ticker ?? u.cell?.ticker ?? u.marketId ?? cellId.split(':')[0], coins: [] };
    const index = stack.coins.findIndex(c => (u.orderId && c.orderId === u.orderId) || (u.clientTapId && c.clientTapId === u.clientTapId));
    if (index < 0 && !u.orderId && !u.clientTapId)
        return stacks;
    const old = stack.coins[index];
    // An acknowledgement arriving late must never revive a settled coin.
    if (old && status === 'open' && ['won', 'lost', 'void'].includes(old.status))
        return stacks;
    const coin: Coin = { clientTapId: u.clientTapId ?? old?.clientTapId ?? u.orderId!, orderId: u.orderId ?? old?.orderId, amount: Number(u.amount ?? old?.amount ?? 0), rate: Number(u.rewardRate ?? u.cell?.rewardRate ?? old?.rate ?? 0), status, updatedAt: Date.now(), placedAt: old?.placedAt ?? Date.now() };
    const coins = index < 0 ? [...stack.coins, coin] : stack.coins.map((c, i) => i === index ? coin : c);
    return { ...stacks, [cellId]: { ...stack, coins } };
}
export function stackTotals(stack: CoinStack): {
    count: number;
    stake: number;
    openStake: number;
} {
    const visible = stack.coins.filter(c => c.status !== 'rejected');
    return { count: visible.length, stake: visible.reduce((n, c) => n + c.amount, 0), openStake: visible.filter(c => c.status === 'open' || c.status === 'pending').reduce((n, c) => n + c.amount, 0) };
}
export function expirePending(stacks: Stacks, nowMs: number): Stacks {
    let next = stacks;
    for (const [id, stack] of Object.entries(stacks)) {
        if (!stack.coins.some(c => c.status === 'pending' && nowMs - c.placedAt >= 5000))
            continue;
        next = { ...next, [id]: { ...stack, coins: stack.coins.map(c => c.status === 'pending' && nowMs - c.placedAt >= 5000 ? { ...c, status: 'rejected' } : c) } };
    }
    return next;
}
export function stacksFromOpenOrders(orders: OrderUpdatePayload[]): Stacks {
    return orders.filter(u => u.status === 'OPEN').reduce((s, u) => applyOrderUpdate(s, u), {} as Stacks);
}

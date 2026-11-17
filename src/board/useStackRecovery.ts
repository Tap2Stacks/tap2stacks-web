import { useEffect } from 'react';
import { useGameStore, type OrderUpdatePayload } from '../store';
import { customClient } from '../services/custom-client';
/** Rebuild from the authoritative open orders on mount and each socket reconnect. */
export function useStackRecovery(): void {
    const socket = useGameStore(s => s.socket), key = useGameStore(s => s.wssKey);
    useEffect(() => {
        if (!socket || !key)
            return;
        let controller: AbortController | undefined;
        const recover = async () => {
            controller?.abort();
            const request = new AbortController();
            controller = request;
            const stacksAtStart = useGameStore.getState().stacks;
            try {
                const orders: OrderUpdatePayload[] = [];
                for (let offset = 0;; offset += 100) {
                    const page = await customClient<OrderUpdatePayload[]>({ url: '/api/orders/user', method: 'GET', params: { status: 'OPEN', limit: 100, offset }, signal: request.signal });
                    if (!Array.isArray(page))
                        throw new Error('Invalid open orders');
                    orders.push(...page);
                    if (page.length < 100)
                        break;
                }
                if (request.signal.aborted) return;
                if (useGameStore.getState().stacks !== stacksAtStart) { void recover(); return; }
                useGameStore.getState().setOpenBets(orders);
            }
            catch {
                if (!request.signal.aborted)
                    console.warn('Open taps could not be refreshed; retrying on reconnect.');
            }
        };
        socket.on('connect', recover);
        if (socket.connected)
            void recover();
        return () => { controller?.abort(); socket.off('connect', recover); };
    }, [socket, key]);
}

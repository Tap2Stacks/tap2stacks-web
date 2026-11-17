import { useEffect } from "react";
import { useGameStore } from "../store";
import type { CoinStack } from "../board/types";
import { groupWins, type WinEvent } from "../fx/groupWins";
import { useFxStore } from "../fx/fxStore";
type Stacks = Record<string, CoinStack>;
export function newlyWonCoins(previous: Stacks, next: Stacks, nowMs: number): WinEvent[] {
    return Object.values(next).flatMap(stack => stack.coins.filter(coin => {
        if (coin.status !== "won")
            return false;
        const old = previous[stack.cellId]?.coins.find(c => c.clientTapId === coin.clientTapId || (!!coin.orderId && c.orderId === coin.orderId));
        return old?.status !== "won";
    }).map(coin => ({ cellId: stack.cellId, ticker: stack.ticker, amount: coin.amount, rate: coin.rate, atMs: nowMs })));
}
export function watchWins(): () => void {
    let events: WinEvent[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useGameStore.subscribe((next, previous) => {
        if (next.stacks === previous.stacks)
            return;
        events.push(...newlyWonCoins(previous.stacks, next.stacks, Date.now()));
        if (timer || events.length === 0)
            return;
        timer = setTimeout(() => {
            useFxStore.getState().enqueueWins(groupWins(events), Date.now());
            events = [];
            timer = undefined;
        }, 300);
    });
    return () => {
        unsubscribe();
        clearTimeout(timer);
    };
}
export function useWinWatcher(): void {
    useEffect(() => watchWins(), []);
}

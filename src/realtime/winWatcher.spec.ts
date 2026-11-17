import { afterEach, expect, it, vi } from "vitest";
import { watchWins } from "./winWatcher";
import { useGameStore } from "../store";
import { useFxStore } from "../fx/fxStore";
afterEach(() => vi.useRealTimers());
it("two coins in one cell winning on the same sample make one moment with stake 15; other ticker still enqueues", () => {
    vi.useFakeTimers();
    useGameStore.setState({ ticker: "NVDA", stacks: { c: { cellId: "c", ticker: "TSLA", coins: [{ clientTapId: "a", amount: 5, rate: 4.1, status: "open", placedAt: 0 }, { clientTapId: "b", amount: 10, rate: 4.1, status: "open", placedAt: 0 }] } } });
    useFxStore.setState({ queue: [], current: null, flash: null });
    const stop = watchWins();
    useGameStore.setState(s => ({ stacks: { ...s.stacks, c: { ...s.stacks.c, coins: s.stacks.c.coins.map(c => ({ ...c, status: "won" })) } } }));
    vi.advanceTimersByTime(300);
    expect(useFxStore.getState().current).toMatchObject({ cellId: "c", ticker: "TSLA", stake: 15 });
    stop();
});
it('does not replay already won coins on unrelated updates',()=>{
 vi.useFakeTimers();useFxStore.setState({queue:[],current:null,flash:null});useGameStore.setState({stacks:{c:{cellId:'c',ticker:'NVDA',coins:[{clientTapId:'a',amount:5,rate:4,status:'won',placedAt:0}]}}});
 const stop=watchWins();useGameStore.setState(s=>({stacks:{...s.stacks}}));vi.advanceTimersByTime(500);expect(useFxStore.getState().current).toBeNull();stop();
});

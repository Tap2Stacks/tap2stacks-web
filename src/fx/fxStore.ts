import { create } from 'zustand';
import type { WinMoment } from './groupWins';
interface FxState {
  queue: WinMoment[]; current: WinMoment | null; flash: {cellId:string; untilMs:number} | null;
  enqueueWins: (moments: WinMoment[], nowMs: number) => void; advance: (nowMs: number) => void;
}
export const useFxStore = create<FxState>((set) => ({
  queue: [], current: null, flash: null,
  enqueueWins: (moments, nowMs) => set(state => {
    const queue = [...state.queue, ...moments].sort((a,b) => b.payout - a.payout);
    if (state.current || queue.length === 0) return {queue};
    const [current, ...rest] = queue;
    return {current, queue:rest, flash:{cellId:current.cellId, untilMs:nowMs + 600}};
  }),
  advance: (nowMs) => set(state => {
    const [current, ...queue] = state.queue;
    return {current:current ?? null, queue, flash:current ? {cellId:current.cellId, untilMs:nowMs + 600} : null};
  }),
}));

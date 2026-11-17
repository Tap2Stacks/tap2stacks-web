import { create } from 'zustand';
import type { TradeFeedEntry } from './types';
type Tone = 'win' | 'loss' | 'big' | 'you';
interface FeedState { entries:TradeFeedEntry[]; add:(entry:TradeFeedEntry)=>void; seed:(entries:TradeFeedEntry[])=>void }
function merge(entries: TradeFeedEntry[]): TradeFeedEntry[] {
  const seen=new Set<string>();
  return [...entries].sort((a,b)=>b.ts-a.ts).filter(entry => { if(seen.has(entry.id)) return false; seen.add(entry.id); return true; }).slice(0,40);
}
export const useFeedStore = create<FeedState>(set => ({
  entries:[], add:entry => set(state=>({entries:merge([entry,...state.entries])})),
  seed:entries => set(state=>({entries:merge([...state.entries,...entries])})),
}));
export function formatEntry(e:TradeFeedEntry, ownShort:string|null): {who:string;text:string;amount:string;tone:Tone;bot:boolean} {
  const own=ownShort !== null && e.playerShort.toLowerCase() === ownShort.toLowerCase();
  const loss=e.result === 'loss';
  return {who:own?'you':e.playerShort,text:`${e.ticker} x${e.multiplier}`,amount:loss?`-$${Number(e.stake).toString()}`:`+$${Number(e.payout).toFixed(2)}`,tone:e.big && !loss?'big':own?'you':loss?'loss':'win',bot:e.isBot};
}

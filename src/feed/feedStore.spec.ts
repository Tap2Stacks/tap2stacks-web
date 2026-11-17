import { describe, it, expect } from 'vitest';
import { formatEntry, useFeedStore } from './feedStore';
import type { TradeFeedEntry } from './types';
const entry: TradeFeedEntry = {id:'1',ticker:'NVDA',playerShort:'0x3f4a..a1',isBot:false,multiplier:'3.9',stake:'5',payout:'19.5',result:'win',big:false,ts:1};
describe('feed', () => {
 it('formats own, bot, big, wins and losses', () => {
  expect(formatEntry(entry,entry.playerShort).who).toBe('you');
  expect(formatEntry({...entry,isBot:true,big:true},null)).toMatchObject({bot:true,tone:'big',amount:'+$19.50'});
  expect(formatEntry({...entry,result:'loss',payout:'0'},null).amount).toBe('-$5');
 });
 it('keeps 40 newest and deduplicates', () => {
  useFeedStore.setState({entries:[]});
  useFeedStore.getState().seed(Array.from({length:45},(_,i)=>({...entry,id:String(i),ts:i})));
  useFeedStore.getState().add({...entry,id:'44',ts:44});
  expect(useFeedStore.getState().entries).toHaveLength(40);
  expect(useFeedStore.getState().entries[0].id).toBe('44');
 });
});

import { winTier, type Tier } from './tiers';
export interface WinMoment { cellId: string; ticker: string; stake: number; payout: number; rate: number; tier: Tier; atMs: number }
export interface WinEvent { cellId: string; ticker: string; amount: number; rate: number; atMs: number }
export function groupWins(events: WinEvent[], windowMs = 300): WinMoment[] {
  const groups: WinMoment[] = [];
  for (const event of [...events].sort((a,b) => a.atMs - b.atMs)) {
    const group = [...groups].reverse().find(g => g.cellId === event.cellId && g.ticker === event.ticker && event.atMs - g.atMs <= windowMs);
    if (group) {
      group.stake += event.amount;
      group.payout += event.amount * event.rate;
      group.rate = group.payout / group.stake;
      group.tier = winTier(group.stake, group.payout);
    } else {
      const payout = event.amount * event.rate;
      groups.push({cellId:event.cellId,ticker:event.ticker,stake:event.amount,payout,rate:event.rate,tier:winTier(event.amount,payout),atMs:event.atMs});
    }
  }
  return groups;
}

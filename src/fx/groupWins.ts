import { winTier, type Tier } from "./tiers";

export interface WinMoment {
  cellId: string;
  ticker: string;
  stake: number;
  payout: number;
  rate: number;
  tier: Tier;
  atMs: number;
}

export interface WinEvent {
  cellId: string;
  ticker: string;
  amount: number;
  rate: number;
  atMs: number;
}

export function groupWins(events: WinEvent[], windowMs = 300): WinMoment[] {
  let groups: WinMoment[] = [];
  for (const event of [...events].sort((a, b) => a.atMs - b.atMs)) {
    const group = [...groups].reverse().find((candidate) => (
      candidate.cellId === event.cellId &&
      candidate.ticker === event.ticker &&
      event.atMs - candidate.atMs <= windowMs
    ));
    const payout = event.amount * event.rate;
    if (group) {
      const stake = group.stake + event.amount;
      const totalPayout = group.payout + payout;
      const updated = {
        ...group,
        stake,
        payout: totalPayout,
        rate: totalPayout / stake,
        tier: winTier(stake, totalPayout),
      };
      groups = groups.map((candidate) => candidate === group ? updated : candidate);
    } else {
      groups = [...groups, {
        cellId: event.cellId,
        ticker: event.ticker,
        stake: event.amount,
        payout,
        rate: event.rate,
        tier: winTier(event.amount, payout),
        atMs: event.atMs,
      }];
    }
  }
  return groups;
}

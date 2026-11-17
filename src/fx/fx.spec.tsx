import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { countUp } from "./countUp";
import { useFxStore } from "./fxStore";
import { groupWins } from "./groupWins";
import { createParticleSystem } from "./particles";
import { rainCoinCount, rainDurationMs, winTier } from "./tiers";
import { WinBanner } from "./WinBanner";

describe("win moments", () => {
  it("sizes tiers and rain", () => {
    expect([winTier(4.99, 99.99), winTier(5, 20), winTier(25, 30), winTier(10, 100)])
      .toEqual(["small", "medium", "big", "big"]);
    expect([
      rainDurationMs(61.5, false), rainDurationMs(0, false),
      rainDurationMs(1000, false), rainDurationMs(1000, true),
    ]).toEqual([1615, 1200, 4000, 1000]);
    expect(rainCoinCount("big", 100, true)).toBeLessThanOrEqual(15);
  });

  it("groups cell wins within 300ms and splits beyond", () => {
    const events = [0, 300, 601].map((atMs) => ({
      cellId: "a", ticker: "NVDA", amount: 5, rate: 4, atMs,
    }));
    expect(groupWins(events).map((moment) => moment.stake)).toEqual([10, 5]);
  });

  it("queues biggest first, flashes each, and caps particles", () => {
    const wins = [1, 3, 2].map((payout) => ({
      cellId: String(payout), ticker: "NVDA", stake: 1, payout,
      rate: payout, tier: "small" as const, atMs: 0,
    }));
    useFxStore.setState({ queue: [], current: null, flash: null });
    useFxStore.getState().enqueueWins(wins, 100);
    expect(useFxStore.getState().current?.payout).toBe(3);
    expect(useFxStore.getState().flash).toEqual({ cellId: "3", untilMs: 700 });
    useFxStore.getState().advance(800);
    expect(useFxStore.getState().current?.payout).toBe(2);
    const particles = createParticleSystem();
    particles.burst(1, 1, "big");
    particles.rain(4000, 200);
    expect(particles.count()).toBeLessThanOrEqual(150);
  });

  it("shows banner and counts up", () => {
    useFxStore.setState({
      current: {
        cellId: "a", ticker: "TSLA", stake: 15, payout: 61.5,
        rate: 4.1, tier: "medium", atMs: 0,
      },
    });
    render(<WinBanner />);
    expect(screen.getByText("+$61.50")).toBeTruthy();
    expect(screen.getByText("x4.1 on $15")).toBeTruthy();
    cleanup();
    expect(countUp(0, 100, 1000, 0)).toBe(0);
    expect(countUp(0, 100, 1000, 1000)).toBe(100);
    expect(countUp(0, 100, 1000, 500)).toBeGreaterThan(50);
  });
});

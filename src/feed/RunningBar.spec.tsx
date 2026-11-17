import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { RunningBar } from "./RunningBar";
import { useFeedStore } from "./feedStore";

vi.mock("../api/feed", () => ({
  getRecentFeed: vi.fn(async () => [{
    id: "a", ticker: "NVDA", playerShort: "0x1234..ab", isBot: true,
    multiplier: "4.1", stake: "5", payout: "20.5", result: "win", big: false, ts: 1,
  }]),
}));

afterEach(() => {
  cleanup();
  useFeedStore.setState({ entries: [] });
});

it("seeds on mount and shows bot", async () => {
  render(<RunningBar ownAddress={null} />);
  await waitFor(() => expect(screen.getAllByText("bot").length).toBeGreaterThan(0));
});

it("disables marquee animation under reduced motion", () => {
  const css = readFileSync(`${process.cwd()}/src/index.css`, "utf8");
  expect(css).toMatch(/prefers-reduced-motion: reduce[^}]*\{\s*\.running-bar-track\s*\{\s*animation:\s*none/s);
});

it("keeps the result color for your own trades and hides the scrollbar", async () => {
  const { container } = render(<RunningBar ownAddress="0x12340000000000000000000000000000000000ab" />);
  await waitFor(() => expect(screen.getAllByText("you").length).toBeGreaterThan(0));
  const item = screen.getAllByText("you")[0].parentElement as HTMLElement;
  expect(item.style.color).toBe("rgb(47, 107, 52)");
  expect((container.querySelector(".running-bar") as HTMLElement).style.overflow).toBe("hidden");
});

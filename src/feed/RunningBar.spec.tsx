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

it("keeps the win color for your own trades and permits swiping", async () => {
  const { container } = render(<RunningBar ownAddress="0x12340000000000000000000000000000000000ab" />);
  await waitFor(() => expect(screen.getAllByText("you").length).toBeGreaterThan(0));
  const item = screen.getAllByText("you")[0].parentElement as HTMLElement;
  expect((item.querySelector("b:last-child") as HTMLElement).style.color).toBe("rgb(131, 217, 139)");
  expect((container.querySelector(".running-bar") as HTMLElement).style.overflowX).toBe("auto");
});

it("uses an ink tape with paper text and a highlighted big win", async () => {
  useFeedStore.setState({ entries: [{
    id: "big", ticker: "NVDA", playerShort: "0xaaaa..aa", isBot: false,
    multiplier: "4.0", stake: "25", payout: "100", result: "win", big: true, ts: 10,
  }] });
  render(<RunningBar ownAddress={null} />);
  const tape = screen.getByLabelText("Recent trades");
  expect(tape.style.background).toBe("rgb(29, 27, 24)");
  expect(tape.style.color).toBe("rgb(244, 235, 224)");
  expect(tape.style.height).toBe("32px");
  const big = screen.getAllByText("0xaaaa..aa")[0].parentElement as HTMLElement;
  expect(big.style.background).toBe("rgb(255, 216, 77)");
  expect(big.style.color).toBe("rgb(29, 27, 24)");
});

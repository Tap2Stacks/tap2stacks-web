import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HowItWorksModal } from "../HowItWorksModal";
import { HistoryView } from "../HistoryView";
import { WalletView } from "../WalletView";
import { ProofsView } from "../ProofsView";

vi.mock("wagmi", () => ({
  useAccount: () => ({ isConnected: false }),
  useConfig: () => ({ chains: [{ id: 84532 }] }),
  useCapabilities: () => ({ data: undefined }),
  useReadContracts: () => ({ data: undefined, refetch: vi.fn() }),
  useSendCalls: () => ({ sendCallsAsync: vi.fn() }),
  useSendTransaction: () => ({ sendTransactionAsync: vi.fn() }),
  useSwitchChain: () => ({ switchChainAsync: vi.fn(), isPending: false }),
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));
vi.mock("../services/queries", () => ({
  useAccountControllerGetBalance: () => ({ refetch: vi.fn() }),
  paymentControllerRequestWithdrawal: vi.fn(),
}));

afterEach(cleanup);
const source = (name: string) => readFileSync(`${process.cwd()}/src/${name}.tsx`, "utf8");

describe("warm paper views", () => {
  it("renders the views with paper and ink, without the old dark palette", () => {
    for (const View of [HistoryView, WalletView, ProofsView]) {
      const { container, unmount } = render(<View />);
      expect(container.innerHTML).toMatch(/(?:bg-paper|background)/);
      expect(container.innerHTML).toMatch(/text-ink/);
      expect(container.innerHTML).not.toMatch(/slate-9|#[0][0-9a-f]{5}/i);
      unmount();
    }
    for (const name of ["HistoryView", "WalletView", "ProofsView", "HowItWorksModal"]) {
      expect(source(name)).not.toMatch(/slate-|#[0-9a-f]{3,8}|rgba\(/i);
    }
  });
  it("uses the exact win rule", () => {
    expect(source("HowItWorksModal")).toContain(
      "If the price line passes through your cell during its 5 seconds, you win.",
    );
  });
  it("explains stacked coins, the cell limit, bigger win rain and the testnet terms", () => {
    const modal = source("HowItWorksModal");
    expect(modal).toMatch(/coins stack/i);
    expect(modal).toContain("$100 per cell");
    expect(modal).toMatch(/bigger wins rain coins/i);
    expect(modal).toContain("Testnet game. Test USDC has no value. Not for US persons. 18+.");
  });
});


it("walks through the rule and preserves dismissal", async () => {
  localStorage.removeItem("hasSeenTradingOnboarding");
  render(<HowItWorksModal />);
  expect(await screen.findByText("Welcome to tap2stacks")).toBeTruthy();
  expect(screen.getByText("Testnet game. Test USDC has no value. Not for US persons. 18+.")).toBeTruthy();
  for (const title of ["1. Connect & Login", "2. Deposit Tokens", "3. Drop Your Coins", "4. Win & Withdraw!"]) {
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText(title);
  }
  expect(screen.getByText(/Bigger wins rain coins/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Start Playing" }));
  await waitFor(() => expect(localStorage.getItem("hasSeenTradingOnboarding")).toBe("true"));
});

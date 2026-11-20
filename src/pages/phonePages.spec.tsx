import { cleanup, render, screen } from "@testing-library/react";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComplianceGate } from "../compliance/ComplianceGate";
import { HistoryView } from "../HistoryView";
import { HowItWorksModal } from "../HowItWorksModal";
import { ProofsView } from "../ProofsView";
import { WalletView } from "../WalletView";
import { HistoryProofDialog } from "./HistoryProofDialog";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(async () => ({ data: [] })),
    create: () => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    }),
    isAxiosError: () => false,
  },
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: "0x1111111111111111111111111111111111111111",
    isConnected: true,
    chain: { id: 84532, name: "Base Sepolia" },
  }),
  useConfig: () => ({ chains: [{ id: 84532 }] }),
  useCapabilities: () => ({ data: undefined }),
  useReadContracts: () => ({ data: undefined, refetch: vi.fn() }),
  useSendCalls: () => ({ sendCallsAsync: vi.fn() }),
  useSendTransaction: () => ({ sendTransactionAsync: vi.fn() }),
  useSwitchChain: () => ({ switchChainAsync: vi.fn(), isPending: false }),
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));

vi.mock("../services/queries", () => ({
  useAccountControllerGetBalance: () => ({
    data: { free: "100" },
    refetch: vi.fn(),
  }),
  paymentControllerRequestWithdrawal: vi.fn(),
}));

function setWidth(w: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: w,
  });
}

describe("other pages and dialogs at phone width (390 px)", () => {
  beforeEach(() => {
    setWidth(390);
    vi.stubEnv("VITE_TUSDC_ADDRESS", "0x1111111111111111111111111111111111111111");
    vi.stubEnv("VITE_VAULT_ADDRESS", "0x2222222222222222222222222222222222222222");
    vi.stubEnv("VITE_PROOF_ANCHOR_ADDRESS", "0x3333333333333333333333333333333333333333");
    vi.mocked(axios.get).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it("HistoryView renders heading, Refresh button, and overflow-x-auto list wrapper", async () => {
    localStorage.setItem("token", "test-jwt");
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [
        {
          orderId: "ord-phone-1",
          marketId: "NVDA",
          amount: "5",
          rewardRate: "2.1",
          settledAt: "2026-11-17T12:00:00.000Z",
          settledWin: true,
          status: "SETTLED",
        },
      ],
    });
    const { container } = render(<HistoryView />);
    expect(screen.getByRole("heading", { name: "Execution Journal" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
    expect(await screen.findByText(/ord-phone-1/i)).toBeTruthy();
    expect(container.querySelector('img[data-symbol="NVDA"]')).toBeTruthy();
    expect(container.innerHTML).toContain("overflow-x-auto");
  });

  it("WalletView renders heading and primary Deposit button", () => {
    const { container } = render(<WalletView />);
    expect(screen.getByRole("heading", { name: "Wallet" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Deposit tUSDC/i })).toBeTruthy();
    expect(container.querySelector('img[data-symbol="Base"]')).toBeTruthy();
    expect(container.querySelector('img[data-symbol="tUSDC"]')).toBeTruthy();
  });

  it("ProofsView renders heading, Refresh button, and overflow-x-auto wrapper", async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: [
        {
          index: 4,
          fromMs: 1_700_000_000_000,
          toMs: 1_700_000_060_000,
          tapsRoot: "0x1234",
          priceLogHash: "0x5678",
          txHash: "0xdead",
        },
      ],
    });
    const { container } = render(<ProofsView />);
    expect(screen.getByRole("heading", { name: "Proofs" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
    expect(await screen.findByText(/Batch #4/i)).toBeTruthy();
    expect(container.innerHTML).toContain("overflow-x-auto");
  });

  it("dialogs constrain width with max-w-[calc(100vw-24px)]", async () => {
    localStorage.removeItem("hasSeenTradingOnboarding");
    const { container: modalContainer, unmount: unmountModal } = render(
      <HowItWorksModal />,
    );
    await screen.findByText("Welcome to tap2stacks");
    expect(modalContainer.innerHTML).toContain("max-w-[calc(100vw-24px)]");
    unmountModal();

    const { unmount: unmountGate } = render(<ComplianceGate />);
    const gateDialog = screen.getByRole("dialog");
    expect(gateDialog.className).toContain("max-w-[calc(100vw-24px)]");
    unmountGate();

    render(
      <HistoryProofDialog
        state={{
          isProofOpen: true,
          closeProof: vi.fn(),
          selectedOrderId: "ord-1",
          proofLoading: false,
          proofError: "Proof will be anchored within about 5 minutes",
          proofData: null,
        } as never}
      />,
    );
    const proofPanel = screen.getByText("Base Settlement Proof").closest("[class*='max-w-']");
    expect(proofPanel?.className).toContain("max-w-[calc(100vw-24px)]");
  });
});

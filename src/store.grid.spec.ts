import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { isCellTappable, useGameStore, type RemoteCell } from "./store";

const mockEmit = vi.fn();
const mockSocketOn = vi.fn();
const mockSocketDisconnect = vi.fn();

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    on: mockSocketOn,
    emit: mockEmit,
    disconnect: mockSocketDisconnect,
  })),
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
  useConnect: () => ({ connect: vi.fn(), connectors: [] }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useSignMessage: () => ({ signMessageAsync: vi.fn() }),
  useSwitchChain: () => ({
    switchChain: vi.fn(),
    switchChainAsync: vi.fn(),
    isPending: false,
  }),
  useWriteContract: () => ({
    writeContractAsync: vi.fn(),
  }),
}));

vi.mock("./services/queries", () => ({
  authControllerGetChallenge: vi.fn(async () => ({ challenge: "c" })),
  authControllerGetWssKey: vi.fn(async () => ({ key: "00112233" })),
  authControllerLogin: vi.fn(async () => ({ accessToken: "tok" })),
  getAccountControllerGetBalanceQueryKey: () => ["balance"],
  useAccountControllerGetBalance: () => ({
    data: { free: "100" },
    refetch: vi.fn(),
  }),
  useOrderControllerGetUserOrders: () => ({ data: [] }),
  paymentControllerDebugDeposit: vi.fn(),
  paymentControllerDebugFinalizeWithdrawal: vi.fn(),
  paymentControllerGetActiveWithdrawalSession: vi.fn(),
  paymentControllerRequestWithdrawal: vi.fn(),
}));

import { WalletView } from "./WalletView";
import { Header } from "./shell/Header";

function makeCell(overrides: Partial<RemoteCell> = {}): RemoteCell {
  const now = Date.now();
  return {
    ticker: "NVDA",
    gridTs: now,
    startTs: now + 10_000,
    endTs: now + 15_000,
    lowerPrice: "157.50",
    upperPrice: "157.53",
    rewardRate: "2.4000",
    gridSignature: "sig",
    ...overrides,
  };
}

describe("stock grid store behaviors", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    useGameStore.setState({
      ticker: "NVDA",
      feedStale: { NVDA: false, TSLA: false },
      cells: [],
      bets: {},
      betRates: {},
      pendingBets: {},
      pendingWins: {},
      balance: 100,
      serverBalance: 100,
      betAmount: 5,
      modePriceStep: 0.03,
      priceStepByTicker: { NVDA: 0.03, TSLA: 0.05 },
      priceByTicker: {},
      historyByTicker: {},
      basePriceByTicker: {},
      currentPrice: 0,
      history: [],
      serverTimeOffset: 0,
      lastRejectMessage: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("grid_update for TSLA does not replace NVDA cells", () => {
    const serverNow = Date.now();
    const nvdaCell = makeCell({
      ticker: "NVDA",
      gridTs: serverNow,
      startTs: serverNow + 10_000,
      endTs: serverNow + 15_000,
      lowerPrice: "157.50",
      upperPrice: "157.53",
    });
    const tslaCell = makeCell({
      ticker: "TSLA",
      gridTs: serverNow,
      startTs: serverNow + 10_000,
      endTs: serverNow + 15_000,
      lowerPrice: "250.00",
      upperPrice: "250.05",
    });

    useGameStore.getState().updateGrid({
      ticker: "NVDA",
      gridTs: serverNow,
      priceStep: "0.03",
      cells: [nvdaCell],
    });
    useGameStore.getState().updateGrid({
      ticker: "TSLA",
      gridTs: serverNow,
      priceStep: "0.05",
      cells: [tslaCell],
    });

    const state = useGameStore.getState();
    const nvdaCells = state.cells.filter((c) => c.original.ticker === "NVDA");
    const tslaCells = state.cells.filter((c) => c.original.ticker === "TSLA");

    expect(nvdaCells).toHaveLength(1);
    expect(tslaCells).toHaveLength(1);
    expect(state.priceStepByTicker.NVDA).toBe(0.03);
    expect(state.priceStepByTicker.TSLA).toBe(0.05);
  });

  it("serverTimeOffset comes from gridTs, so a phone 7 s fast still marks the right column tappable", () => {
    const serverNow = 1_700_000_000_000;
    // Phone clock is 7 seconds fast compared to serverNow
    vi.setSystemTime(serverNow + 7_000);

    // Column starts 6 s after serverNow (tappable on server since > 5 s away,
    // even though phone clock thinks it already started 1 s ago).
    const tappableCell = makeCell({
      ticker: "NVDA",
      gridTs: serverNow,
      startTs: serverNow + 6_000,
      endTs: serverNow + 11_000,
    });
    // Column starts 4 s after serverNow (closing soon <= 5 s, not tappable).
    const closingCell = makeCell({
      ticker: "NVDA",
      gridTs: serverNow,
      startTs: serverNow + 4_000,
      endTs: serverNow + 9_000,
      lowerPrice: "157.53",
      upperPrice: "157.56",
    });

    useGameStore.getState().updateGrid({
      ticker: "NVDA",
      gridTs: serverNow,
      priceStep: "0.03",
      cells: [tappableCell, closingCell],
    });

    const state = useGameStore.getState();
    expect(state.serverTimeOffset).toBe(-7_000);

    const syncedNow = Date.now() + state.serverTimeOffset;
    const storedTappable = state.cells.find(
      (c) => c.timeWindowStart === tappableCell.startTs,
    )!;
    const storedClosing = state.cells.find(
      (c) => c.timeWindowStart === closingCell.startTs,
    )!;

    expect(storedTappable.status).toBe("active");
    expect(isCellTappable(storedTappable, syncedNow)).toBe(true);
    expect(isCellTappable(storedClosing, syncedNow)).toBe(false);
  });

  it("REJECTED order removes the pending cell and returns the reject message", () => {
    const serverNow = Date.now();
    const cell = makeCell({
      ticker: "NVDA",
      gridTs: serverNow,
      startTs: serverNow + 10_000,
      endTs: serverNow + 15_000,
    });

    useGameStore.getState().updateGrid({
      ticker: "NVDA",
      gridTs: serverNow,
      priceStep: "0.03",
      cells: [cell],
    });

    const cellId = `NVDA:${cell.startTs}:${cell.endTs}:${cell.lowerPrice}:${cell.upperPrice}`;
    useGameStore.getState().placeBet(cellId, 5);
    expect(useGameStore.getState().pendingBets[cellId]).toBe(5);
    expect(useGameStore.getState().balance).toBe(95);

    const message = useGameStore.getState().updateOrder({
      ticker: "NVDA",
      startTs: cell.startTs,
      endTs: cell.endTs,
      lowerPrice: cell.lowerPrice,
      upperPrice: cell.upperPrice,
      status: "REJECTED",
      reason: "WINDOW_CLOSING",
    });

    expect(message).toBe("Too close to start. Tap a later column.");
    expect(useGameStore.getState().pendingBets[cellId]).toBeUndefined();
    expect(useGameStore.getState().balance).toBe(100);
    expect(useGameStore.getState().lastRejectMessage).toBe(
      "Too close to start. Tap a later column.",
    );
  });

  it("VOIDED order shows Refunded and restores balance from balance_update", () => {
    const serverNow = Date.now();
    const cell = makeCell({
      ticker: "NVDA",
      gridTs: serverNow,
      startTs: serverNow + 10_000,
      endTs: serverNow + 15_000,
    });

    useGameStore.getState().updateGrid({
      ticker: "NVDA",
      gridTs: serverNow,
      priceStep: "0.03",
      cells: [cell],
    });

    const cellId = `NVDA:${cell.startTs}:${cell.endTs}:${cell.lowerPrice}:${cell.upperPrice}`;
    useGameStore.getState().placeBet(cellId, 5);
    useGameStore.getState().updateOrder({
      ticker: "NVDA",
      startTs: cell.startTs,
      endTs: cell.endTs,
      lowerPrice: cell.lowerPrice,
      upperPrice: cell.upperPrice,
      amount: "5",
      status: "OPEN",
    });
    expect(useGameStore.getState().balance).toBe(95);

    useGameStore.getState().updateOrder({
      ticker: "NVDA",
      startTs: cell.startTs,
      endTs: cell.endTs,
      lowerPrice: cell.lowerPrice,
      upperPrice: cell.upperPrice,
      amount: "5",
      status: "VOIDED",
    });

    const voidedCell = useGameStore
      .getState()
      .cells.find((c) => c.id === cellId);
    expect(voidedCell?.status).toBe("voided");

    // Simulate balance_update arriving from backend
    useGameStore.getState().updateBalance(100);
    expect(useGameStore.getState().balance).toBe(100);
  });

  it("feed_health stale disables taps for that ticker only", () => {
    const serverNow = Date.now();
    const nvdaCell = makeCell({
      ticker: "NVDA",
      gridTs: serverNow,
      startTs: serverNow + 10_000,
      endTs: serverNow + 15_000,
    });
    const tslaCell = makeCell({
      ticker: "TSLA",
      gridTs: serverNow,
      startTs: serverNow + 10_000,
      endTs: serverNow + 15_000,
      lowerPrice: "250.00",
      upperPrice: "250.05",
    });

    useGameStore.getState().updateGrid({
      ticker: "NVDA",
      gridTs: serverNow,
      priceStep: "0.03",
      cells: [nvdaCell],
    });
    useGameStore.getState().updateGrid({
      ticker: "TSLA",
      gridTs: serverNow,
      priceStep: "0.05",
      cells: [tslaCell],
    });

    useGameStore.getState().setFeedStale("NVDA", true);

    const state = useGameStore.getState();
    const syncedNow = Date.now() + state.serverTimeOffset;
    const storedNvda = state.cells.find((c) => c.original.ticker === "NVDA")!;
    const storedTsla = state.cells.find((c) => c.original.ticker === "TSLA")!;

    expect(state.feedStale.NVDA).toBe(true);
    expect(state.feedStale.TSLA).toBe(false);
    expect(
      isCellTappable(storedNvda, syncedNow, { feedStale: state.feedStale.NVDA }),
    ).toBe(false);
    expect(
      isCellTappable(storedTsla, syncedNow, { feedStale: state.feedStale.TSLA }),
    ).toBe(true);
  });
});

describe("stock grid UI components", () => {
  beforeEach(() => {
    mockEmit.mockReset();
    mockSocketOn.mockReset();
    localStorage.clear();
    useGameStore.setState({
      ticker: "NVDA",
      feedStale: { NVDA: false, TSLA: false },
      cells: [],
      bets: {},
      betRates: {},
      pendingBets: {},
      pendingWins: {},
      balance: 100,
      serverBalance: 100,
      betAmount: 5,
      modePriceStep: 0.03,
      priceStepByTicker: { NVDA: 0.03, TSLA: 0.05 },
      priceByTicker: { NVDA: 157.51, TSLA: 250.02 },
      historyByTicker: {},
      basePriceByTicker: { NVDA: 157.5, TSLA: 250.0 },
      currentPrice: 157.51,
      basePrice: 157.5,
      history: [],
      serverTimeOffset: 0,
      socket: null,
      wssKey: null,
      lastRejectMessage: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("WalletView does not crash when VITE_* contract addresses are missing and shows On-chain wallet not set up yet", () => {
    vi.stubEnv("VITE_TUSDC_ADDRESS", "");
    vi.stubEnv("VITE_VAULT_ADDRESS", "");
    vi.stubEnv("VITE_PROOF_ANCHOR_ADDRESS", "");

    render(createElement(WalletView));
    expect(screen.getByText("On-chain wallet not set up yet")).toBeTruthy();
  });

  it("Header faucet button posts { amount: 100 } without txHash to /api/payment/debug/deposit", () => {
    localStorage.setItem("token", "test-jwt");
    localStorage.setItem(
      "wallet-address",
      "0x1111111111111111111111111111111111111111",
    );
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const qc = new QueryClient();
    render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, null, createElement(Header)),
      ),
    );

    const btn = screen.getByRole("button", {
      name: "Get 100 test credits (dev)",
    });
    fireEvent.click(btn);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/payment\/debug\/deposit$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ amount: 100 }),
      }),
    );
  });
});

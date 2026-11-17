import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react";
import CryptoJS from "crypto-js";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onPrice, onTradeFeed } from "./bus";
import { useRealtime } from "./useRealtime";
import { useGameStore } from "../store";
import type { TradeFeedEntry } from "../feed/types";

type Handler = (...args: unknown[]) => void;

const handlers = new Map<string, Handler>();
const mockEmit = vi.fn();
const mockDisconnect = vi.fn();
const mockOn = vi.fn((event: string, cb: Handler) => {
  handlers.set(event, cb);
});

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    on: mockOn,
    emit: mockEmit,
    disconnect: mockDisconnect,
  })),
}));

let mockAddress: string | undefined =
  "0x1111111111111111111111111111111111111111";

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: mockAddress,
    isConnected: Boolean(mockAddress),
  }),
}));

const mockGetWssKey = vi.fn(async () => ({ key: "0011223344556677" }));
const mockGetChallenge = vi.fn<(params: unknown) => Promise<{ challenge: string }>>(
  async () => ({
    challenge: "challenge-123",
  }),
);

vi.mock("../services/queries", () => ({
  authControllerGetWssKey: () => mockGetWssKey(),
  authControllerGetChallenge: (params: unknown) => mockGetChallenge(params),
  getAccountControllerGetBalanceQueryKey: () => ["balance"],
}));

function Harness() {
  useRealtime();
  return null;
}

function renderWithQuery(ui: ReactNode, queryClient = new QueryClient()) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
    ),
  };
}

describe("useRealtime", () => {
  beforeEach(() => {
    handlers.clear();
    mockEmit.mockClear();
    mockDisconnect.mockClear();
    mockOn.mockClear();
    mockGetWssKey.mockClear();
    mockGetChallenge.mockClear();
    localStorage.clear();
    mockAddress = "0x1111111111111111111111111111111111111111";
    useGameStore.setState({
      ticker: "NVDA",
      currentPrice: 0,
      balance: 0,
      serverBalance: 0,
      cells: [],
      feedStale: { NVDA: false, TSLA: false },
      socket: null,
      wssKey: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("useRealtime subscribes to the five events and trade_feed", () => {
    renderWithQuery(<Harness />);

    expect(handlers.has("connect")).toBe(true);
    expect(handlers.has("price_now")).toBe(true);
    expect(handlers.has("grid_update")).toBe(true);
    expect(handlers.has("feed_health")).toBe(true);
    expect(handlers.has("balance_update")).toBe(true);
    expect(handlers.has("order_update")).toBe(true);
    expect(handlers.has("trade_feed")).toBe(true);
  });

  it("price_now updates the store and notifies onPrice listeners", () => {
    const listener = vi.fn();
    const unsub = onPrice(listener);

    renderWithQuery(<Harness />);

    act(() => {
      handlers.get("price_now")?.({
        ticker: "NVDA",
        ts: 1700000000000,
        price: 154.68,
      });
    });

    expect(useGameStore.getState().currentPrice).toBe(154.68);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("NVDA", 1700000000000, 154.68);

    unsub();
    act(() => {
      handlers.get("price_now")?.({
        ticker: "NVDA",
        ts: 1700000001000,
        price: 154.72,
      });
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("trade_feed notifies onTradeFeed listeners", () => {
    const listener = vi.fn();
    const unsub = onTradeFeed(listener);

    renderWithQuery(<Harness />);

    const entry: TradeFeedEntry = {
      id: "0x3f4a..a1:NVDA:1:2:100:103:1000",
      ticker: "NVDA",
      playerShort: "0x3f4a..a1",
      isBot: false,
      multiplier: "4.1",
      stake: "15",
      payout: "61.5",
      result: "win",
      big: false,
      ts: 1000,
    };

    act(() => {
      handlers.get("trade_feed")?.(entry);
    });

    expect(listener).toHaveBeenCalledWith(entry);
    unsub();
  });

  it("connects, fetches wssKey and emits subscribe_user when token and address are present", async () => {
    localStorage.setItem("token", "jwt-abc");
    renderWithQuery(<Harness />);

    await act(async () => {
      await handlers.get("connect")?.();
    });

    expect(mockGetWssKey).toHaveBeenCalledTimes(1);
    expect(mockGetChallenge).toHaveBeenCalledWith({
      address: "0x1111111111111111111111111111111111111111",
    });

    const hmac = CryptoJS.algo.HMAC.create(
      CryptoJS.algo.SHA256,
      CryptoJS.enc.Hex.parse("0011223344556677"),
    );
    hmac.update("0x1111111111111111111111111111111111111111");
    hmac.update("challenge-123");
    const expectedSig = hmac.finalize().toString(CryptoJS.enc.Hex);

    expect(mockEmit).toHaveBeenCalledWith("subscribe_user", {
      userId: "0x1111111111111111111111111111111111111111",
      signature: expectedSig,
    });
    expect(useGameStore.getState().wssKey).toBe("0011223344556677");
  });

  it("routes feed_health, balance_update, grid_update, and order_update to store and disconnects on unmount", () => {
    const queryClient = new QueryClient();
    const { unmount } = renderWithQuery(<Harness />, queryClient);

    act(() => {
      handlers.get("feed_health")?.({ ticker: "NVDA", stale: true, prevDayPx: 154.03 });
      handlers.get("balance_update")?.({ free: "42.5" });
      handlers.get("grid_update")?.({
        ticker: "NVDA",
        gridTs: 10000,
        priceStep: 0.03,
        cells: [
          {
            ticker: "NVDA",
            gridTs: 10000,
            startTs: 20000,
            endTs: 25000,
            lowerPrice: "154.60",
            upperPrice: "154.63",
            rewardRate: "3.2",
            gridSignature: "sig",
          },
        ],
      });
    });

    expect(useGameStore.getState().feedStale.NVDA).toBe(true);
    expect(useGameStore.getState().prevDayPx.NVDA).toBe(154.03);
    expect(useGameStore.getState().balance).toBe(42.5);
    expect(queryClient.getQueryData(["balance"])).toEqual({ free: "42.5" });
    expect(useGameStore.getState().cells).toHaveLength(1);

    unmount();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});

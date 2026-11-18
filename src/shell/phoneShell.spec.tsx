import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "../store";

const mockRealtimeMount = vi.fn();

vi.mock("../realtime/useRealtime", () => ({
  useRealtime: () => {
    useEffect(() => {
      mockRealtimeMount();
    }, []);
  },
}));

vi.mock("../realtime/winWatcher", () => ({
  useWinWatcher: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: "0x1111111111111111111111111111111111111111",
    isConnected: false,
    chain: undefined,
  }),
  useConnect: () => ({ connect: vi.fn(), connectors: [{ id: "mock" }] }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useSignMessage: () => ({ signMessageAsync: vi.fn() }),
  useSwitchChain: () => ({ switchChain: vi.fn(), isPending: false }),
}));

vi.mock("../services/queries", () => ({
  authControllerGetChallenge: vi.fn(async () => ({ challenge: "c" })),
  authControllerLogin: vi.fn(async () => ({ accessToken: "tok" })),
  getAccountControllerGetBalanceQueryKey: () => ["balance"],
  useAccountControllerGetBalance: () => ({
    data: undefined,
    refetch: vi.fn(),
  }),
}));

vi.mock("../fx/FxCanvas", () => ({
  FxCanvas: () => null,
}));

vi.mock("../fx/WinBanner", () => ({
  WinBanner: () => null,
}));

import { Layout } from "./Layout";

function setWidth(w: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: w,
  });
}

function renderLayout(initialPath = "/trade") {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            element={
              <Layout
                runningBar={<div>Tape</div>}
                bellSlot={<span>Bell</span>}
              />
            }
          >
            <Route path="/trade" element={<div>Trade body</div>} />
            <Route path="/history" element={<div>History body</div>} />
            <Route path="/wallet" element={<div>Wallet body</div>} />
            <Route path="/proofs" element={<div>Proofs body</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("phone shell", () => {
  beforeEach(() => {
    localStorage.clear();
    mockRealtimeMount.mockReset();
    useGameStore.setState({ balance: 0, serverBalance: 0 });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("at innerWidth = 390 renders BottomNav with 4 links, active aria-current='page', safe-area padding, and no desktop warning", () => {
    setWidth(390);
    const { container } = renderLayout("/history");

    expect(screen.queryByText(/Best on a bigger screen/i)).toBeNull();
    const mobileNav = screen.getByRole("navigation", {
      name: "Mobile navigation",
    });
    expect(mobileNav).toBeTruthy();
    expect(mobileNav.style.paddingBottom).toContain(
      "env(safe-area-inset-bottom)",
    );

    const links = Array.from(mobileNav.querySelectorAll("a"));
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/trade",
      "/history",
      "/wallet",
      "/proofs",
    ]);
    expect(
      screen.getByRole("link", { name: "History" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: "Trade" }).getAttribute("aria-current"),
    ).toBeNull();
    expect((container.firstChild as HTMLElement).className).toContain(
      "h-[100dvh]",
    );
  });

  it("at innerWidth = 1440 renders desktop Header and no BottomNav", () => {
    setWidth(1440);
    renderLayout("/trade");

    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("navigation", { name: "Mobile navigation" }),
    ).toBeNull();
  });

  it("resizing 1440 -> 390 -> 1440 mounts useRealtime only once", () => {
    setWidth(1440);
    renderLayout("/trade");
    expect(mockRealtimeMount).toHaveBeenCalledTimes(1);

    act(() => {
      setWidth(390);
      window.dispatchEvent(new Event("resize"));
    });
    expect(
      screen.getByRole("navigation", { name: "Mobile navigation" }),
    ).toBeTruthy();
    expect(mockRealtimeMount).toHaveBeenCalledTimes(1);

    act(() => {
      setWidth(1440);
      window.dispatchEvent(new Event("resize"));
    });
    expect(
      screen.getByRole("navigation", { name: "Primary" }),
    ).toBeTruthy();
    expect(mockRealtimeMount).toHaveBeenCalledTimes(1);
  });
});

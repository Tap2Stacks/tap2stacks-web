import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

let mockAccountState: {
  address?: string;
  isConnected: boolean;
  chain?: { id: number; name: string };
} = {
  address: "0x1111111111111111111111111111111111111111",
  isConnected: false,
  chain: undefined,
};

vi.mock("wagmi", () => ({
  useAccount: () => mockAccountState,
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
import { PhoneHeader } from "./PhoneHeader";
import { BellPill } from "../pages/BellPill";

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
    mockAccountState = {
      address: "0x1111111111111111111111111111111111111111",
      isConnected: false,
      chain: undefined,
    };
    useGameStore.setState({ balance: 0, serverBalance: 0 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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
    expect((container.firstChild as HTMLElement).style.paddingTop).toContain(
      "env(safe-area-inset-top)",
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

  it("BellPill compact renders 'Bell 2h 14m' before session and 'Bell live' when live", () => {
    vi.useFakeTimers();
    // 2026-11-17T14:30:00Z is 09:30 ET; 2h 14m before is 12:16:00Z
    vi.setSystemTime(new Date("2026-11-17T12:16:00.000Z"));
    const { rerender } = render(<BellPill compact />);
    expect(screen.getByText("Bell 2h 14m")).toBeTruthy();

    rerender(<BellPill />);
    expect(screen.getByText("Bell 09:30 ET in 2h 14m")).toBeTruthy();

    vi.setSystemTime(new Date("2026-11-17T14:40:00.000Z"));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    rerender(<BellPill compact />);
    expect(screen.getByText("Bell live")).toBeTruthy();

    rerender(<BellPill />);
    expect(screen.getByText("Opening Bell live")).toBeTruthy();
  });

  it("PhoneHeader renders compact BellPill and a Connect button", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T12:16:00.000Z"));
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <PhoneHeader />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText("Bell 2h 14m")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect" })).toBeTruthy();
  });

  it("PhoneHeader account menu shows DEV 'Add 100 test credits' and posts debug deposit", async () => {
    mockAccountState = {
      address: "0x1111111111111111111111111111111111111111",
      isConnected: true,
      chain: { id: 84532, name: "Base Sepolia" },
    };
    localStorage.setItem("token", "test-jwt");
    localStorage.setItem(
      "wallet-address",
      "0x1111111111111111111111111111111111111111",
    );
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <PhoneHeader />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /0x11\.\.11/ }));
    const topUpBtn = screen.getByRole("button", { name: "Add 100 test credits" });
    fireEvent.click(topUpBtn);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/payment\/debug\/deposit$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ amount: 100 }),
      }),
    );
  });
});

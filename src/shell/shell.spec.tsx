import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGameStore } from "../store";
import { THEME } from "../ui/theme";
import { Header } from "./Header";
import { Layout } from "./Layout";

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockSignMessageAsync = vi.fn(async () => "0xsig");
const mockSwitchChain = vi.fn();

let mockAccountState: {
  address?: string;
  isConnected: boolean;
  chain?: { id: number; name: string };
} = {
  address: undefined,
  isConnected: false,
  chain: undefined,
};

vi.mock("wagmi", () => ({
  useAccount: () => mockAccountState,
  useConnect: () => ({ connect: mockConnect, connectors: [{ id: "mock" }] }),
  useDisconnect: () => ({ disconnect: mockDisconnect }),
  useSignMessage: () => ({ signMessageAsync: mockSignMessageAsync }),
  useSwitchChain: () => ({
    switchChain: mockSwitchChain,
    isPending: false,
  }),
}));

vi.mock("../services/queries", () => ({
  authControllerGetChallenge: vi.fn(async () => ({ challenge: "c" })),
  authControllerGetWssKey: vi.fn(async () => ({ key: "00112233" })),
  authControllerLogin: vi.fn(async () => ({ accessToken: "tok" })),
  getAccountControllerGetBalanceQueryKey: () => ["balance"],
  useAccountControllerGetBalance: () => ({
    data: undefined,
    refetch: vi.fn(),
  }),
}));

function renderShell(ui: ReactNode, initialPath = "/trade") {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("shell (Header, Layout, THEME)", () => {
  beforeEach(() => {
    localStorage.clear();
    mockAccountState = {
      address: undefined,
      isConnected: false,
      chain: undefined,
    };
    useGameStore.setState({ balance: 0, serverBalance: 0 });
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1280,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("THEME exposes the paper visual system tokens", () => {
    expect(THEME.paper).toBe("#F4EBE0");
    expect(THEME.ink).toBe("#1D1B18");
    expect(THEME.lavender).toBe("#E4DCF7");
    expect(THEME.yellow).toBe("#F5E4AE");
    expect(THEME.pink).toBe("#F7CFC8");
    expect(THEME.highlight).toBe("#FFD84D");
    expect(THEME.coinLight).toBe("#FFE58A");
    expect(THEME.coinDark).toBe("#E2B23C");
    expect(THEME.win).toBe("#2F6B34");
    expect(THEME.loss).toBe("#9A3B2E");
    expect(THEME.font).toContain("JetBrains Mono");
  });

  it("Header shows the wordmark tap2stacks", () => {
    renderShell(<Header />);
    expect(screen.getByText("tap2stacks")).toBeTruthy();
  });

  it("Header renders Trade, History, Wallet, Proofs tabs inline and the balance pill as $0.00 before sign-in", () => {
    renderShell(<Header />);

    expect(screen.getByRole("link", { name: "Trade" }).getAttribute("href")).toBe(
      "/trade",
    );
    expect(
      screen.getByRole("link", { name: "History" }).getAttribute("href"),
    ).toBe("/history");
    expect(
      screen.getByRole("link", { name: "Wallet" }).getAttribute("href"),
    ).toBe("/wallet");
    expect(
      screen.getByRole("link", { name: "Proofs" }).getAttribute("href"),
    ).toBe("/proofs");
    expect(screen.getByText("$0.00")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Connect wallet" }),
    ).toBeTruthy();
  });

  it("Header renders bellSlot when provided", () => {
    renderShell(<Header bellSlot={<span>Opening Bell live</span>} />);
    expect(screen.getByText("Opening Bell live")).toBeTruthy();
  });

  it("Header shows Switch network when on wrong chain", () => {
    mockAccountState = {
      address: "0x1111111111111111111111111111111111111111",
      isConnected: true,
      chain: { id: 1, name: "Mainnet" },
    };

    renderShell(<Header />);
    const btn = screen.getByRole("button", { name: "Switch network" });
    fireEvent.click(btn);
    expect(mockSwitchChain).toHaveBeenCalledWith({ chainId: 84532 });
  });

  it("Layout shows the small-screen note below 1024 px", () => {
    renderShell(
      <Routes>
        <Route element={<Layout runningBar={<div>Tape</div>} />}>
          <Route path="/trade" element={<div>Trade body</div>} />
        </Route>
      </Routes>,
    );

    expect(screen.getByText("Tape")).toBeTruthy();
    expect(screen.getByText("Trade body")).toBeTruthy();
    expect(screen.queryByText("Best on a bigger screen for now")).toBeNull();

    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 900,
      });
      window.dispatchEvent(new Event("resize"));
    });

    expect(screen.getByText("Best on a bigger screen for now")).toBeTruthy();
  });
});

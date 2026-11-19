import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDevMode, isPreviewTopUpEnabled, isTopUpEnabled } from "./dev";

let mockAccountState: {
  address?: string;
  isConnected: boolean;
  chain?: { id: number; name: string };
} = {
  address: "0x1111111111111111111111111111111111111111",
  isConnected: true,
  chain: { id: 84532, name: "Base Sepolia" },
};

vi.mock("wagmi", () => ({
  useAccount: () => mockAccountState,
  useConnect: () => ({ connect: vi.fn(), connectors: [{ id: "mock" }] }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useSignMessage: () => ({ signMessageAsync: vi.fn(async () => "0xsig") }),
  useSwitchChain: () => ({ switchChain: vi.fn(), switchChainAsync: vi.fn(), isPending: false }),
  useConfig: () => ({ chains: [{ id: 84532 }] }),
  useCapabilities: () => ({ data: undefined }),
  useSendCalls: () => ({ sendCallsAsync: vi.fn() }),
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
  useSendTransaction: () => ({ sendTransactionAsync: vi.fn() }),
  useReadContracts: () => ({ data: undefined, refetch: vi.fn() }),
}));

vi.mock("../services/queries", () => ({
  authControllerGetChallenge: vi.fn(async () => ({ challenge: "c" })),
  authControllerLogin: vi.fn(async () => ({ accessToken: "tok" })),
  getAccountControllerGetBalanceQueryKey: () => ["balance"],
  useAccountControllerGetBalance: () => ({ data: undefined, refetch: vi.fn() }),
}));

import { Header } from "../shell/Header";
import { PhoneHeader } from "../shell/PhoneHeader";
import { useWalletSession } from "../shell/useWalletSession";
import { WalletView } from "../WalletView";
import { useComplianceStore } from "../compliance/store";

describe("dev-only gating", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("token", "test-jwt");
    localStorage.setItem("wallet-address", "0x1111111111111111111111111111111111111111");
    useComplianceStore.setState({ attested: true, gateOpen: false, blocked: false });
    mockAccountState = {
      address: "0x1111111111111111111111111111111111111111",
      isConnected: true,
      chain: { id: 84532, name: "Base Sepolia" },
    };
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("isDevMode returns false whenever DEV is false (production)", () => {
    expect(isDevMode({ DEV: false })).toBe(false);
    expect(isDevMode({ DEV: false, VITE_ENABLE_DEV_TOOLS: "true" })).toBe(false);
    expect(isDevMode({ DEV: true })).toBe(true);
    expect(isDevMode({ DEV: true, VITE_ENABLE_DEV_TOOLS: "false" })).toBe(false);
    expect(isDevMode({ DEV: true, VITE_ENABLE_DEV_TOOLS: "0" })).toBe(false);
  });

  it("hides Header and PhoneHeader dev top-up buttons and WalletView dev hint when dev tools are disabled", () => {
    vi.stubEnv("VITE_ENABLE_DEV_TOOLS", "false");
    vi.stubEnv("VITE_TUSDC_ADDRESS", "");
    vi.stubEnv("VITE_VAULT_ADDRESS", "");
    vi.stubEnv("VITE_PROOF_ANCHOR_ADDRESS", "");

    const qc = new QueryClient();
    const { unmount } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Header />
          <PhoneHeader />
          <WalletView />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.queryByRole("button", { name: /Get 100 test credits/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /0x11\.\.11/ }));
    expect(screen.queryByRole("button", { name: "Add 100 test credits" })).toBeNull();
    expect(screen.queryByText(/dev top-up button/i)).toBeNull();
    unmount();
  });

  it("handleDevTopUp is a no-op when dev tools are disabled", async () => {
    vi.stubEnv("VITE_ENABLE_DEV_TOOLS", "false");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { result } = renderHook(() => useWalletSession());
    await act(async () => {
      await result.current.handleDevTopUp();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("VITE_PREVIEW_TOPUP defaults off in production and enables only top-up when set to 'true'", () => {
    expect(isPreviewTopUpEnabled({ DEV: false })).toBe(false);
    expect(isPreviewTopUpEnabled({ DEV: false, VITE_PREVIEW_TOPUP: "false" })).toBe(false);
    expect(isPreviewTopUpEnabled({ DEV: false, VITE_PREVIEW_TOPUP: "true" })).toBe(true);

    expect(isTopUpEnabled({ DEV: false })).toBe(false);
    expect(isTopUpEnabled({ DEV: false, VITE_PREVIEW_TOPUP: "true" })).toBe(true);
    expect(isDevMode({ DEV: false, VITE_PREVIEW_TOPUP: "true" })).toBe(false);
  });

  it("shows labelled test/play top-up in Header and PhoneHeader when VITE_PREVIEW_TOPUP='true' in production mode, without dev hints", async () => {
    vi.stubEnv("VITE_ENABLE_DEV_TOOLS", "false");
    vi.stubEnv("VITE_PREVIEW_TOPUP", "true");
    vi.stubEnv("VITE_TUSDC_ADDRESS", "");
    vi.stubEnv("VITE_VAULT_ADDRESS", "");
    vi.stubEnv("VITE_PROOF_ANCHOR_ADDRESS", "");

    const qc = new QueryClient();
    const { unmount } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Header />
          <PhoneHeader />
          <WalletView />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("button", { name: "Get 100 test credits (play)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /0x11\.\.11/ }));
    expect(screen.getByRole("button", { name: "Add 100 test credits (play)" })).toBeTruthy();
    expect(screen.queryByText(/dev top-up button/i)).toBeNull();
    unmount();

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const { result } = renderHook(() => useWalletSession());
    await act(async () => {
      await result.current.handleDevTopUp();
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/payment\/debug\/deposit$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ amount: 100 }),
      }),
    );
  });
});

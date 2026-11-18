import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDevMode } from "./dev";

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
});

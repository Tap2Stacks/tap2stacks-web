import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useComplianceStore } from "../compliance/store";
import { useGameStore } from "../store";

const mockDisconnect = vi.fn();
const mockRefetchBalance = vi.fn();
const mockGetChallenge = vi.fn();
const mockLogin = vi.fn();

const { mockToast } = vi.hoisted(() => ({
  mockToast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("react-hot-toast", () => ({
  default: mockToast,
  toast: mockToast,
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: "0x1111111111111111111111111111111111111111",
    isConnected: true,
    chain: { id: 84532, name: "Base Sepolia" },
  }),
  useConnect: () => ({ connect: vi.fn(), connectors: [{ id: "mock" }] }),
  useDisconnect: () => ({ disconnect: mockDisconnect }),
  useSignMessage: () => ({ signMessageAsync: vi.fn(async () => "0xsig") }),
  useSwitchChain: () => ({ switchChain: vi.fn(), isPending: false }),
}));

vi.mock("../services/queries", () => ({
  authControllerGetChallenge: (...args: unknown[]) => mockGetChallenge(...args),
  authControllerLogin: (...args: unknown[]) => mockLogin(...args),
  getAccountControllerGetBalanceQueryKey: () => ["balance"],
  useAccountControllerGetBalance: () => ({
    data: undefined,
    refetch: mockRefetchBalance,
  }),
}));

import { useWalletSession } from "./useWalletSession";

describe("useWalletSession", () => {
  beforeEach(() => {
    localStorage.clear();
    useComplianceStore.setState({ attested: true, gateOpen: false, blocked: false });
    useGameStore.setState({ balance: 0, serverBalance: 0 });
    mockDisconnect.mockReset();
    mockRefetchBalance.mockReset();
    mockGetChallenge.mockReset().mockResolvedValue({ challenge: "c" });
    mockLogin.mockReset().mockResolvedValue({ accessToken: "tok" });
    mockToast.mockReset();
    mockToast.success.mockReset();
    mockToast.error.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an error toast when login fails with 500", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockLogin.mockRejectedValueOnce({ response: { status: 500 } });

    renderHook(() => useWalletSession());

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Sign in failed");
    });
    consoleError.mockRestore();
  });

  it("disconnect removes wallet-address, token, and all three demo keys", () => {
    localStorage.setItem("token", "tok");
    localStorage.setItem("wallet-address", "0x1111");
    const { result } = renderHook(() => useWalletSession());

    localStorage.setItem("is-demo-mode", "true");
    localStorage.setItem("demo-wallet-address", "0xdemo");
    localStorage.setItem("demo-private-key", "0xkey");

    act(() => {
      result.current.handleDisconnect();
    });

    expect(mockDisconnect).toHaveBeenCalled();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("wallet-address")).toBeNull();
    expect(localStorage.getItem("is-demo-mode")).toBeNull();
    expect(localStorage.getItem("demo-wallet-address")).toBeNull();
    expect(localStorage.getItem("demo-private-key")).toBeNull();
  });

  it("handleDevTopUp posts { amount: 100 } and shows success or error toast", async () => {
    localStorage.setItem("token", "tok");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("err", { status: 500 }));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useWalletSession());
    expect(typeof result.current.handleDevTopUp).toBe("function");

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
    expect(mockToast.success).toHaveBeenCalledWith("Added 100 test credits");
    expect(mockRefetchBalance).toHaveBeenCalled();

    await act(async () => {
      await result.current.handleDevTopUp();
    });
    expect(mockToast.error).toHaveBeenCalledWith("Failed to add test credits");
    consoleError.mockRestore();
  });
});

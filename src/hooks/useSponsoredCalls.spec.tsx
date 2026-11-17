import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeFunctionData, type Abi } from "viem";
import testUsdcAbi from "../contracts/abi/TestUSDC.json";
import tap2StacksVaultAbi from "../contracts/abi/Tap2StacksVault.json";

const mockSendCallsAsync = vi.fn();
const mockWriteContractAsync = vi.fn();
const mockSendTransactionAsync = vi.fn();
const mockWaitForCallsStatus = vi.fn();
const mockWaitForTransactionReceipt = vi.fn();
const mockCustomClient = vi.fn();

const { mockToast } = vi.hoisted(() => ({
  mockToast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

let mockCapabilitiesData: unknown = undefined;
const mockConfig = { chains: [{ id: 84532 }] };

vi.mock("react-hot-toast", () => ({
  default: mockToast,
  toast: mockToast,
}));

vi.mock("../services/custom-client", () => ({
  customClient: (...args: unknown[]) => mockCustomClient(...args),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  }),
  useConfig: () => mockConfig,
  useCapabilities: () => ({ data: mockCapabilitiesData }),
  useSendCalls: () => ({ sendCallsAsync: mockSendCallsAsync }),
  useWriteContract: () => ({ writeContractAsync: mockWriteContractAsync }),
  useSendTransaction: () => ({
    sendTransactionAsync: mockSendTransactionAsync,
  }),
}));

vi.mock("@wagmi/core", () => ({
  waitForCallsStatus: (...args: unknown[]) => mockWaitForCallsStatus(...args),
  waitForTransactionReceipt: (...args: unknown[]) =>
    mockWaitForTransactionReceipt(...args),
}));

import {
  clearPaymasterTokenCache,
  useSponsoredCalls,
} from "./useSponsoredCalls";

const TUSDC = "0x1111111111111111111111111111111111111111";
const VAULT = "0x2222222222222222222222222222222222222222";

const faucetCall = () => [
  {
    to: TUSDC as `0x${string}`,
    data: encodeFunctionData({
      abi: testUsdcAbi as Abi,
      functionName: "faucet",
    }),
  },
];

const depositCalls = () => [
  {
    to: TUSDC as `0x${string}`,
    data: encodeFunctionData({
      abi: testUsdcAbi as Abi,
      functionName: "approve",
      args: [VAULT, 5_000_000n],
    }),
  },
  {
    to: VAULT as `0x${string}`,
    data: encodeFunctionData({
      abi: tap2StacksVaultAbi as Abi,
      functionName: "deposit",
      args: [5_000_000n],
    }),
  },
];

describe("useSponsoredCalls", () => {
  beforeEach(() => {
    clearPaymasterTokenCache();
    mockCapabilitiesData = undefined;
    mockSendCallsAsync.mockReset();
    mockWriteContractAsync.mockReset();
    mockSendTransactionAsync.mockReset();
    mockCustomClient.mockReset();
    mockToast.mockReset();
    mockToast.success.mockReset();
    mockToast.error.mockReset();
    mockWaitForCallsStatus.mockReset().mockResolvedValue({ status: "success" });
    mockWaitForTransactionReceipt
      .mockReset()
      .mockResolvedValue({ status: "success" });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("sponsored send fetches a token and calls sendCalls with url ending in '/api/paymaster/t/tok123'", async () => {
    mockCapabilitiesData = {
      84532: { paymasterService: { supported: true } },
    };
    mockCustomClient.mockResolvedValue({
      token: "tok123",
      expiresAt: Date.now() + 900_000,
    });
    mockSendCallsAsync.mockResolvedValue({ id: "bundle-123" });

    const calls = faucetCall();
    const { result } = renderHook(() => useSponsoredCalls());
    expect(result.current.sponsored).toBe(true);

    let txId = "";
    await act(async () => {
      txId = await result.current.send(calls);
    });

    expect(txId).toBe("bundle-123");
    expect(mockCustomClient).toHaveBeenCalledWith({
      url: "/api/paymaster/token",
      method: "POST",
    });
    expect(mockSendCallsAsync).toHaveBeenCalledWith({
      chainId: 84532,
      calls,
      capabilities: {
        paymasterService: {
          url: expect.stringMatching(/\/api\/paymaster\/t\/tok123$/),
        },
      },
    });
    expect(mockWaitForCallsStatus).toHaveBeenCalledWith(mockConfig, {
      id: "bundle-123",
      throwOnFailure: true,
    });
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("reuses the cached token across two sponsored sends within lifetime", async () => {
    mockCapabilitiesData = {
      84532: { paymasterService: { supported: true } },
    };
    mockCustomClient.mockResolvedValue({
      token: "tok-cached",
      expiresAt: Date.now() + 900_000,
    });
    mockSendCallsAsync.mockResolvedValue({ id: "bundle-1" });

    const { result } = renderHook(() => useSponsoredCalls());
    await act(async () => {
      await result.current.send(faucetCall());
      await result.current.send(faucetCall());
    });

    expect(mockCustomClient).toHaveBeenCalledTimes(1);
    expect(mockSendCallsAsync).toHaveBeenCalledTimes(2);
  });

  it("refreshes a cached token within 60 s of expiresAt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    mockCapabilitiesData = {
      84532: { paymasterService: { supported: true } },
    };
    mockCustomClient
      .mockResolvedValueOnce({
        token: "tok-old",
        expiresAt: 1_700_000_120_000,
      })
      .mockResolvedValueOnce({
        token: "tok-fresh",
        expiresAt: 1_700_001_000_000,
      });
    mockSendCallsAsync.mockResolvedValue({ id: "bundle-x" });

    const { result } = renderHook(() => useSponsoredCalls());
    await act(async () => {
      await result.current.send(faucetCall());
    });

    vi.setSystemTime(1_700_000_070_000); // 50 s before expiresAt (< 60 s)
    await act(async () => {
      await result.current.send(faucetCall());
    });

    expect(mockCustomClient).toHaveBeenCalledTimes(2);
    expect(mockSendCallsAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        capabilities: {
          paymasterService: {
            url: expect.stringMatching(/\/api\/paymaster\/t\/tok-fresh$/),
          },
        },
      }),
    );
  });

  it("falls back to sequential writeContract without calling sendCalls when token fetch fails", async () => {
    mockCapabilitiesData = {
      84532: { paymasterService: { supported: true } },
    };
    mockCustomClient.mockRejectedValue(new Error("401 Unauthorized"));
    mockWriteContractAsync
      .mockResolvedValueOnce("0xhash1")
      .mockResolvedValueOnce("0xhash2");

    const { result } = renderHook(() => useSponsoredCalls());
    let hash = "";
    await act(async () => {
      hash = await result.current.send(depositCalls());
    });

    expect(hash).toBe("0xhash2");
    expect(mockSendCallsAsync).not.toHaveBeenCalled();
    expect(mockWriteContractAsync).toHaveBeenCalledTimes(2);
    expect(mockToast).toHaveBeenCalledWith("You pay gas");
  });

  it("treats a missing or non-string token response as a failure and falls back", async () => {
    mockCapabilitiesData = {
      84532: { paymasterService: { supported: true } },
    };
    mockCustomClient.mockResolvedValue({
      token: 12345,
      expiresAt: Date.now() + 900_000,
    });
    mockWriteContractAsync.mockResolvedValueOnce("0xhash1");

    const { result } = renderHook(() => useSponsoredCalls());
    await act(async () => {
      await result.current.send(faucetCall());
    });

    expect(mockSendCallsAsync).not.toHaveBeenCalled();
    expect(mockWriteContractAsync).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith("You pay gas");
  });

  it("falls back to writeContract and sponsored=false without the capability", async () => {
    mockCapabilitiesData = undefined;
    mockWriteContractAsync
      .mockResolvedValueOnce("0xhash1")
      .mockResolvedValueOnce("0xhash2");

    const { result } = renderHook(() => useSponsoredCalls());
    expect(result.current.sponsored).toBe(false);

    let hash = "";
    await act(async () => {
      hash = await result.current.send(depositCalls());
    });

    expect(hash).toBe("0xhash2");
    expect(mockSendCallsAsync).not.toHaveBeenCalled();
    expect(mockCustomClient).not.toHaveBeenCalled();
    expect(mockWriteContractAsync).toHaveBeenCalledTimes(2);
    expect(mockWaitForTransactionReceipt).toHaveBeenCalledTimes(2);
  });
});

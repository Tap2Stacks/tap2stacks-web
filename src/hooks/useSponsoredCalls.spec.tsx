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

let mockCapabilitiesData: unknown = undefined;
const mockConfig = { chains: [{ id: 84532 }] };

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

import { useSponsoredCalls } from "./useSponsoredCalls";

const TUSDC = "0x1111111111111111111111111111111111111111";
const VAULT = "0x2222222222222222222222222222222222222222";

describe("useSponsoredCalls", () => {
  beforeEach(() => {
    mockCapabilitiesData = undefined;
    mockSendCallsAsync.mockReset();
    mockWriteContractAsync.mockReset();
    mockSendTransactionAsync.mockReset();
    mockWaitForCallsStatus.mockReset().mockResolvedValue({ status: "success" });
    mockWaitForTransactionReceipt
      .mockReset()
      .mockResolvedValue({ status: "success" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses sendCalls with paymasterService when the wallet supports it", async () => {
    mockCapabilitiesData = {
      84532: { paymasterService: { supported: true } },
    };
    mockSendCallsAsync.mockResolvedValue({ id: "bundle-123" });

    const calls = [
      {
        to: TUSDC as `0x${string}`,
        data: encodeFunctionData({
          abi: testUsdcAbi as Abi,
          functionName: "faucet",
        }),
      },
    ];

    const { result } = renderHook(() => useSponsoredCalls());
    expect(result.current.sponsored).toBe(true);

    let txId = "";
    await act(async () => {
      txId = await result.current.send(calls);
    });

    expect(txId).toBe("bundle-123");
    expect(mockSendCallsAsync).toHaveBeenCalledWith({
      chainId: 84532,
      calls,
      capabilities: {
        paymasterService: {
          url: expect.stringMatching(/\/api\/paymaster$/),
        },
      },
    });
    expect(mockWaitForCallsStatus).toHaveBeenCalledWith(mockConfig, {
      id: "bundle-123",
      throwOnFailure: true,
    });
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("falls back to writeContract and sponsored=false without the capability", async () => {
    mockCapabilitiesData = undefined;
    mockWriteContractAsync
      .mockResolvedValueOnce("0xhash1")
      .mockResolvedValueOnce("0xhash2");

    const calls = [
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

    const { result } = renderHook(() => useSponsoredCalls());
    expect(result.current.sponsored).toBe(false);

    let hash = "";
    await act(async () => {
      hash = await result.current.send(calls);
    });

    expect(hash).toBe("0xhash2");
    expect(mockSendCallsAsync).not.toHaveBeenCalled();
    expect(mockWriteContractAsync).toHaveBeenCalledTimes(2);
    expect(mockWriteContractAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        address: TUSDC,
        functionName: "approve",
        args: [VAULT, 5_000_000n],
        chainId: 84532,
      }),
    );
    expect(mockWriteContractAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        address: VAULT,
        functionName: "deposit",
        args: [5_000_000n],
        chainId: 84532,
      }),
    );
    expect(mockWaitForTransactionReceipt).toHaveBeenCalledTimes(2);
  });
});

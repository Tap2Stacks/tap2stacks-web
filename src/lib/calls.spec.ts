import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeFunctionData, type Abi } from "viem";
import testUsdcAbi from "../contracts/abi/TestUSDC.json";
import tap2StacksVaultAbi from "../contracts/abi/Tap2StacksVault.json";
import {
  buildDepositCalls,
  buildFaucetCalls,
  buildWithdrawCalls,
} from "./calls";

const TUSDC = "0x1111111111111111111111111111111111111111";
const VAULT = "0x2222222222222222222222222222222222222222";
const ANCHOR = "0x3333333333333333333333333333333333333333";

describe("calls builders", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_TUSDC_ADDRESS", TUSDC);
    vi.stubEnv("VITE_VAULT_ADDRESS", VAULT);
    vi.stubEnv("VITE_PROOF_ANCHOR_ADDRESS", ANCHOR);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("buildFaucetCalls encodes faucet() on tUSDC", () => {
    const calls = buildFaucetCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].to).toBe(TUSDC);
    const decoded = decodeFunctionData({
      abi: testUsdcAbi as Abi,
      data: calls[0].data,
    });
    expect(decoded.functionName).toBe("faucet");
  });

  it("buildDepositCalls encodes approve then deposit to the vault", () => {
    const amount = 12_500_000n;
    const calls = buildDepositCalls(amount);

    expect(calls).toHaveLength(2);
    expect(calls[0].to).toBe(TUSDC);
    expect(calls[1].to).toBe(VAULT);

    const approveDecoded = decodeFunctionData({
      abi: testUsdcAbi as Abi,
      data: calls[0].data,
    });
    expect(approveDecoded.functionName).toBe("approve");
    expect(approveDecoded.args).toEqual([VAULT, amount]);

    const depositDecoded = decodeFunctionData({
      abi: tap2StacksVaultAbi as Abi,
      data: calls[1].data,
    });
    expect(depositDecoded.functionName).toBe("deposit");
    expect(depositDecoded.args).toEqual([amount]);
  });

  it("buildWithdrawCalls passes amount, deadline, signature in that order", () => {
    const permit = {
      amountBase: "25000000",
      deadline: 1_800_000_000,
      signature: "0xdeadbeef" as const,
    };

    const calls = buildWithdrawCalls(permit);
    expect(calls).toHaveLength(1);
    expect(calls[0].to).toBe(VAULT);

    const decoded = decodeFunctionData({
      abi: tap2StacksVaultAbi as Abi,
      data: calls[0].data,
    });
    expect(decoded.functionName).toBe("withdraw");
    expect(decoded.args).toEqual([
      25_000_000n,
      1_800_000_000n,
      "0xdeadbeef",
    ]);
  });
});

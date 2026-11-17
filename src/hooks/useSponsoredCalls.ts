import { useCallback } from "react";
import { waitForCallsStatus, waitForTransactionReceipt } from "@wagmi/core";
import { decodeFunctionData, type Abi, type Hash } from "viem";
import {
  useAccount,
  useCapabilities,
  useConfig,
  useSendCalls,
  useSendTransaction,
  useWriteContract,
} from "wagmi";
import { baseSepolia } from "../config/chains";
import { BACKEND_URL } from "../constant";
import testUsdcAbi from "../contracts/abi/TestUSDC.json";
import tap2StacksVaultAbi from "../contracts/abi/Tap2StacksVault.json";
import type { Call } from "../lib/calls";

const CONTRACT_ABIS: readonly Abi[] = [
  testUsdcAbi as Abi,
  tap2StacksVaultAbi as Abi,
];

interface CapabilityEntry {
  paymasterService?: {
    supported?: boolean;
  };
}

function hasPaymasterCapability(data: unknown, chainId: number): boolean {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string | number, unknown>;
  const direct = record as CapabilityEntry;
  if (typeof direct.paymasterService?.supported === "boolean") {
    return direct.paymasterService.supported;
  }
  const byChain = record[chainId] as CapabilityEntry | undefined;
  return Boolean(byChain?.paymasterService?.supported);
}

function decodeKnownCall(call: Call): {
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
} | null {
  for (const abi of CONTRACT_ABIS) {
    try {
      const decoded = decodeFunctionData({ abi, data: call.data });
      return {
        abi,
        functionName: decoded.functionName,
        args: decoded.args ?? [],
      };
    } catch {
      continue;
    }
  }
  return null;
}

async function sendSequentialCalls(
  calls: Call[],
  config: ReturnType<typeof useConfig> | undefined,
  writeContractAsync: ReturnType<typeof useWriteContract>["writeContractAsync"],
  sendTransactionAsync: ReturnType<
    typeof useSendTransaction
  >["sendTransactionAsync"],
): Promise<Hash | string> {
  let lastHash: Hash | string = "";
  for (const call of calls) {
    const decoded = decodeKnownCall(call);
    lastHash = decoded
      ? await writeContractAsync({
          address: call.to,
          abi: decoded.abi,
          functionName: decoded.functionName,
          args: decoded.args,
          chainId: baseSepolia.id,
        })
      : await sendTransactionAsync({
          to: call.to,
          data: call.data,
          chainId: baseSepolia.id,
        });

    if (config && typeof lastHash === "string" && lastHash.startsWith("0x")) {
      await waitForTransactionReceipt(config, {
        hash: lastHash as Hash,
        chainId: baseSepolia.id,
      });
    }
  }
  return lastHash;
}

/**
 * Send batched calls with EIP-5792 paymasterService sponsorship when supported on
 * Base Sepolia; otherwise execute calls sequentially via writeContract/sendTransaction.
 */
export function useSponsoredCalls(): {
  send: (calls: Call[]) => Promise<Hash | string>;
  sponsored: boolean;
} {
  const { address } = useAccount();
  const config = useConfig();
  const { data: capabilities } = useCapabilities({
    account: address,
    chainId: baseSepolia.id,
    query: { enabled: Boolean(address) },
  });
  const { sendCallsAsync } = useSendCalls();
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();

  const sponsored = hasPaymasterCapability(capabilities, baseSepolia.id);

  const send = useCallback(
    async (calls: Call[]): Promise<Hash | string> => {
      if (calls.length === 0) {
        throw new Error("No calls to submit");
      }

      if (!sponsored) {
        return sendSequentialCalls(
          calls,
          config,
          writeContractAsync,
          sendTransactionAsync,
        );
      }

      const paymasterUrl = `${BACKEND_URL}/api/paymaster`;
      const result = await sendCallsAsync({
        chainId: baseSepolia.id,
        calls,
        capabilities: { paymasterService: { url: paymasterUrl } },
      });
      const id = typeof result === "string" ? result : result.id;
      if (config) {
        await waitForCallsStatus(config, { id, throwOnFailure: true });
      }
      return id;
    },
    [
      config,
      sendCallsAsync,
      sendTransactionAsync,
      sponsored,
      writeContractAsync,
    ],
  );

  return { send, sponsored };
}

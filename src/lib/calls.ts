import { encodeFunctionData, type Abi, type Address, type Hex } from "viem";
import testUsdcAbi from "../contracts/abi/TestUSDC.json";
import tap2StacksVaultAbi from "../contracts/abi/Tap2StacksVault.json";
import { ADDRESSES } from "../contracts/addresses";

export interface Call {
  to: Address;
  data: Hex;
}

export interface WithdrawPermit {
  amountBase: string;
  deadline: number;
  signature: Hex;
}

const TUSDC_ABI = testUsdcAbi as Abi;
const VAULT_ABI = tap2StacksVaultAbi as Abi;

/** Build the on-chain call to claim 100 tUSDC from the TestUSDC faucet. */
export function buildFaucetCalls(): Call[] {
  return [
    {
      to: ADDRESSES.tUSDC,
      data: encodeFunctionData({
        abi: TUSDC_ABI,
        functionName: "faucet",
      }),
    },
  ];
}

/** Build approve + vault.deposit calls in order for a 6-decimal base unit amount. */
export function buildDepositCalls(amountBase: bigint): Call[] {
  return [
    {
      to: ADDRESSES.tUSDC,
      data: encodeFunctionData({
        abi: TUSDC_ABI,
        functionName: "approve",
        args: [ADDRESSES.vault, amountBase],
      }),
    },
    {
      to: ADDRESSES.vault,
      data: encodeFunctionData({
        abi: VAULT_ABI,
        functionName: "deposit",
        args: [amountBase],
      }),
    },
  ];
}

/** Build the vault.withdraw(amount, deadline, signature) call from a backend permit. */
export function buildWithdrawCalls(permit: WithdrawPermit): Call[] {
  return [
    {
      to: ADDRESSES.vault,
      data: encodeFunctionData({
        abi: VAULT_ABI,
        functionName: "withdraw",
        args: [
          BigInt(permit.amountBase),
          BigInt(permit.deadline),
          permit.signature,
        ],
      }),
    },
  ];
}

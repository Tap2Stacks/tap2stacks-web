import { formatUnits, parseUnits } from "viem";
import { getAddresses, type ContractAddresses } from "../contracts/addresses";

export function formatAmount(
  value: bigint | undefined,
  decimals: number,
  digits = 4,
  fallback = "—",
) {
  if (value === undefined) return fallback;

  return Number(formatUnits(value, decimals)).toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
}

export function formatCompactNumber(value: number, digits = 2) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  });
}

export function safeParseUnits(value: string, decimals: number) {
  if (!value) return 0n;

  try {
    return parseUnits(value, decimals);
  } catch {
    return 0n;
  }
}

export function resolveContractAddresses(): ContractAddresses | null {
  try {
    return getAddresses();
  } catch {
    return null;
  }
}


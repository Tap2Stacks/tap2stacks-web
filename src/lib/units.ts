import { formatUnits, parseUnits } from "viem";

export const TUSDC_DECIMALS = 6;

/** Convert a decimal tUSDC string into 6-decimal base units; rejects >6 fractional digits. */
export function toBaseUnits(amount: string): bigint {
  const trimmed = amount.trim();
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) {
    throw new Error(`Invalid tUSDC amount: "${amount}"`);
  }

  const [, fraction = ""] = trimmed.split(".");
  if (fraction.length > TUSDC_DECIMALS) {
    throw new Error(
      `Amount "${amount}" has ${fraction.length} decimal places; maximum is ${TUSDC_DECIMALS}`,
    );
  }

  return parseUnits(trimmed, TUSDC_DECIMALS);
}

/** Format 6-decimal base units into a human-readable tUSDC decimal string. */
export function fromBaseUnits(value: bigint): string {
  return formatUnits(value, TUSDC_DECIMALS);
}

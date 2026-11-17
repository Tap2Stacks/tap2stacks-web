import toast from "react-hot-toast";
import { formatUnits } from "viem";
import { getAddresses, type ContractAddresses } from "../contracts/addresses";
import { TUSDC_DECIMALS, toBaseUnits } from "../lib/units";

export interface ParsedUsdcInput {
  base: bigint;
  normalized: string;
  valid: boolean;
  error: string | null;
}

export function formatAmount(
  value: bigint | undefined,
  decimals = TUSDC_DECIMALS,
  digits = 2,
  fallback = "—",
): string {
  if (value === undefined) return fallback;
  return Number(formatUnits(value, decimals)).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: Math.max(digits, 6),
  });
}

export function formatCompactNumber(value: number, digits = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: Math.max(digits, 2),
  });
}

export function resolveContractAddresses(): ContractAddresses | null {
  try {
    return getAddresses();
  } catch {
    return null;
  }
}

export function toSafeBaseUnits(raw: string): bigint {
  const trimmed = raw.trim();
  if (!trimmed) return 0n;
  const [whole, frac = ""] = trimmed.split(".");
  const clipped = frac.length > TUSDC_DECIMALS
    ? `${whole || "0"}.${frac.slice(0, TUSDC_DECIMALS)}`
    : trimmed;
  try {
    return toBaseUnits(clipped);
  } catch {
    return 0n;
  }
}

export function parseUsdcInput(
  raw: string,
  maxBase: bigint | null,
): ParsedUsdcInput {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { base: 0n, normalized: "", valid: false, error: null };
  }

  try {
    const base = toBaseUnits(trimmed);
    if (base <= 0n) {
      return {
        base: 0n,
        normalized: trimmed,
        valid: false,
        error: "Enter an amount greater than 0",
      };
    }
    if (maxBase !== null && base > maxBase) {
      return {
        base,
        normalized: trimmed,
        valid: false,
        error: "Exceeds available balance",
      };
    }
    return { base, normalized: trimmed, valid: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const error = /decimal places/i.test(message)
      ? "Enter up to 6 decimals"
      : "Enter a valid tUSDC amount";
    return { base: 0n, normalized: trimmed, valid: false, error };
  }
}

export function formatCooldown(seconds: number): string {
  if (seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function isUserRejected(error: unknown): boolean {
  let cur: unknown = error;
  for (let depth = 0; depth < 4 && cur && typeof cur === "object"; depth++) {
    const rec = cur as { code?: unknown; name?: unknown; message?: unknown; cause?: unknown };
    if (rec.code === 4001 || rec.name === "UserRejectedRequestError") {
      return true;
    }
    if (
      typeof rec.message === "string" &&
      /user rejected|user denied|rejected the request/i.test(rec.message)
    ) {
      return true;
    }
    cur = rec.cause;
  }
  return false;
}

export function notifyWalletError(error: unknown, fallback: string): void {
  const res = error as { response?: { status?: number }; status?: number } | null;
  const status = res?.response?.status ?? res?.status;
  if (status === 503) {
    toast.error("Withdrawals open soon");
    return;
  }
  if (status === 409) {
    toast.error("Withdrawal is being prepared, try again in a moment");
    return;
  }
  if (status === 401) {
    toast.error("Sign in with your wallet to continue");
    return;
  }
  if (isUserRejected(error)) {
    toast("Cancelled");
    return;
  }
  const msg = error instanceof Error ? error.message : "";
  if (/FaucetCooldown/i.test(msg)) {
    toast.error("Faucet cooldown active");
    return;
  }
  if (/InsufficientVaultBalance/i.test(msg)) {
    toast.error("Vault balance unavailable");
    return;
  }
  toast.error(fallback);
}

import axios from "axios";
import { clsx } from "clsx";
import { format } from "date-fns";
import { twMerge } from "tailwind-merge";
import { getAddresses } from "../contracts/addresses";
import type { CanonicalSettledOrder, Hex, MerkleProofStep } from "../lib/proofVerify";

export const PAGE_SIZE = 10;

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: string | number | undefined) {
  const amount =
    typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return `$${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value?: string) {
  if (!value) return "Awaiting settlement";
  try {
    return format(new Date(value), "MMM d, yyyy · HH:mm:ss");
  } catch {
    return value;
  }
}

export function formatTimeRange(fromMs: number, toMs: number): string {
  try {
    const start = format(new Date(fromMs), "MMM d, HH:mm:ss");
    const end = format(new Date(toMs), "HH:mm:ss");
    return `${start} – ${end}`;
  } catch {
    return `${fromMs} – ${toMs}`;
  }
}

export function shortHash(value?: string, head = 8, tail = 6) {
  if (!value) return "—";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

export function resolveProofAnchorAddress(): string | null {
  try {
    return getAddresses().proofAnchor;
  } catch {
    return null;
  }
}

export function getResponsePayload(data: unknown) {
  if (data && typeof data === "object" && "data" in data) {
    return (data as { data?: unknown }).data;
  }
  return data;
}

export interface Order {
  id?: string;
  orderId?: string;
  order_id?: string;
  settledAt?: string;
  createdAt?: string;
  marketId?: string;
  rewardRate?: string | number;
  amount: string | number;
  settledWin?: boolean | null;
  status?: string;
}

export interface ProofBatch {
  index: number;
  fromMs: number;
  toMs: number;
  tapsRoot: Hex;
  priceLogHash: Hex;
  txHash: Hex;
}

export type AnchoredTap = CanonicalSettledOrder & {
  leafHash: Hex;
  proof: MerkleProofStep[];
};

export interface OrderProofResponse {
  orderId: string;
  batch: ProofBatch;
  tap: AnchoredTap;
  priceLogIndexes: number[];
}

export interface OrderProof {
  orderId: string;
  batch: ProofBatch;
  tap: AnchoredTap;
  priceLogIndexes: number[];
  merkleVerified: boolean;
  priceLogVerified: boolean;
}

export function resolveOrderId(order: Order) {
  return order.orderId ?? order.id ?? order.order_id;
}

export function getOrderProofKeys(order: Order) {
  const keys = [order.orderId, order.id, order.order_id]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return [...new Set(keys)];
}

export function isVoidedOrder(order: Order): boolean {
  return (order.status ?? "").toUpperCase() === "VOIDED";
}

export function isOrderSettled(order: Order) {
  const status = (order.status ?? "").toLowerCase();
  return (
    Boolean(order.settledAt) ||
    order.settledWin !== null ||
    status === "voided" ||
    status.includes("settled") ||
    status.includes("resolved") ||
    status.includes("complete")
  );
}

export function isOrderStillAnchoring(order: Order) {
  const status = (order.status ?? "").toLowerCase();
  return (
    status.includes("pending") ||
    status.includes("processing") ||
    status.includes("anchoring")
  );
}

export function normalizeOrders(payload: unknown): Order[] {
  if (Array.isArray(payload)) return payload as Order[];
  if (
    payload &&
    typeof payload === "object" &&
    "items" in payload &&
    Array.isArray((payload as { items?: unknown }).items)
  ) {
    return (payload as { items: Order[] }).items;
  }
  return [];
}

export function normalizeOrderProofResponse(
  payload: unknown,
): OrderProofResponse | null {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Partial<OrderProofResponse>;
  if (!candidate.orderId || !candidate.batch || !candidate.tap) return null;
  return {
    orderId: candidate.orderId,
    batch: candidate.batch,
    tap: {
      ...candidate.tap,
      proof: Array.isArray(candidate.tap.proof) ? candidate.tap.proof : [],
    },
    priceLogIndexes: Array.isArray(candidate.priceLogIndexes)
      ? candidate.priceLogIndexes
      : [candidate.batch.index],
  };
}

export function resolveProofError(error: unknown): {
  pending: boolean;
  message: string;
} {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { code?: string; message?: string } | undefined;
    if (data?.code === "PROOF_PENDING") {
      return {
        pending: true,
        message: "Proof will be anchored within about 5 minutes",
      };
    }
    if (data?.code === "ORDER_NOT_FOUND") {
      return { pending: false, message: "Order not found." };
    }
    if (error.response?.status === 404 || error.response?.status === 202) {
      return {
        pending: true,
        message: "Proof will be anchored within about 5 minutes",
      };
    }
  }
  return {
    pending: false,
    message:
      error instanceof Error
        ? error.message
        : "Failed to fetch proof for this order.",
  };
}

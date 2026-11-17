import axios from "axios";
import { format } from "date-fns";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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

export function formatAnchorTime(value?: string) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${hours}:${minutes} ${day}/${month}`;
}

export function shortHash(value?: string, head = 8, tail = 6) {
  if (!value) return "—";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
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

interface OrderProofNode {
  position: string;
  hash: string;
}

export interface OrderProof {
  orderId: string;
  batchId: string;
  leafHash: string;
  merkleRoot: string;
  proof: OrderProofNode[];
  verified: boolean;
  topicId?: string;
  sequenceNumber?: string;
  consensusTimestamp?: string;
  transactionHash?: string;
  txHash?: string;
}

export function resolveOrderId(order: Order) {
  if (order.orderId) return order.orderId;
  if (order.id) return order.id;
  if (order.order_id) return order.order_id;
  return undefined;
}

export function getOrderProofKeys(order: Order) {
  const keys = [order.orderId, order.id, order.order_id]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return [...new Set(keys)];
}

export function isOrderSettled(order: Order) {
  const status = (order.status ?? "").toLowerCase();
  return (
    Boolean(order.settledAt) ||
    order.settledWin !== null ||
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
  if (Array.isArray(payload)) {
    return payload as Order[];
  }

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

export function normalizeProof(payload: unknown): OrderProof | null {
  if (!payload || typeof payload !== "object") return null;

  const candidate = payload as Partial<OrderProof>;
  if (!candidate.orderId || !candidate.batchId) return null;

  return {
    orderId: candidate.orderId,
    batchId: candidate.batchId,
    leafHash: candidate.leafHash ?? "",
    merkleRoot: candidate.merkleRoot ?? "",
    proof: Array.isArray(candidate.proof) ? candidate.proof : [],
    verified: Boolean(candidate.verified),
    topicId: candidate.topicId,
    sequenceNumber: candidate.sequenceNumber,
    consensusTimestamp: candidate.consensusTimestamp,
    transactionHash: candidate.transactionHash,
    txHash: candidate.txHash,
  };
}

export function isProofPendingError(error: unknown) {
  const fallbackMessage =
    error instanceof Error ? error.message.toLowerCase() : "";

  if (!axios.isAxiosError(error)) {
    return /(not ready|pending|processing|anchoring|not found|empty)/.test(
      fallbackMessage,
    );
  }

  const status = error.response?.status;
  if (status === 202 || status === 204 || status === 404 || status === 409) {
    return true;
  }

  const responseMessage = getResponsePayload(error.response?.data);
  const details =
    typeof responseMessage === "string"
      ? responseMessage.toLowerCase()
      : JSON.stringify(responseMessage ?? "").toLowerCase();

  return /(not ready|pending|processing|anchoring|not found|no proof|empty)/.test(
    `${details} ${fallbackMessage}`,
  );
}


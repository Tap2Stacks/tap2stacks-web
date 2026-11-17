import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../constant";
import {
  hashLeaf,
  hashPriceLog,
  normalizeHex,
  verifyMerkleProof,
} from "../lib/proofVerify";
import {
  PAGE_SIZE,
  formatMoney,
  getOrderProofKeys,
  getResponsePayload,
  isOrderSettled,
  isVoidedOrder,
  normalizeOrderProofResponse,
  normalizeOrders,
  resolveOrderId,
  resolveProofError,
  type Order,
  type OrderProof,
  type OrderProofResponse,
} from "./historyUtils";

async function verifyProofPayload(
  res: OrderProofResponse,
): Promise<{ merkleVerified: boolean; priceLogVerified: boolean }> {
  const leaf = await hashLeaf(res.tap);
  const merkleVerified =
    normalizeHex(leaf) === normalizeHex(res.tap.leafHash) &&
    (await verifyMerkleProof(leaf, res.tap.proof, res.batch.tapsRoot));

  const indexes = res.priceLogIndexes.length
    ? res.priceLogIndexes
    : [res.batch.index];
  let priceLogVerified = false;

  try {
    const downloads = await Promise.all(
      indexes.map(async (idx) => {
        const logRes = await axios.get<ArrayBuffer>(
          `${BACKEND_URL}/api/proofs/${idx}/price-log`,
          { responseType: "arraybuffer" },
        );
        return { idx, bytes: new Uint8Array(logRes.data) };
      }),
    );
    const matching = downloads.find((entry) => entry.idx === res.batch.index);
    if (matching) {
      const digest = await hashPriceLog(matching.bytes);
      priceLogVerified =
        normalizeHex(digest) === normalizeHex(res.batch.priceLogHash);
    }
  } catch {
    priceLogVerified = false;
  }

  return { merkleVerified, priceLogVerified };
}

function updatePendingMap(
  current: Record<string, boolean>,
  keys: string[],
  pending: boolean,
): Record<string, boolean> {
  if (pending) {
    const next = { ...current };
    keys.forEach((key) => {
      next[key] = true;
    });
    return next;
  }
  if (!keys.some((key) => current[key])) return current;
  const next = { ...current };
  keys.forEach((key) => {
    delete next[key];
  });
  return next;
}

export function useHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [isProofOpen, setIsProofOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofData, setProofData] = useState<OrderProof | null>(null);
  const [proofButtonLoadingOrderId, setProofButtonLoadingOrderId] = useState<
    string | null
  >(null);
  const [pendingProofByOrderId, setPendingProofByOrderId] = useState<
    Record<string, boolean>
  >({});

  const fetchHistory = async (pageIdx: number) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setOrders([]);
        return;
      }
      const offset = pageIdx * PAGE_SIZE;
      const response = await axios.get(
        `${BACKEND_URL}/api/orders/user?limit=${PAGE_SIZE}&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}`, accept: "*/*" } },
      );
      setOrders(normalizeOrders(getResponsePayload(response.data)));
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchHistory(page);
  }, [page]);

  const fetchProof = useCallback(
    async (orderId: string, orderKeys: string[] = [orderId]) => {
      const targetKeys = orderKeys.length ? orderKeys : [orderId];
      setProofLoading(true);
      setProofError(null);
      setProofData(null);

      try {
        const response = await axios.get(
          `${BACKEND_URL}/api/proofs/orders/${encodeURIComponent(orderId)}`,
        );
        const payload = normalizeOrderProofResponse(
          getResponsePayload(response.data),
        );
        if (!payload) {
          throw new Error("Proof payload is empty or malformed.");
        }
        const checks = await verifyProofPayload(payload);
        setProofData({ ...payload, ...checks });
        setPendingProofByOrderId((cur) =>
          updatePendingMap(cur, targetKeys, false),
        );
      } catch (error) {
        const resolved = resolveProofError(error);
        setProofError(resolved.message);
        setPendingProofByOrderId((cur) =>
          updatePendingMap(cur, targetKeys, resolved.pending),
        );
      } finally {
        setProofLoading(false);
      }
    },
    [],
  );

  const openProof = useCallback(
    (order: Order) => {
      if (!isOrderSettled(order)) return;
      const orderId = resolveOrderId(order);
      if (!orderId) return;
      setProofButtonLoadingOrderId(orderId);
      setSelectedOrderId(orderId);
      setIsProofOpen(true);
      void fetchProof(orderId, getOrderProofKeys(order)).finally(() => {
        setProofButtonLoadingOrderId((cur) => (cur === orderId ? null : cur));
      });
    },
    [fetchProof],
  );

  const closeProof = () => {
    setIsProofOpen(false);
    setSelectedOrderId(null);
    setProofError(null);
    setProofData(null);
    setProofLoading(false);
  };

  const stats = useMemo(() => {
    const settled = orders.filter(
      (o) => !isVoidedOrder(o) && o.settledWin !== null,
    );
    const wins = settled.filter((o) => o.settledWin === true).length;
    const pending = orders.filter(
      (o) => !isVoidedOrder(o) && o.settledWin == null,
    ).length;
    const totalVolume = orders.reduce((sum, order) => {
      const amt =
        typeof order.amount === "number"
          ? order.amount
          : Number.parseFloat(order.amount || "0");
      return sum + amt;
    }, 0);

    return {
      total: orders.length,
      settled: orders.filter(isOrderSettled).length,
      winRate:
        settled.length > 0
          ? `${((wins / settled.length) * 100).toFixed(1)}%`
          : "0.0%",
      pending,
      volume: formatMoney(totalVolume),
    };
  }, [orders]);

  return {
    orders,
    loading,
    page,
    setPage,
    isProofOpen,
    selectedOrderId,
    proofLoading,
    proofError,
    proofData,
    proofButtonLoadingOrderId,
    pendingProofByOrderId,
    fetchHistory,
    openProof,
    closeProof,
    stats,
    hasNextPage: orders.length === PAGE_SIZE,
  };
}

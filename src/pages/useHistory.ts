import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../constant";
import { getExplorerSearchUrl, getExplorerTopicMessagesUrl } from "../utils/chain";
import {
  PAGE_SIZE, formatMoney, isOrderSettled, resolveOrderId, getResponsePayload, getOrderProofKeys, isProofPendingError,
  normalizeOrders, normalizeProof, type Order, type OrderProof,
} from "./historyUtils";

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
        setLoading(false);
        return;
      }

      const offset = pageIdx * PAGE_SIZE;
      const response = await axios.get(
        `${BACKEND_URL}/api/orders/user?limit=${PAGE_SIZE}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            accept: "*/*",
          },
        },
      );
      const payload = getResponsePayload(response.data);
      setOrders(normalizeOrders(payload));
    } catch (error) {
      console.error(error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory(page);
  }, [page]);

  const fetchProof = useCallback(
    async (orderId: string, orderKeys: string[] = [orderId]) => {
      const targetKeys = orderKeys.length ? orderKeys : [orderId];

      setProofLoading(true);
      setProofError(null);
      setProofData(null);

      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(
          `${BACKEND_URL}/api/v1/hcs-anchor/orders/${encodeURIComponent(orderId)}/proof`,
          {
            headers: {
              accept: "*/*",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
        );

        const payload = normalizeProof(getResponsePayload(response.data));
        if (!payload) {
          throw new Error("Proof payload is empty or malformed.");
        }

        setProofData(payload);
        setPendingProofByOrderId((current) => {
          const hasAnyPending = targetKeys.some((key) => current[key]);
          if (!hasAnyPending) return current;

          const next = { ...current };
          targetKeys.forEach((key) => {
            delete next[key];
          });
          return next;
        });
      } catch (error) {
        console.error("Failed to load order proof", error);
        const isPending = isProofPendingError(error);
        const message = isPending
          ? "Proof is still anchoring on backend. Please try again shortly."
          : error instanceof Error
            ? error.message
            : "Failed to fetch proof for this order.";
        setProofError(message);
        setPendingProofByOrderId((current) => {
          if (isPending) {
            const next = { ...current };
            targetKeys.forEach((key) => {
              next[key] = true;
            });
            return next;
          }

          const hasAnyPending = targetKeys.some((key) => current[key]);
          if (!hasAnyPending) return current;

          const next = { ...current };
          targetKeys.forEach((key) => {
            delete next[key];
          });
          return next;
        });
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
      const orderProofKeys = getOrderProofKeys(order);

      setProofButtonLoadingOrderId(orderId);
      setSelectedOrderId(orderId);
      setIsProofOpen(true);
      void fetchProof(orderId, orderProofKeys).finally(() => {
        setProofButtonLoadingOrderId((current) =>
          current === orderId ? null : current,
        );
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
    const settled = orders.filter((order) => order.settledWin !== null);
    const wins = settled.filter((order) => order.settledWin === true).length;
    const pending = orders.filter((order) => order.settledWin == null).length;
    const totalVolume = orders.reduce((sum, order) => {
      const amount =
        typeof order.amount === "number"
          ? order.amount
          : Number.parseFloat(order.amount || "0");

      return sum + amount;
    }, 0);

    return {
      total: orders.length,
      settled: settled.length,
      winRate:
        settled.length > 0
          ? `${((wins / settled.length) * 100).toFixed(1)}%`
          : "0.0%",
      pending,
      volume: formatMoney(totalVolume),
    };
  }, [orders]);

  const hasNextPage = orders.length === PAGE_SIZE;
  const proofTxHash = proofData?.transactionHash ?? proofData?.txHash;
  const proofSearchHref = proofData?.topicId
    ? getExplorerTopicMessagesUrl(proofData.topicId)
    : proofData?.batchId
      ? getExplorerSearchUrl(proofData.batchId)
      : undefined;

  return {
    orders, loading, page, setPage,
    isProofOpen, selectedOrderId, proofLoading, proofError,
    proofData, proofButtonLoadingOrderId, pendingProofByOrderId, fetchHistory,
    openProof, closeProof, stats, hasNextPage,
    proofTxHash, proofSearchHref,
  };
}

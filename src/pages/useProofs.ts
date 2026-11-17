import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../constant";
import { getResponsePayload, type ProofBatch } from "./historyUtils";

export const PROOFS_PAGE_SIZE = 20;

export function useProofs() {
  const [batches, setBatches] = useState<ProofBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);

  const fetchBatches = useCallback(async (pageIdx: number) => {
    setLoading(true);
    try {
      const offset = pageIdx * PROOFS_PAGE_SIZE;
      const response = await axios.get(
        `${BACKEND_URL}/api/proofs?limit=${PROOFS_PAGE_SIZE}&offset=${offset}`,
      );
      const payload = getResponsePayload(response.data);
      setBatches(Array.isArray(payload) ? (payload as ProofBatch[]) : []);
    } catch {
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBatches(page);
  }, [fetchBatches, page]);

  return {
    batches,
    loading,
    page,
    setPage,
    hasNextPage: batches.length === PROOFS_PAGE_SIZE,
    refresh: () => void fetchBatches(page),
  };
}

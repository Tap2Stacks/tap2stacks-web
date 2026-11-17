import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import CryptoJS from "crypto-js";
import { io, type Socket } from "socket.io-client";
import { useAccount } from "wagmi";
import { BACKEND_URL } from "../constant";
import type { TradeFeedEntry } from "../feed/types";
import {
  authControllerGetChallenge,
  authControllerGetWssKey,
  getAccountControllerGetBalanceQueryKey,
} from "../services/queries";
import { useGameStore } from "../store";
import { useAuthToken } from "./authToken";
import { emitPrice, emitTradeFeed } from "./bus";

/**
 * Manages the shared Socket.IO connection, wssKey HMAC user subscription,
 * store updates, and realtime bus emissions. Mounted once in Layout.
 */
export function useRealtime(): void {
  const updatePrice = useGameStore((state) => state.updatePrice);
  const updateGrid = useGameStore((state) => state.updateGrid);
  const setFeedStale = useGameStore((state) => state.setFeedStale);
  const setConnection = useGameStore((state) => state.setConnection);
  const updateOrder = useGameStore((state) => state.updateOrder);
  const updateBalance = useGameStore((state) => state.updateBalance);

  const { address } = useAccount();
  const queryClient = useQueryClient();
  const token = useAuthToken();

  useEffect(() => {
    let socket: Socket | null = null;
    let isActive = true;

    const connectWss = async () => {
      try {
        socket = io(BACKEND_URL);

        socket.on("connect", async () => {
          if (!isActive) return;

          try {
            if (token) {
              const wssKeyRes = await authControllerGetWssKey();
              const wssKey = (wssKeyRes as unknown as { key: string }).key;
              setConnection(socket, wssKey);

              if (address) {
                const challengeRes = await authControllerGetChallenge({
                  address,
                });
                const wssChallenge = (
                  challengeRes as unknown as { challenge: string }
                ).challenge;

                const hmac = CryptoJS.algo.HMAC.create(
                  CryptoJS.algo.SHA256,
                  CryptoJS.enc.Hex.parse(wssKey),
                );
                hmac.update(address);
                hmac.update(wssChallenge);

                const wssSignature = hmac.finalize().toString(CryptoJS.enc.Hex);

                socket?.emit("subscribe_user", {
                  userId: address,
                  signature: wssSignature,
                });
              }
            }
          } catch (error) {
            console.error("WSS subscription error:", error);
          }
        });

        socket.on("price_now", (data) => {
          if (data?.price !== undefined) {
            updatePrice(data.price, data.ts, data.ticker);
            const numericPrice =
              typeof data.price === "number"
                ? data.price
                : parseFloat(data.price);
            if (Number.isFinite(numericPrice)) {
              const ticker = data.ticker ?? useGameStore.getState().ticker;
              const ts = typeof data.ts === "number" ? data.ts : Date.now();
              emitPrice(ticker, ts, numericPrice);
            }
          }
        });

        socket.on("grid_update", (data) => {
          if (Array.isArray(data) || (data && Array.isArray(data.cells))) {
            updateGrid(data);
          }
        });

        socket.on("feed_health", (data) => {
          if (data?.ticker) {
            setFeedStale(data.ticker, Boolean(data.stale));
            if (data.prevDayPx !== undefined) useGameStore.getState().setPrevDayPx(data.ticker, data.prevDayPx);
          }
        });

        socket.on("balance_update", (data) => {
          if (data) {
            queryClient.setQueryData(
              getAccountControllerGetBalanceQueryKey(),
              data,
            );
            if (typeof data.free !== "undefined") {
              updateBalance(Number(data.free));
            }
          }
        });

        socket.on("order_update", (data) => {
          updateOrder(data);
        });

        socket.on("trade_feed", (data) => {
          if (data && typeof data === "object") {
            emitTradeFeed(data as TradeFeedEntry);
          }
        });
      } catch (error) {
        console.error("WebSocket setup failed:", error);
      }
    };

    connectWss();

    return () => {
      isActive = false;
      socket?.disconnect();
    };
  }, [
    address,
    queryClient,
    setConnection,
    setFeedStale,
    token,
    updateBalance,
    updateGrid,
    updateOrder,
    updatePrice,
  ]);
}

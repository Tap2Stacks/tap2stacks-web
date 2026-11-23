import { create } from "zustand";
import toast from "react-hot-toast";
import type { Socket } from "socket.io-client";
import { rejectMessage, type RejectReason } from "./lib/rejectReasons";

import type { Coin, CoinStack } from "./board/types";
import { addPendingCoin, applyOrderUpdate, stacksFromOpenOrders, expirePending } from "./board/stacks";
import { PRICE_STEP_BY_TICKER, TICKERS, type Ticker as SupportedTicker } from "./constant/tickers";

export type Ticker = SupportedTicker;

const initialFeedStale = Object.fromEntries(
  TICKERS.map((ticker) => [ticker, false]),
) as Record<Ticker, boolean>;

export interface PricePoint {
  time: number; // timestamp
  price: number;
}

export interface CellData {
  id: string;
  timeWindowStart: number;
  timeWindowEnd: number;
  priceLevel: number; // The price band (e.g. 157.515)
  multiplier: number;
  status: "active" | "past" | "hit" | "voided" | "miss";
  original: RemoteCell;
}

export interface RemoteCell {
  ticker: string;
  gridTs: number;
  startTs: number;
  endTs: number;
  lowerPrice: string;
  upperPrice: string;
  rewardRate: string;
  gridSignature: string;
}

export interface GridUpdatePayload {
  ticker: Ticker | string;
  gridTs?: number;
  priceStep?: string | number;
  cells: RemoteCell[];
}

export interface OrderUpdatePayload {
  orderId?: string;
  clientTapId?: string;
  ticker?: string;
  marketId?: string;
  cellId?: string;
  cellTimeStart?: number;
  cellTimeEnd?: number;
  startTs?: number;
  endTs?: number;
  lowerPrice?: string;
  upperPrice?: string;
  rewardRate?: string;
  amount?: string | number;
  status?: string;
  reason?: RejectReason;
  settledWin?: boolean | string;
  cell?: Partial<RemoteCell>;
}

export function isCellTappable(
  cell: CellData,
  syncedNow: number,
  options: {
    hasBet?: boolean;
    feedStale?: boolean;
    lockWindowMs?: number;
  } = {},
): boolean {
  if (options.feedStale || options.hasBet) return false;
  const lockWindowMs = options.lockWindowMs ?? 5000;
  return (
    cell.timeWindowStart > syncedNow &&
    cell.timeWindowStart - syncedNow > lockWindowMs
  );
}

function buildCellId(
  ticker: string | undefined,
  start: number | string | undefined,
  end: number | string | undefined,
  lower: string | number | undefined,
  upper: string | number | undefined,
): string {
  return ticker
    ? `${ticker}:${start}:${end}:${lower}:${upper}`
    : `${start}:${end}:${lower}:${upper}`;
}

function resolveOrderCellId(
  data: OrderUpdatePayload,
  state: Pick<GameState, "cells" | "bets" | "pendingBets">,
): string {
  const ticker = data.ticker || data.cell?.ticker || data.marketId;
  const start = data.cellTimeStart || data.cell?.startTs || data.startTs;
  const end = data.cellTimeEnd || data.cell?.endTs || data.endTs;
  const lower = data.lowerPrice ?? data.cell?.lowerPrice;
  const upper = data.upperPrice ?? data.cell?.upperPrice;

  if (
    data.cellId &&
    (start === undefined ||
      end === undefined ||
      lower === undefined ||
      upper === undefined)
  ) {
    return String(data.cellId);
  }

  const exactId = buildCellId(ticker, start, end, lower, upper);
  if (
    state.bets[exactId] !== undefined ||
    state.pendingBets[exactId] !== undefined ||
    state.cells.some((c) => c.id === exactId)
  ) {
    return exactId;
  }

  if (start !== undefined && end !== undefined) {
    const startNum = Number(start);
    const endNum = Number(end);
    const lowerNum = lower !== undefined ? parseFloat(String(lower)) : NaN;
    const upperNum = upper !== undefined ? parseFloat(String(upper)) : NaN;

    const matchedCell = state.cells.find((c) => {
      if (ticker && c.original.ticker !== ticker) return false;
      if (c.timeWindowStart !== startNum || c.timeWindowEnd !== endNum) {
        return false;
      }
      if (Number.isFinite(lowerNum) && Number.isFinite(upperNum)) {
        return (
          Math.abs(parseFloat(c.original.lowerPrice) - lowerNum) < 1e-6 &&
          Math.abs(parseFloat(c.original.upperPrice) - upperNum) < 1e-6
        );
      }
      return Boolean(state.bets[c.id] || state.pendingBets[c.id]);
    });

    if (matchedCell) {
      return matchedCell.id;
    }
  }

  return exactId;
}

interface GameState {
  prevDayPx: Record<string, number | null>;
  setPrevDayPx: (ticker: string, price: number | null) => void;
  stacks: Record<string, CoinStack>;
  addPendingCoin: (cellId: string, ticker: string, coin: Coin) => void;
  expirePendingCoins: (nowMs: number) => void;
  ticker: Ticker;
  feedStale: Record<string, boolean>;
  balance: number;
  serverBalance: number;
  currentPrice: number;
  history: PricePoint[];
  cells: CellData[];
  basePrice: number;
  nextSessionTime: number;
  modeIntervalSeconds: number;
  modePriceStep: number;
  priceStepByTicker: Record<string, number>;
  priceByTicker: Record<string, number>;
  historyByTicker: Record<string, PricePoint[]>;
  basePriceByTicker: Record<string, number>;
  bets: Record<string, number>;
  betRates: Record<string, number>;
  pendingBets: Record<string, number>;
  pendingWins: Record<string, number>;
  socket: Socket | null;
  wssKey: string | null;
  betAmount: number;
  serverTimeOffset: number; // diff between server ts and local Date.now()
  lastRejectMessage: string | null;

  setTicker: (ticker: Ticker) => void;
  setFeedStale: (ticker: Ticker | string, stale: boolean) => void;
  setConnection: (socket: Socket | null, wssKey: string | null) => void;
  updatePrice: (
    price: number | string,
    serverTs?: number,
    ticker?: Ticker | string,
  ) => void;
  syncServerTime: (serverTs: number) => void;
  placeBet: (cellId: string, amount: number) => void;
  ensureCells: () => void;
  tickTime: () => void;
  updateGrid: (payload: GridUpdatePayload | RemoteCell[]) => void;
  updateBalance: (balance: number) => void;
  setBetAmount: (amount: number) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setOpenBets: (orders: any[]) => void;
  updateOrder: (data: OrderUpdatePayload) => string | undefined;
  checkWinEffects: (now: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  prevDayPx: {},
  setPrevDayPx: (ticker, price) => set(state => ({prevDayPx: {...state.prevDayPx, [ticker]: price}})),
  stacks: {},
  addPendingCoin: (cellId, ticker, coin) => set(state => ({ stacks: addPendingCoin(state.stacks, cellId, ticker, coin) })),
  expirePendingCoins: (nowMs) => set(state => { const stacks = expirePending(state.stacks, nowMs); return stacks === state.stacks ? state : { stacks }; }),
  ticker: "NVDA",
  feedStale: initialFeedStale,
  balance: 0,
  serverBalance: 0,
  currentPrice: 0,
  history: [], // Keep track of the line chart
  cells: [],
  basePrice: 0, // Anchor point for the grid
  nextSessionTime: Date.now() + 60000,
  modeIntervalSeconds: 5,
  modePriceStep: 0.03,
  priceStepByTicker: { ...PRICE_STEP_BY_TICKER },
  priceByTicker: {},
  historyByTicker: {},
  basePriceByTicker: {},
  bets: {},
  betRates: {},
  pendingBets: {},
  pendingWins: {},
  socket: null,
  wssKey: null,
  betAmount: 5,
  serverTimeOffset: 0,
  lastRejectMessage: null,

  setTicker: (ticker) =>
    set((state) => ({
      ticker,
      modePriceStep: state.priceStepByTicker[ticker] ?? state.modePriceStep,
      currentPrice: state.priceByTicker[ticker] ?? 0,
      history: state.historyByTicker[ticker] ?? [],
      basePrice: state.basePriceByTicker[ticker] ?? 0,
    })),

  setFeedStale: (ticker, stale) =>
    set((state) => ({
      feedStale: {
        ...state.feedStale,
        [ticker]: stale,
      },
    })),

  setConnection: (socket, wssKey) => set({ socket, wssKey }),

  updateBalance: (balance) =>
    set((state) => {
      const pendingWinsTotal = Object.values(state.pendingWins).reduce(
        (a, b) => a + b,
        0,
      );
      // Derive the display balance by subtracting pending wins that haven't been shown yet
      return {
        serverBalance: balance,
        balance: balance - pendingWinsTotal,
      };
    }),

  syncServerTime: (serverTs) =>
    set(() => ({
      serverTimeOffset: serverTs - Date.now(),
    })),

  setBetAmount: (amount) => set({ betAmount: amount }),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setOpenBets: (orders: any[]) =>
    set((state) => {
      const newBets = { ...state.bets };
      const newBetRates = { ...state.betRates };
      for (const order of orders) {
        if (order.status === "OPEN") {
          const ticker = order.ticker || order.cell?.ticker || order.marketId;
          const start =
            order.cellTimeStart || order.cell?.startTs || order.startTs;
          const end = order.cellTimeEnd || order.cell?.endTs || order.endTs;
          const lower = order.lowerPrice || order.cell?.lowerPrice;
          const upper = order.upperPrice || order.cell?.upperPrice;
          const cellId = buildCellId(ticker, start, end, lower, upper);
          newBets[cellId] = Number(order.amount) || 0;

          const rate = order.rewardRate || order.cell?.rewardRate;
          if (rate) {
            newBetRates[cellId] = parseFloat(rate);
          }
        }
      }
      return { bets: newBets, betRates: newBetRates, stacks: stacksFromOpenOrders(orders) };
    }),

  updateOrder: (data: OrderUpdatePayload) => {
    let rejectedMessage: string | undefined;

    set((state) => {
      const stacks = applyOrderUpdate(state.stacks, data);
      const stackOrder = !!data.clientTapId || !!data.orderId;
      if (stackOrder) {
        if (data.status === "REJECTED") {
          rejectedMessage = rejectMessage(data.reason);
          toast.error(rejectedMessage);
          return {...state, stacks, lastRejectMessage: rejectedMessage};
        }
        return {...state, stacks};
      }
      let newState = { ...state, stacks };
      let cellId = resolveOrderCellId(data, newState);

      if (data.status === "REJECTED") {
        const newPendingBets = { ...newState.pendingBets };
        const refundedStake = newPendingBets[cellId] ?? 0;
        delete newPendingBets[cellId];

        const message = rejectMessage(data.reason);
        rejectedMessage = message;

        toast.error(message, {
          style: {
            background: "#252422",
            color: "#f6465d",
            border: "1px solid rgba(246, 70, 93, 0.5)",
          },
        });

        return {
          ...newState,
          pendingBets: newPendingBets,
          serverBalance: newState.serverBalance + refundedStake,
          balance: newState.balance + refundedStake,
          lastRejectMessage: message,
        };
      }

      if (data.status === "VOIDED") {
        const newPendingBets = { ...newState.pendingBets };
        const pendingStake = newPendingBets[cellId] ?? 0;
        delete newPendingBets[cellId];

        const newPendingWins = { ...newState.pendingWins };
        delete newPendingWins[cellId];

        const existingBet =
          newState.bets[cellId] ??
          (pendingStake > 0 ? pendingStake : Number(data.amount) || 0);
        const newBets =
          existingBet > 0
            ? { ...newState.bets, [cellId]: existingBet }
            : newState.bets;

        return {
          ...newState,
          pendingBets: newPendingBets,
          pendingWins: newPendingWins,
          bets: newBets,
          cells: newState.cells.map((c) =>
            c.id === cellId ? { ...c, status: "voided" as const } : c,
          ),
          balance:
            newState.serverBalance -
            Object.values(newPendingWins).reduce((a, b) => a + b, 0),
        };
      }

      if (data.status === "OPEN") {
        const pendingAmount = newState.pendingBets[cellId] ?? 0;
        const newPendingBets = { ...newState.pendingBets };
        delete newPendingBets[cellId];

        const confirmedAmount = Number(data.amount) || pendingAmount || 0;

        const newBetRates = { ...newState.betRates };
        const rewardRate = data.rewardRate || data.cell?.rewardRate;
        if (rewardRate) {
          newBetRates[cellId] = parseFloat(rewardRate);
        }

        newState = {
          ...newState,
          pendingBets: newPendingBets,
          bets: { ...newState.bets, [cellId]: confirmedAmount },
          betRates: newBetRates,
        };
      }

      const rewardRate = data.rewardRate || data.cell?.rewardRate;
      if (rewardRate) {
        newState = {
          ...newState,
          cells: newState.cells.map((c) =>
            c.id === cellId
              ? {
                  ...c,
                  multiplier: parseFloat(rewardRate),
                  original: { ...c.original, rewardRate },
                }
              : c,
          ),
        };
      }

      const isWin =
        data.settledWin === true ||
        String(data.settledWin) === "true" ||
        data.status === "WIN";

      if (isWin) {
        let cell = newState.cells.find((c) => c.id === cellId);
        // Failsafe approximate match in case price float precision caused ID mismatch
        const start = data.cellTimeStart || data.cell?.startTs || data.startTs;
        const end = data.cellTimeEnd || data.cell?.endTs || data.endTs;
        if (!cell && start && end) {
          cell = newState.cells.find(
            (c) =>
              c.timeWindowStart === Number(start) &&
              c.timeWindowEnd === Number(end) &&
              (newState.bets[c.id] || newState.pendingBets[c.id]),
          );
          if (cell) cellId = cell.id;
        }

        if (cell && cell.status !== "hit") {
          const betAmount =
            newState.bets[cellId] ||
            newState.pendingBets[cellId] ||
            Number(data.amount) ||
            10; // Failsafe fallback to persist

          const mult =
            cell.multiplier && !isNaN(cell.multiplier) ? cell.multiplier : 0;
          const win = betAmount * mult;

          const newPendingBets = { ...newState.pendingBets };
          delete newPendingBets[cellId];

          const newPendingWins = { ...newState.pendingWins, [cellId]: win };
          newState = {
            ...newState,
            pendingBets: newPendingBets,
            bets: { ...newState.bets, [cellId]: betAmount }, // Persist the bet so hasAnyBet is true
            pendingWins: newPendingWins,
            balance:
              newState.serverBalance -
              Object.values(newPendingWins).reduce((a, b) => a + b, 0),
          };
        }
        return newState;
      }

      const isLoss =
        (data.status === "SETTLED" && !isWin) ||
        data.status === "LOSS" ||
        data.status === "LOST" ||
        data.status === "MISSED";

      if (isLoss) {
        const newPendingBets = { ...newState.pendingBets };
        delete newPendingBets[cellId];

        newState = {
          ...newState,
          pendingBets: newPendingBets,
          cells: newState.cells.map((c) =>
            c.id === cellId && c.status !== "hit" && c.status !== "voided"
              ? { ...c, status: "miss" as const }
              : c,
          ),
        };
      }

      return newState;
    });

    return rejectedMessage;
  },

  checkWinEffects: (now: number) =>
    set((state) => {
      let changed = false;
      const newState = { ...state };
      const newPendingWins = { ...state.pendingWins };
      const cellsById = new Map(state.cells.map((cell) => [cell.id, cell]));
      const hitCellIds = new Set<string>();

      for (const [cellId, winAmount] of Object.entries(state.pendingWins)) {
        const cell = cellsById.get(cellId);

        // Cleanup if cell is gone
        if (!cell) {
          delete newPendingWins[cellId];
          changed = true;
          continue;
        }

        // Must have a confirmed bet on this cell
        const hasBet =
          (newState.bets[cellId] ?? 0) > 0 ||
          (newState.pendingBets[cellId] ?? 0) > 0;
        if (!hasBet) {
          // No bet recorded yet — wait (don't remove from pendingWins)
          continue;
        }

        // Calculate physical grid bounds to ensure chart physically touched it
        const lowerPrice =
          cell.original.lowerPrice !== undefined
            ? parseFloat(cell.original.lowerPrice)
            : cell.priceLevel - newState.modePriceStep / 2;
        const upperPrice =
          cell.original.upperPrice !== undefined
            ? parseFloat(cell.original.upperPrice)
            : cell.priceLevel + newState.modePriceStep / 2;

        const isTimeInside =
          now >= cell.timeWindowStart && now <= cell.timeWindowEnd;
        const isTimePassed = now > cell.timeWindowEnd;
        const isPriceInside =
          newState.currentPrice >= lowerPrice &&
          newState.currentPrice <= upperPrice;

        const isTouching = isTimeInside && isPriceInside;

        // Trigger win effect exactly when chart line physically touches the cell, or if the time has passed as fallback
        if (cell.status !== "hit" && (isTouching || isTimePassed)) {
          if (winAmount > 0) {
            toast.success(`You won $${winAmount.toFixed(2)}! 🚀`, {
              style: {
                background: "#252422",
                color: "#2EBD85",
                border: "1px solid rgba(46, 189, 133, 0.5)",
                boxShadow: "0 0 15px rgba(46, 189, 133, 0.3)",
              },
              iconTheme: {
                primary: "#2EBD85",
                secondary: "#252422",
              },
              position: "top-center",
            });
          }

          hitCellIds.add(cellId);
          delete newPendingWins[cellId];
          changed = true;
        }
      }

      if (changed) {
        if (hitCellIds.size > 0) {
          newState.cells = state.cells.map((cell) =>
            hitCellIds.has(cell.id)
              ? { ...cell, status: "hit" as const }
              : cell,
          );
        }
        newState.pendingWins = newPendingWins;
        newState.balance =
          newState.serverBalance -
          Object.values(newPendingWins).reduce((a, b) => a + b, 0);
        return newState;
      }
      return state;
    }),

  updatePrice: (price, serverTs, ticker) =>
    set((state) => {
      const numericPrice =
        typeof price === "number" ? price : parseFloat(price);
      if (!Number.isFinite(numericPrice)) return state;

      const targetTicker = ticker ?? state.ticker;
      const now = Date.now();
      let newOffset = state.serverTimeOffset;

      if (serverTs && state.serverTimeOffset === 0) {
        newOffset = serverTs - now;
      }
      const syncedNow = now + newOffset;

      const existingHistory = state.historyByTicker[targetTicker] ?? [];
      const newTickerHistory = [
        ...existingHistory,
        { time: syncedNow, price: numericPrice },
      ].filter((p) => syncedNow - p.time <= 120000);

      const nextPriceByTicker = {
        ...state.priceByTicker,
        [targetTicker]: numericPrice,
      };
      const nextHistoryByTicker = {
        ...state.historyByTicker,
        [targetTicker]: newTickerHistory,
      };

      if (targetTicker === state.ticker) {
        return {
          currentPrice: numericPrice,
          history: newTickerHistory,
          serverTimeOffset: newOffset,
          priceByTicker: nextPriceByTicker,
          historyByTicker: nextHistoryByTicker,
        };
      }

      return {
        serverTimeOffset: newOffset,
        priceByTicker: nextPriceByTicker,
        historyByTicker: nextHistoryByTicker,
      };
    }),

  placeBet: (cellId, amount) =>
    set((state) => {
      if (state.bets[cellId] || state.pendingBets[cellId]) {
        // Already bet on this cell
        return state;
      }
      if (state.balance >= amount) {
        return {
          serverBalance: state.serverBalance - amount,
          balance: state.balance - amount,
          pendingBets: { ...state.pendingBets, [cellId]: amount },
        };
      }

      toast.error("Insufficient balance!", {
        style: {
          background: "#252422",
          color: "#d57455",
          border: "1px solid rgba(213, 116, 85, 0.5)",
        },
      });
      return state;
    }),

  ensureCells: () => {
    // No API for old chart data, wait for socket to populate history
  },

  updateGrid: (payload) =>
    set((state) => {
      const incomingCells = Array.isArray(payload)
        ? payload
        : (payload.cells ?? []);
      const payloadTicker = Array.isArray(payload)
        ? incomingCells[0]?.ticker
        : payload.ticker;
      const payloadGridTs = Array.isArray(payload)
        ? incomingCells[0]?.gridTs
        : (payload.gridTs ?? incomingCells[0]?.gridTs);
      const rawStep = Array.isArray(payload) ? undefined : payload.priceStep;
      const parsedStep =
        rawStep !== undefined ? Number(rawStep) : Number.NaN;

      const newOffset =
        payloadGridTs !== undefined
          ? payloadGridTs - Date.now()
          : state.serverTimeOffset;
      const now = Date.now() + newOffset;

      const nextPriceStepByTicker = { ...state.priceStepByTicker };
      if (payloadTicker && Number.isFinite(parsedStep) && parsedStep > 0) {
        nextPriceStepByTicker[payloadTicker] = parsedStep;
      }

      const nextBasePriceByTicker = { ...state.basePriceByTicker };
      if (payloadTicker && incomingCells.length > 0) {
        const anchor = parseFloat(incomingCells[0].lowerPrice);
        if (Number.isFinite(anchor)) {
          nextBasePriceByTicker[payloadTicker] = anchor;
        }
      }

      const combinedCells = [...state.cells];

      for (const remoteCell of incomingCells) {
        const id = buildCellId(
          remoteCell.ticker,
          remoteCell.startTs,
          remoteCell.endTs,
          remoteCell.lowerPrice,
          remoteCell.upperPrice,
        );
        const timeWindowStart = remoteCell.startTs;
        const timeWindowEnd = remoteCell.endTs;
        const priceLevel =
          (parseFloat(remoteCell.lowerPrice) +
            parseFloat(remoteCell.upperPrice)) /
          2;

        const hasBet =
          (state.bets[id] && state.bets[id] > 0) ||
          (state.pendingBets[id] && state.pendingBets[id] > 0);
        const existingIdx = combinedCells.findIndex((c) => c.id === id);

        let finalMultiplier = parseFloat(remoteCell.rewardRate);
        if (hasBet) {
          if (state.betRates[id] !== undefined) {
            finalMultiplier = state.betRates[id];
          } else if (existingIdx !== -1) {
            finalMultiplier = combinedCells[existingIdx].multiplier;
          }
        }


        if (existingIdx === -1) {
          combinedCells.push({
            id,
            timeWindowStart,
            timeWindowEnd,
            priceLevel,
            multiplier: finalMultiplier,
            status: timeWindowEnd < now ? "past" : "active",
            original: remoteCell,
          });
        } else {
          // Update the multiplier rate since it fluctuates based on bets
          // If the user has bet on this cell, keep the original rate.
          combinedCells[existingIdx] = {
            ...combinedCells[existingIdx],
            multiplier: finalMultiplier,
            priceLevel, // Ensure price bounds sync
            original: remoteCell,
          };
        }
      }

      // The quote stream removes a cell when it locks. Keep its last quote so
      // its window and coins remain visible as the line enters and passes it.
      // Canvas culls at the left edge; the store retains a bounded 60 s history.
      const finalCells = combinedCells.filter(c => c.timeWindowEnd > now - 60000);

      const isActiveTicker = !payloadTicker || payloadTicker === state.ticker;
      return {
        cells: finalCells,
        serverTimeOffset: newOffset,
        priceStepByTicker: nextPriceStepByTicker,
        basePriceByTicker: nextBasePriceByTicker,
        modePriceStep:
          isActiveTicker && payloadTicker
            ? (nextPriceStepByTicker[payloadTicker] ?? state.modePriceStep)
            : state.modePriceStep,
        basePrice:
          isActiveTicker && payloadTicker
            ? (nextBasePriceByTicker[payloadTicker] ?? state.basePrice)
            : state.basePrice,
      };
    }),

  tickTime: () =>
    set((state) => {
      const now = Date.now() + state.serverTimeOffset;
      const cutoff = now - 60000;

      // Filter out very old cells (older than 60s)
      let cells = state.cells.filter((c) => c.timeWindowEnd > cutoff);

      cells = cells.map((cell) => {
        if (cell.status === "active" && now > cell.timeWindowEnd) {
          return { ...cell, status: "past" as const };
        }
        return cell;
      });

      // Cleanup old bets, pendingBets, and betRates to avoid memory leaks
      const validCellIds = new Set(cells.map((c) => c.id));
      const cleanDict = (dict: Record<string, number>) => {
        let changed = false;
        const result: Record<string, number> = {};
        for (const [key, value] of Object.entries(dict)) {
          if (validCellIds.has(key)) {
            result[key] = value;
          } else {
            changed = true;
          }
        }
        return changed ? result : dict;
      };

      return {
        cells,
        bets: cleanDict(state.bets),
        pendingBets: cleanDict(state.pendingBets),
        betRates: cleanDict(state.betRates),
        pendingWins: cleanDict(state.pendingWins),
      };
    }),
}));

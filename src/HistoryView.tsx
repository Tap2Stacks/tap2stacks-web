import React from "react";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, ScrollText, ShieldCheck } from "lucide-react";
import { AssetLogo } from "./components/AssetLogo";
import { THEME } from "./ui/theme";
import {
  cn, formatDate, formatMoney, getOrderProofKeys, isOrderSettled,
  isOrderStillAnchoring, isVoidedOrder, resolveOrderId, shortHash,
} from "./pages/historyUtils";
import { useHistory } from "./pages/useHistory";
import { HistoryProofDialog } from "./pages/HistoryProofDialog";

const ACCENT = THEME.ink;
const BORDER = THEME.ink;
const PANEL_BG = THEME.paper;
const TILE_BG = THEME.paper;
const SOFT_TEXT = THEME.ink;

export const HistoryView: React.FC = () => {
  const state = useHistory();
  const { orders, loading, page, setPage, proofButtonLoadingOrderId, pendingProofByOrderId,
    fetchHistory, openProof, stats, hasNextPage } = state;
  return (
    <>
      <div className="relative mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-4 px-3 py-4 sm:px-6 lg:px-10 lg:py-7">

        <section className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full border"
              style={{
                borderColor: THEME.ink,
                background: THEME.paper,
              }}
            >
              <ScrollText size={18} style={{ color: ACCENT }} />
            </div>
            <div>
              <h1 className="text-[1.72rem] font-bold tracking-[-0.03em] text-ink">
                Execution Journal
              </h1>
              <p className="text-xs text-ink/70">
                Filled, settled, and pending orders in one stream
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-ink/70">
            <span
              className="rounded-md border px-2.5 py-1.5"
              style={{
                borderColor: BORDER,
                background: THEME.paper,
              }}
            >
              Page {page + 1}
            </span>
            <button
              type="button"
              onClick={() => fetchHistory(page)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-ink transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                borderColor: BORDER,
                background: THEME.paper,
              }}
            >
              <RefreshCw size={12} className={cn(loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[290px_1fr]">
          <aside
            className="rounded-xl p-5"
            style={{
              background: PANEL_BG,
              border: `1.5px solid ${BORDER}`,
              boxShadow: `0 2px 0 ${THEME.ink}`,
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/65">
              Snapshot
            </p>

            <div className="mt-4 space-y-2.5">
              {[
                { label: "Orders", value: stats.total.toString() },
                { label: "Settled", value: stats.settled.toString() },
                { label: "Win rate", value: stats.winRate },
                { label: "Pending", value: stats.pending.toString() },
                { label: "Volume", value: stats.volume },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-xl px-3.5 py-3"
                  style={{
                    border: `1.5px solid ${BORDER}`,
                    background: TILE_BG,
                  }}
                >
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink">
                    {item.label}
                  </p>
                  <p className="text-sm font-semibold text-ink">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-ink/20 pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/65">
                Pagination
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={page === 0 || loading}
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    border: `1.5px solid ${BORDER}`,
                    background: THEME.paper,
                    color: SOFT_TEXT,
                  }}
                >
                  <ChevronLeft size={13} />
                  Prev
                </button>
                <button
                  type="button"
                  disabled={!hasNextPage || loading}
                  onClick={() => setPage((value) => value + 1)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink transition disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    background: THEME.highlight,
                    boxShadow: `0 2px 0 ${THEME.ink}`,
                  }}
                >
                  Next
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </aside>

          <div
            className="min-w-0 overflow-hidden rounded-xl"
            style={{
              background: PANEL_BG,
              border: `1.5px solid ${BORDER}`,
              boxShadow: `0 2px 0 ${THEME.ink}`,
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: `1.5px solid ${BORDER}` }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/65">
                Order Stream
              </p>
              <p className="text-xs uppercase tracking-[0.16em] text-ink">
                {loading ? "Loading" : `${orders.length} rows`}
              </p>
            </div>

            {loading ? (
              <div className="flex min-h-[440px] flex-col items-center justify-center gap-4 text-ink">
                <Loader2
                  className="h-8 w-8 animate-spin"
                  style={{ color: ACCENT }}
                />
                <p className="text-sm uppercase tracking-[0.18em]">
                  Loading order history
                </p>
              </div>
            ) : orders.length === 0 ? (
              <div className="flex min-h-[440px] items-center justify-center px-6">
                <div
                  className="w-full max-w-md rounded-xl px-6 py-7 text-center"
                  style={{
                    border: `1.5px solid ${BORDER}`,
                    background: TILE_BG,
                  }}
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink">
                    No activity yet
                  </p>
                  <p className="mt-3 text-sm text-ink">
                    No order history found for this wallet session.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-x-auto p-3 sm:p-4">
                {orders.map((order, index) => {
                  const orderId = resolveOrderId(order);
                  const orderProofKeys = getOrderProofKeys(order);
                  const isSettledOrder = isOrderSettled(order);
                  const isButtonLoading =
                    !!orderId && proofButtonLoadingOrderId === orderId;
                  const hasPendingProofFromError = orderProofKeys.some((key) =>
                    Boolean(pendingProofByOrderId[key]),
                  );
                  const isProofPending =
                    isSettledOrder &&
                    (isOrderStillAnchoring(order) || hasPendingProofFromError);
                  const voided = isVoidedOrder(order);
                  const statusVariant = voided
                    ? {
                        label: "Voided · Refunded",
                        background: THEME.paper,
                        color: THEME.ink,
                      }
                    : order.settledWin === true
                      ? {
                          label: "Win",
                          background: THEME.yellow,
                          color: THEME.win,
                        }
                      : order.settledWin === false
                        ? {
                            label: "Lose",
                            background: THEME.pink,
                            color: THEME.loss,
                          }
                        : {
                            label: "Pending",
                            background: THEME.paper,
                            color: THEME.ink,
                          };

                  return (
                    <article
                      key={`${orderId ?? "order"}-${order.createdAt ?? index}`}
                      className="rounded-xl px-4 py-3.5 transition hover:border-ink"
                      style={{
                        border: `1.5px solid ${BORDER}`,
                        background: index % 2 === 0 ? TILE_BG : THEME.yellow,
                      }}
                    >
                      <div className="grid gap-3 md:grid-cols-[1.55fr_0.82fr_0.8fr_0.95fr_auto_auto] md:items-center">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.16em] text-ink/65">
                            Settled Date
                          </p>
                          <p className="mt-1 text-sm text-ink">
                            {formatDate(order.settledAt || order.createdAt)}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-ink">
                            Order ID: {shortHash(orderId, 10, 10)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.16em] text-ink/65">
                            Market
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <AssetLogo symbol={order.marketId || "BTCUSDT"} size={16} />
                            <p className="text-sm font-semibold text-ink">
                              {order.marketId || "BTCUSDT"}
                            </p>
                          </div>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.16em] text-ink/65">
                            Reward
                          </p>
                          <p className="mt-1 font-mono text-sm text-ink">
                            {order.rewardRate
                              ? `${Number(order.rewardRate).toFixed(3)}x`
                              : "-"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.16em] text-ink/65">
                            Amount
                          </p>
                          <p
                            className="mt-1 text-sm font-semibold"
                            style={{ color: THEME.ink }}
                          >
                            {formatMoney(order.amount)}
                          </p>
                        </div>

                        <div className="md:justify-self-end">
                          <span
                            className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                            style={{
                              background: statusVariant.background,
                              color: statusVariant.color,
                              border: `1.5px solid ${THEME.ink}`,
                            }}
                          >
                            {statusVariant.label}
                          </span>
                        </div>

                        <div className="md:justify-self-end">
                          {isSettledOrder ? (
                            <button
                              type="button"
                              onClick={() => openProof(order)}
                              disabled={
                                !orderId || isButtonLoading || isProofPending
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                              style={{
                                borderColor: THEME.ink,
                                background: THEME.yellow,
                              }}
                            >
                              {isButtonLoading || isProofPending ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <ShieldCheck size={12} />
                              )}
                              {isButtonLoading
                                ? "Checking"
                                : isProofPending
                                  ? "Anchoring"
                                  : "Proof"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <HistoryProofDialog state={state} />
    </>
  );
};

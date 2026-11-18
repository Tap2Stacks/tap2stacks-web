import React from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { BACKEND_URL } from "./constant";
import {
  cn, formatTimeRange, resolveProofAnchorAddress, shortHash, type ProofBatch,
} from "./pages/historyUtils";
import { useProofs } from "./pages/useProofs";
import { THEME } from "./ui/theme";
import { getExplorerAddressUrl, getExplorerTxUrl } from "./utils/chain";

function BatchRow({ batch, alt }: { batch: ProofBatch; alt: boolean }) {
  return (
    <article
      className="rounded-xl px-4 py-3.5"
      style={{
        border: `1.5px solid ${THEME.ink}`,
        background: alt ? THEME.yellow : THEME.paper,
      }}
    >
      <div className="grid gap-3 md:grid-cols-[0.8fr_1.4fr_1fr_auto_auto] md:items-center">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink/65">Batch</p>
          <p className="mt-1 font-mono text-sm font-bold text-ink">Batch #{batch.index}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink/65">Window</p>
          <p className="mt-1 text-xs text-ink">{formatTimeRange(batch.fromMs, batch.toMs)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink/65">Root / Price Hash</p>
          <p className="mt-1 font-mono text-xs text-ink/80">
            {shortHash(batch.tapsRoot)} / {shortHash(batch.priceLogHash)}
          </p>
        </div>
        <a
          href={`${BACKEND_URL}/api/proofs/${batch.index}/price-log`}
          download={`batch-${batch.index}-prices.ndjson`}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink"
          style={{ borderColor: THEME.ink, background: THEME.paper }}
        >
          <Download size={12} />
          Download price log
        </a>
        <a
          href={getExplorerTxUrl(batch.txHash)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink"
          style={{
            border: `1.5px solid ${THEME.ink}`,
            background: THEME.highlight,
            boxShadow: `0 2px 0 ${THEME.ink}`,
          }}
        >
          Basescan
          <ExternalLink size={12} />
        </a>
      </div>
    </article>
  );
}

export const ProofsView: React.FC = () => {
  const { batches, loading, page, setPage, hasNextPage, refresh } = useProofs();
  const anchorAddress = resolveProofAnchorAddress();

  return (
    <div className="relative mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-4 px-3 py-4 sm:px-6 lg:px-10 lg:py-7">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full border"
            style={{ borderColor: THEME.ink, background: THEME.paper }}
          >
            <ShieldCheck size={18} style={{ color: THEME.ink }} />
          </div>
          <div>
            <h1 className="text-[1.72rem] font-bold tracking-[-0.03em] text-ink">Proofs</h1>
            <p className="text-xs text-ink/70">Anchored settlement batches and price logs on Base Sepolia</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink/70">
          {anchorAddress ? (
            <a
              href={getExplorerAddressUrl(anchorAddress)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-ink"
              style={{ borderColor: THEME.ink, background: THEME.yellow }}
            >
              ProofAnchor
              <ExternalLink size={12} />
            </a>
          ) : null}
          <span className="rounded-md border px-2.5 py-1.5" style={{ borderColor: THEME.ink, background: THEME.paper }}>
            Page {page + 1}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-ink disabled:opacity-50"
            style={{ borderColor: THEME.ink, background: THEME.paper }}
          >
            <RefreshCw size={12} className={cn(loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </section>

      <section
        className="min-w-0 overflow-hidden rounded-xl"
        style={{ background: THEME.paper, border: `1.5px solid ${THEME.ink}`, boxShadow: `0 2px 0 ${THEME.ink}` }}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1.5px solid ${THEME.ink}` }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/65">Anchored Batches</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold uppercase disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: THEME.ink, background: THEME.paper }}
            >
              <ChevronLeft size={12} />
              Prev
            </button>
            <button
              type="button"
              disabled={!hasNextPage || loading}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase disabled:cursor-not-allowed disabled:opacity-40"
              style={{ border: `1.5px solid ${THEME.ink}`, background: THEME.highlight }}
            >
              Next
              <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-ink">
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: THEME.ink }} />
            <p className="text-xs uppercase tracking-[0.18em]">Loading anchored batches</p>
          </div>
        ) : batches.length === 0 ? (
          <div className="flex min-h-[260px] items-center justify-center p-8 text-center">
            <div className="max-w-md space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink">No batches yet</p>
              <p className="text-xs text-ink/70">Batch price logs and tap Merkle proofs will appear here once anchored.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 overflow-x-auto p-3 sm:p-4">
            {batches.map((batch, i) => (
              <BatchRow key={batch.index} batch={batch} alt={i % 2 === 1} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

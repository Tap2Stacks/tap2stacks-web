import { Dialog, DialogPanel } from "@headlessui/react";
import { CheckCircle2, ExternalLink, Loader2, X, XCircle } from "lucide-react";
import { BACKEND_URL } from "../constant";
import { THEME } from "../ui/theme";
import { getExplorerAddressUrl, getExplorerTxUrl } from "../utils/chain";
import {
  formatTimeRange,
  resolveProofAnchorAddress,
  shortHash,
  type OrderProof,
} from "./historyUtils";
import type { useHistory } from "./useHistory";

type HistoryState = ReturnType<typeof useHistory>;

function statusBadgeFor(status: OrderProof["tap"]["status"]) {
  if (status === "WON") {
    return { label: "Won", background: THEME.yellow, color: THEME.win };
  }
  if (status === "LOST") {
    return { label: "Lost", background: THEME.pink, color: THEME.loss };
  }
  return { label: "Voided", background: THEME.paper, color: THEME.ink };
}

function VerificationRow({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5"
      style={{ border: `1.5px solid ${THEME.ink}`, background: THEME.paper }}
    >
      <span className="inline-flex items-center gap-2 text-xs text-ink">
        {passed ? (
          <CheckCircle2 size={15} style={{ color: THEME.win }} />
        ) : (
          <XCircle size={15} style={{ color: THEME.loss }} />
        )}
        {label}
      </span>
      <span
        className="text-[11px] font-bold uppercase"
        style={{ color: passed ? THEME.win : THEME.loss }}
      >
        {passed ? "Verified" : "Failed"}
      </span>
    </div>
  );
}

function ProofDetails({ proofData }: { proofData: OrderProof }) {
  const badge = statusBadgeFor(proofData.tap.status);
  const anchorAddress = resolveProofAnchorAddress();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{
            background: badge.background,
            color: badge.color,
            border: `1.5px solid ${THEME.ink}`,
          }}
        >
          {badge.label}
        </span>
        <span className="font-mono text-xs text-ink">
          Batch #{proofData.batch.index}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div
          className="rounded-xl px-3.5 py-3"
          style={{ border: `1.5px solid ${THEME.ink}`, background: THEME.paper }}
        >
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink/65">
            Batch Time Range
          </p>
          <p className="mt-1 text-xs text-ink">
            {formatTimeRange(proofData.batch.fromMs, proofData.batch.toMs)}
          </p>
        </div>
        <div
          className="rounded-xl px-3.5 py-3"
          style={{ border: `1.5px solid ${THEME.ink}`, background: THEME.paper }}
        >
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink/65">
            Leaf / Root
          </p>
          <p className="mt-1 font-mono text-xs text-ink/80">
            {shortHash(proofData.tap.leafHash)} /{" "}
            {shortHash(proofData.batch.tapsRoot)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <VerificationRow
          label="Merkle proof matches the anchored root"
          passed={proofData.merkleVerified}
        />
        <VerificationRow
          label="Price log matches the anchored hash"
          passed={proofData.priceLogVerified}
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {anchorAddress ? (
          <a
            href={getExplorerAddressUrl(anchorAddress)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink/20 bg-paper px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink"
          >
            ProofAnchor
            <ExternalLink size={12} />
          </a>
        ) : null}
        <a
          href={`${BACKEND_URL}/api/proofs/${proofData.batch.index}/price-log`}
          download={`batch-${proofData.batch.index}-prices.ndjson`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink/20 bg-yellow px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink"
        >
          Download price log
        </a>
        {proofData.batch.txHash ? (
          <a
            href={getExplorerTxUrl(proofData.batch.txHash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink"
            style={{
              background: THEME.highlight,
              boxShadow: `0 2px 0 ${THEME.ink}`,
            }}
          >
            View on Basescan
            <ExternalLink size={12} />
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function HistoryProofDialog({ state }: { state: HistoryState }) {
  const { isProofOpen, closeProof, selectedOrderId, proofLoading, proofError, proofData } =
    state;
  return (
    <Dialog open={isProofOpen} onClose={closeProof} className="relative z-50">
      <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm" aria-hidden />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="relative w-full max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-ink/20 bg-paper shadow-xl lg:max-w-3xl">
          <button
            type="button"
            onClick={closeProof}
            className="absolute right-3 top-3 rounded-lg p-1.5 text-ink transition hover:bg-yellow"
          >
            <X size={16} />
          </button>

          <div className="border-b border-ink/20 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/65">
              Base Settlement Proof
            </p>
            <h3 className="mt-2 text-xl font-bold text-ink">
              {selectedOrderId
                ? `Order ${shortHash(selectedOrderId, 12, 12)}`
                : "Order proof"}
            </h3>
          </div>

          <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
            {proofLoading ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-ink">
                <Loader2 className="h-7 w-7 animate-spin" style={{ color: THEME.ink }} />
                <p className="text-sm uppercase tracking-[0.16em]">
                  Verifying proof
                </p>
              </div>
            ) : proofError ? (
              <div
                className="rounded-xl px-4 py-4 text-sm"
                style={{
                  border: `1.5px solid ${THEME.ink}`,
                  background: THEME.yellow,
                  color: THEME.ink,
                }}
              >
                {proofError}
              </div>
            ) : proofData ? (
              <ProofDetails proofData={proofData} />
            ) : (
              <div className="text-sm text-ink">No proof loaded.</div>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

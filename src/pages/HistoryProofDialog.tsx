import { Dialog, DialogPanel } from "@headlessui/react";
import { ExternalLink, Loader2, X } from "lucide-react";
import { THEME } from "../ui/theme";
import { getExplorerTxUrl } from "../utils/chain";
import { formatAnchorTime, shortHash } from "./historyUtils";
import type { useHistory } from "./useHistory";

const ACCENT = THEME.ink;
const BORDER = THEME.ink;
const TILE_BG = THEME.paper;

type HistoryState = ReturnType<typeof useHistory>;
export function HistoryProofDialog({ state }: { state: HistoryState }) {
  const { isProofOpen, closeProof, selectedOrderId, proofLoading, proofError,
    proofData, proofSearchHref, proofTxHash } = state;
  return (
      <Dialog open={isProofOpen} onClose={closeProof} className="relative z-50">
        <div
          className="fixed inset-0 bg-ink/50 backdrop-blur-sm"
          aria-hidden
        />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-ink/20 bg-paper shadow-xl">
            <button
              type="button"
              onClick={closeProof}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-ink transition hover:bg-yellow hover:text-ink"
            >
              <X size={16} />
            </button>

            <div className="border-b border-ink/20 px-5 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/65">
                HCS Merkle Proof
              </p>
              <h3 className="mt-2 text-xl font-bold text-ink">
                {selectedOrderId
                  ? `Order ${shortHash(selectedOrderId, 12, 12)}`
                  : "Order proof"}
              </h3>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
              {proofLoading ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-ink">
                  <Loader2
                    className="h-7 w-7 animate-spin"
                    style={{ color: ACCENT }}
                  />
                  <p className="text-sm uppercase tracking-[0.16em]">
                    Loading merkle proof
                  </p>
                </div>
              ) : proofError ? (
                <div
                  className="rounded-xl px-4 py-4 text-sm"
                  style={{
                    border: `1.5px solid ${THEME.loss}`,
                    background: THEME.paper,
                    color: THEME.loss,
                  }}
                >
                  {proofError}
                </div>
              ) : proofData ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
                      style={{
                        background: proofData.verified
                          ? THEME.yellow
                          : THEME.pink,
                        color: proofData.verified ? THEME.win : THEME.loss,
                        border: `1.5px solid ${THEME.ink}`,
                      }}
                    >
                      {proofData.verified ? "Verified" : "Not verified"}
                    </span>
                    <span className="text-xs font-mono text-ink">
                      Batch: {proofData.batchId}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div
                      className="rounded-xl px-3.5 py-3"
                      style={{
                        border: `1.5px solid ${BORDER}`,
                        background: TILE_BG,
                      }}
                    >
                      <p className="text-[10px] uppercase tracking-[0.16em] text-ink/65">
                        Topic / Sequence
                      </p>
                      <p className="mt-1 font-mono text-xs text-ink/70">
                        {proofData.topicId || "—"} /{" "}
                        {proofData.sequenceNumber || "—"}
                      </p>
                    </div>
                    <div
                      className="rounded-xl px-3.5 py-3"
                      style={{
                        border: `1.5px solid ${BORDER}`,
                        background: TILE_BG,
                      }}
                    >
                      <p className="text-[10px] uppercase tracking-[0.16em] text-ink/65">
                        Consensus Time
                      </p>
                      <p className="mt-1 text-xs text-ink/70">
                        {formatAnchorTime(proofData.consensusTimestamp)}
                      </p>
                    </div>
                  </div>

                  <div
                    className="rounded-xl px-3.5 py-3"
                    style={{
                      border: `1.5px solid ${BORDER}`,
                      background: TILE_BG,
                    }}
                  >
                    <p className="text-[10px] uppercase tracking-[0.16em] text-ink/65">
                      Leaf Hash
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-ink/70">
                      {proofData.leafHash || "—"}
                    </p>
                  </div>

                  <div
                    className="rounded-xl px-3.5 py-3"
                    style={{
                      border: `1.5px solid ${BORDER}`,
                      background: TILE_BG,
                    }}
                  >
                    <p className="text-[10px] uppercase tracking-[0.16em] text-ink/65">
                      Merkle Root
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-ink/70">
                      {proofData.merkleRoot || "—"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {proofSearchHref ? (
                      <a
                        href={proofSearchHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-ink/20 bg-yellow px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink transition hover:text-ink"
                      >
                        Search Batch
                        <ExternalLink size={12} />
                      </a>
                    ) : null}
                    {proofTxHash ? (
                      <a
                        href={getExplorerTxUrl(proofTxHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink"
                        style={{
                          background: THEME.highlight,
                          boxShadow: `0 2px 0 ${THEME.ink}`,
                        }}
                      >
                        Open Transaction
                        <ExternalLink size={12} />
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-ink">No proof loaded.</div>
              )}
            </div>
          </DialogPanel>
        </div>
      </Dialog>
  );
}

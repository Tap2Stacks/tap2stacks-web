import { THEME } from "./ui/theme";
import React from "react";
import { ShieldCheck } from "lucide-react";

const ACCENT = THEME.ink;
const BORDER = THEME.ink;
const PANEL_BG = THEME.paper;

export const ProofsView: React.FC = () => {
  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:px-10 lg:py-7">
      <section className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full border"
          style={{
            borderColor: THEME.ink,
            background: THEME.paper,
          }}
        >
          <ShieldCheck size={18} style={{ color: ACCENT }} />
        </div>
        <div>
          <h1 className="text-[1.72rem] font-bold tracking-[-0.03em] text-ink">
            Proofs
          </h1>
          <p className="text-xs text-ink/70">
            Anchored settlement batches and Merkle verification
          </p>
        </div>
      </section>

      <section
        className="flex flex-1 items-center justify-center rounded-xl p-8 text-center"
        style={{
          background: PANEL_BG,
          border: `1.5px solid ${BORDER}`,
          boxShadow: `0 2px 0 ${THEME.ink}`,
        }}
      >
        <div className="max-w-md space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink">
            Proofs
          </p>
          <p className="text-sm text-ink">
            Batch price logs and tap Merkle proofs will appear here.
          </p>
        </div>
      </section>
    </div>
  );
};

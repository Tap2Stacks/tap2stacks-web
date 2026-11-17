import React from "react";
import { ShieldCheck } from "lucide-react";

const ACCENT = "#2D84EB";
const BORDER = "rgba(255, 255, 255, 0.11)";
const PANEL_BG =
  "linear-gradient(148deg, rgba(17, 20, 24, 0.94) 0%, rgba(10, 12, 15, 0.98) 100%)";

export const ProofsView: React.FC = () => {
  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:px-10 lg:py-7">
      <section className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full border"
          style={{
            borderColor: "rgba(45,132,235,0.3)",
            background: "rgba(45, 132, 235, 0.14)",
          }}
        >
          <ShieldCheck size={18} style={{ color: ACCENT }} />
        </div>
        <div>
          <h1 className="text-[1.72rem] font-bold tracking-[-0.03em] text-white">
            Proofs
          </h1>
          <p className="text-xs text-white/45">
            Anchored settlement batches and Merkle verification
          </p>
        </div>
      </section>

      <section
        className="flex flex-1 items-center justify-center rounded-2xl p-8 text-center"
        style={{
          background: PANEL_BG,
          border: `1px solid ${BORDER}`,
          boxShadow: "0 18px 36px rgba(0, 0, 0, 0.45)",
        }}
      >
        <div className="max-w-md space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/55">
            Proofs
          </p>
          <p className="text-sm text-white/65">
            Batch price logs and tap Merkle proofs will appear here.
          </p>
        </div>
      </section>
    </div>
  );
};

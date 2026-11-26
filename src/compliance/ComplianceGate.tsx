import { useState } from "react";
import { THEME } from "../ui/theme";
import { useComplianceStore } from "./store";

export function ComplianceGate() {
  const [age18, setAge18] = useState(false);
  const [notUS, setNotUS] = useState(false);
  const confirm = useComplianceStore((state) => state.confirm);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-ink/60 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="compliance-title"
        className="max-h-[calc(100dvh-24px)] w-full max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl bg-paper p-5 font-mono text-ink shadow-xl lg:max-w-lg lg:p-7"
        style={{
          backgroundColor: THEME.paper,
          color: THEME.ink,
          border: `1.5px solid ${THEME.ink}`,
          fontFamily: THEME.font,
        }}
      >
        <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest"><img src="/brand/logo-mark.svg" alt="" width={24} height={24} className="shrink-0" style={{ width: 24, height: 24 }} /><span>tap2stacks</span></p>
        <h1 id="compliance-title" className="text-2xl font-bold">
          Before you play
        </h1>
        <p className="mt-3 text-sm leading-relaxed">
          Testnet game. Test USDC has no value. Not for US persons. 18+.
        </p>
        <div className="my-6 space-y-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={age18}
              onChange={(event) => setAge18(event.target.checked)}
            />
            <span>I am 18 or older</span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={notUS}
              onChange={(event) => setNotUS(event.target.checked)}
            />
            <span>I am not a US person and not in the US</span>
          </label>
        </div>
        <button
          type="button"
          disabled={!age18 || !notUS}
          onClick={confirm}
          className="w-full rounded-lg bg-highlight px-4 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            backgroundColor: THEME.highlight,
            color: THEME.ink,
            border: `1.5px solid ${THEME.ink}`,
          }}
        >
          Continue
        </button>
      </section>
    </div>
  );
}

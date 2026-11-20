import { useState } from "react";
import { THEME } from "../ui/theme";

const STORAGE_KEY = "tap2stacks-getting-started";
const STEPS = ["Tap a cell", "Watch it settle", "Check history"] as const;
type Checklist = { dismissed: boolean; completed: boolean[] };

function readChecklist(): Checklist {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object") {
      const value = saved as Partial<Checklist>;
      return { dismissed: value.dismissed === true, completed: STEPS.map((_, index) => value.completed?.[index] === true) };
    }
  } catch { /* Storage may be disabled or contain old data. */ }
  return { dismissed: false, completed: STEPS.map(() => false) };
}

export function GettingStarted() {
  const [state, setState] = useState(readChecklist);
  const [expanded, setExpanded] = useState(false);
  function update(next: Checklist) {
    setState(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Still usable for this visit. */ }
  }
  if (state.dismissed) return null;
  return <section aria-label="Getting started checklist" className="shrink-0 border-b px-3" style={{ borderColor: "rgba(29,27,24,.12)" }}>
    <div className="flex items-center gap-2">
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="flex min-h-9 flex-1 items-center gap-2 text-left text-[11px] font-bold">
        <span>Getting started</span><span className="opacity-60">{state.completed.filter(Boolean).length}/3</span><span aria-hidden="true">{expanded ? "▴" : "▾"}</span>
      </button>
      <button type="button" aria-label="Dismiss getting started" onClick={() => update({ ...state, dismissed: true })} className="min-h-9 min-w-9 text-lg leading-none">×</button>
    </div>
    {expanded ? <div className="pb-2 text-[11px]">
      <p className="mb-1 opacity-60">Mark each step as you go.</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {STEPS.map((step, index) => <label key={step} className="inline-flex min-h-8 items-center gap-1.5">
          <input type="checkbox" checked={state.completed[index]} onChange={(event) => update({ ...state, completed: state.completed.map((value, i) => i === index ? event.target.checked : value) })} style={{ accentColor: THEME.ink }} />{step}
        </label>)}
      </div>
    </div> : null}
  </section>;
}

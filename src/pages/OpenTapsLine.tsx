import { useState } from "react";
import { OpenTapsList } from "./OpenTapsList";
import { useOpenStacksSummary } from "./useOpenStacks";

export function OpenTapsLine() {
  const [expanded, setExpanded] = useState(false);
  const { count, stake } = useOpenStacksSummary();

  return (
    <div className="shrink-0">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="w-full cursor-pointer px-3 py-1.5 text-left text-[11px] opacity-70"
      >
        {count} open taps / ${stake} on the board
      </button>
      {expanded ? <OpenTapsList compact /> : null}
    </div>
  );
}

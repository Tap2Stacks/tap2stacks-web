import { useEffect, useState } from "react";
import { formatCountdown, nextOpeningBell } from "../lib/openingBell";
import { THEME } from "../ui/theme";

export function BellPill({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const bell = nextOpeningBell(now);
  const countdown = formatCountdown(
    bell.at.getTime() - now.getTime(),
    bell.live,
  );
  const label = compact
    ? bell.live
      ? "Bell live"
      : `Bell ${countdown}`
    : bell.live
      ? "Opening Bell live"
      : `Bell 09:30 ET in ${countdown}`;

  return (
    <div
      className={`whitespace-nowrap rounded-full border text-[10px] font-bold ${compact ? "px-2 py-0.5" : "px-3 py-1"}`}
      style={{ background: bell.live ? THEME.highlight : THEME.paper }}
    >
      {label}
    </div>
  );
}

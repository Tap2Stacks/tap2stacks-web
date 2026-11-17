import { useEffect, useState } from "react";
import { formatCountdown, nextOpeningBell } from "../lib/openingBell";
import { THEME } from "../ui/theme";

export function BellPill() {
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
  const label = bell.live
    ? `Opening Bell ${countdown}`
    : `Bell 09:30 ET in ${countdown}`;

  return (
    <div
      className="rounded-full border px-3 py-1 text-[10px] font-bold"
      style={{ background: bell.live ? THEME.highlight : THEME.paper }}
    >
      {label}
    </div>
  );
}

import { useEffect, useState } from "react";
import { nextOpeningBell } from "../lib/openingBell";
import { THEME } from "../ui/theme";
export function BellPill() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);
    const bell = nextOpeningBell(now);
    const minutes = Math.ceil((bell.at.getTime() - now.getTime()) / 60000);
    return <div className="rounded-full border px-3 py-1 text-[10px] font-bold" style={{ background: bell.live ? THEME.highlight : THEME.paper }}>{bell.live ? "Opening Bell live" : `Bell 09:30 ET in ${Math.floor(minutes / 60)}h ${minutes % 60}m`}</div>;
}

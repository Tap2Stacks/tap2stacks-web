const eastern = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
});
function parts(date: Date) {
    return Object.fromEntries(eastern.formatToParts(date).map(p => [p.type, p.value]));
}
export function nextOpeningBell(now: Date): {
    at: Date;
    live: boolean;
} {
    const p = parts(now);
    const day = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), 14, 30));
    for (let i = 0; i < 8; i++) {
        const candidate = new Date(day);
        candidate.setUTCHours(14 - (Number(parts(candidate).hour) - 9));
        const weekday = day.getUTCDay();
        if (weekday !== 0 && weekday !== 6 && now.getTime() < candidate.getTime() + 1800000) {
            return { at: candidate, live: now.getTime() >= candidate.getTime() };
        }
        day.setUTCDate(day.getUTCDate() + 1);
    }
    throw new Error("Opening bell date unavailable");
}
export function formatChange(price: number, prevDayPx: number | null): string | null {
    if (!prevDayPx || prevDayPx <= 0 || !Number.isFinite(prevDayPx) || !Number.isFinite(price) || price <= 0)
        return null;
    const change = (price / prevDayPx - 1) * 100;
    return `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;
}

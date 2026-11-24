import { BACKEND_URL } from '../constant';
import type { PriceSample } from '../board/priceSeries';
let warned = false;
export async function fetchRecentPrices(ticker: string): Promise<{
    prevDayPx: number | null;
    points: PriceSample[];
    source?: string;
}> {
    try {
        const response = await fetch(`${BACKEND_URL}/api/prices/recent?ticker=${encodeURIComponent(ticker)}&sinceMs=${Date.now() - 300_000}`);
        if (!response.ok)
            throw new Error(`Recent prices HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.points))
            throw new Error('Invalid recent prices');
        const points = data.points.map((p: {
            ts: number;
            price: string;
        }) => ({ ts: Number(p.ts), price: Number(p.price) })).filter((p: PriceSample) => Number.isFinite(p.ts) && Number.isFinite(p.price)).sort((a: PriceSample, b: PriceSample) => a.ts - b.ts);
        const source = typeof data.source === 'string' && data.source.length > 0 ? data.source : undefined;
        return {
            prevDayPx: typeof data.prevDayPx === 'number' && Number.isFinite(data.prevDayPx) ? data.prevDayPx : null,
            points,
            ...(source !== undefined ? { source } : {}),
        };
    }
    catch {
        if (!warned) {
            console.warn('Recent prices unavailable; waiting for live prices.');
            warned = true;
        }
        return { prevDayPx: null, points: [] };
    }
}

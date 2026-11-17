import { resolveBackendUrl } from '../constant/backend-url';
import type { TradeFeedEntry } from '../feed/types';
export async function getRecentFeed(limit = 30): Promise<TradeFeedEntry[]> {
  try {
    const base=resolveBackendUrl(import.meta.env.VITE_BACKEND_URL, window.location.origin);
    const response=await fetch(`${base}/api/feed/recent?limit=${Math.max(1,Math.min(100,Math.floor(limit)))}`);
    if (!response.ok) return [];
    const data: unknown = await response.json();
    return Array.isArray(data) ? data as TradeFeedEntry[] : [];
  } catch { return []; }
}

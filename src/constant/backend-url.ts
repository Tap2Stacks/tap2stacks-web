/**
 * Backend base URL. When VITE_BACKEND_URL is unset or empty the app talks to its own origin,
 * which the Vite dev server proxies to the backend (/api, /socket.io). That keeps one origin,
 * so a single HTTPS link works on a phone.
 */
export function resolveBackendUrl(configured: string | undefined, pageOrigin: string): string {
  const value = configured?.trim();
  if (!value) return pageOrigin;
  return value.replace(/\/+$/, "");
}

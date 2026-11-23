export const DEFAULT_PUBLIC_URL = "https://45-77-250-147.sslip.io";

export function resolvePublicUrl(rawUrl?: string): string {
  const candidate = rawUrl?.trim() || DEFAULT_PUBLIC_URL;
  const parsed = new URL(candidate);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Invalid VITE_PUBLIC_URL protocol: ${parsed.protocol}`);
  }
  return candidate.replace(/\/+$/, "");
}

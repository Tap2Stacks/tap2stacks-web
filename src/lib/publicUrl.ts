export const DEFAULT_PUBLIC_URL = "https://tap2stacks.vercel.app";

export function resolvePublicUrl(rawUrl?: string): string {
  const candidate = rawUrl?.trim() || DEFAULT_PUBLIC_URL;
  const parsed = new URL(candidate);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Invalid VITE_PUBLIC_URL protocol: ${parsed.protocol}`);
  }
  return candidate.replace(/\/+$/, "");
}

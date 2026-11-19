export interface DevEnv {
  DEV?: boolean;
  VITE_ENABLE_DEV_TOOLS?: string;
  VITE_PREVIEW_TOPUP?: string;
}

/**
 * Dev-only tools (header/menu top-up, dev hints) are enabled only in Vite dev/test mode
 * and never in a production build. Set VITE_ENABLE_DEV_TOOLS="false" to simulate production.
 */
export function isDevMode(env: DevEnv = import.meta.env): boolean {
  if (!env.DEV) return false;
  const override = env.VITE_ENABLE_DEV_TOOLS?.trim().toLowerCase();
  return override !== "false" && override !== "0";
}

/**
 * Explicit build-time opt-in for the public preview stack only.
 * Enables the backend test/play top-up control in a production build; never set on Vercel.
 */
export function isPreviewTopUpEnabled(env: DevEnv = import.meta.env): boolean {
  return env.VITE_PREVIEW_TOPUP?.trim().toLowerCase() === "true";
}

/** Whether the test/play top-up control is enabled (dev mode or explicit preview opt-in). */
export function isTopUpEnabled(env: DevEnv = import.meta.env): boolean {
  return isDevMode(env) || isPreviewTopUpEnabled(env);
}

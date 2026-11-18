export interface DevEnv {
  DEV?: boolean;
  VITE_ENABLE_DEV_TOOLS?: string;
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

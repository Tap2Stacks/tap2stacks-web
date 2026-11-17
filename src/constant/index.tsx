import { resolveBackendUrl } from "./backend-url";

export const BACKEND_URL = resolveBackendUrl(
  import.meta.env.VITE_BACKEND_URL,
  window.location.origin,
);

import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { AXIOS_INSTANCE } from "../services/custom-client";
import { useComplianceStore } from "./store";

function isApiUrl(value: string): boolean {
  try {
    const path = new URL(value, window.location.origin).pathname;
    return path === "/api" || path.startsWith("/api/");
  } catch {
    return false;
  }
}

function checkError(error: AxiosError): Promise<never> {
  if (error.response?.status === 451 && isApiUrl(error.config?.url ?? "")) {
    useComplianceStore.getState().block();
  }
  return Promise.reject(error);
}

function preventBlockedRequest(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  if (useComplianceStore.getState().blocked && isApiUrl(config.url ?? "")) {
    throw new AxiosError("UNAVAILABLE_IN_REGION", "ERR_REGION_BLOCKED", config);
  }
  return config;
}

export function installApiRegionMonitor(): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    const input = args[0];
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (useComplianceStore.getState().blocked && isApiUrl(url)) {
      return new Response(null, { status: 451 });
    }
    const response = await originalFetch(...args);
    if (response.status === 451 && isApiUrl(url)) useComplianceStore.getState().block();
    return response;
  };
  const globalRequest = axios.interceptors.request.use(preventBlockedRequest);
  const clientRequest = AXIOS_INSTANCE.interceptors.request.use(preventBlockedRequest);
  const globalInterceptor = axios.interceptors.response.use(undefined, checkError);
  const clientInterceptor = AXIOS_INSTANCE.interceptors.response.use(undefined, checkError);
  return () => {
    globalThis.fetch = originalFetch;
    axios.interceptors.request.eject(globalRequest);
    AXIOS_INSTANCE.interceptors.request.eject(clientRequest);
    axios.interceptors.response.eject(globalInterceptor);
    AXIOS_INSTANCE.interceptors.response.eject(clientInterceptor);
  };
}

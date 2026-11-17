import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function getAuthToken(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem("token");
}

export function setAuthToken(token: string | null): void {
  if (typeof localStorage !== "undefined") {
    if (token === null) {
      localStorage.removeItem("token");
    } else {
      localStorage.setItem("token", token);
    }
  }
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window === "undefined") {
    return () => {
      listeners.delete(listener);
    };
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === "token") {
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Reactive subscription to the JWT auth token in localStorage. */
export function useAuthToken(): string | null {
  return useSyncExternalStore(subscribe, getAuthToken, () => null);
}

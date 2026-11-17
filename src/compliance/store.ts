import { create } from "zustand";

const STORAGE_KEY = "tap2stacks-attestation";
let pending: { resolve: () => void; reject: (error: Error) => void } | null = null;

function wasAttested(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

interface ComplianceState {
  attested: boolean;
  gateOpen: boolean;
  blocked: boolean;
  confirm: () => void;
  block: () => void;
}

export const useComplianceStore = create<ComplianceState>((set) => ({
  attested: wasAttested(),
  gateOpen: !wasAttested(),
  blocked: false,
  confirm: () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Keep this session usable if persistent storage is unavailable.
    }
    set({ attested: true, gateOpen: false });
    const previous = pending;
    pending = null;
    previous?.resolve();
  },
  block: () => {
    set({ blocked: true, gateOpen: false });
    const previous = pending;
    pending = null;
    previous?.reject(new Error("UNAVAILABLE_IN_REGION"));
  },
}));

export function requestReconfirmation(): Promise<void> {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // An unavailable storage mechanism already cannot remember consent.
  }
  useComplianceStore.setState({ attested: false, gateOpen: true });
  return new Promise((resolve, reject) => {
    pending = { resolve, reject };
  });
}

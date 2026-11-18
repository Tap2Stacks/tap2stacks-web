import { baseSepolia } from "viem/chains";

export { baseSepolia };

export const BASE_SEPOLIA_EXPLORER_BASE_URL = "https://sepolia.basescan.org";

export interface ChainEnv {
  VITE_CHAIN_ID?: string;
  VITE_RPC_URL?: string;
}

/** Resolve and validate the configured chain ID (Base Sepolia 84532 only). */
export function resolveChainId(env: ChainEnv = import.meta.env): number {
  const raw = env.VITE_CHAIN_ID?.trim();
  if (!raw) return baseSepolia.id;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed !== baseSepolia.id) {
    throw new Error(
      `Unsupported VITE_CHAIN_ID: ${raw}. Expected ${baseSepolia.id} (Base Sepolia).`,
    );
  }
  return parsed;
}

/** Resolve the Base Sepolia RPC URL, falling back to viem's default public RPC. */
export function resolveRpcUrl(env: ChainEnv = import.meta.env): string {
  return env.VITE_RPC_URL?.trim() || baseSepolia.rpcUrls.default.http[0];
}

export const BASE_SEPOLIA_CHAIN_ID = resolveChainId();
export const BASE_SEPOLIA_RPC_URL = resolveRpcUrl();

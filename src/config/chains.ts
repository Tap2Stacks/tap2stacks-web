import { baseSepolia } from "viem/chains";

export { baseSepolia };

export const BASE_SEPOLIA_EXPLORER_BASE_URL = "https://sepolia.basescan.org";

export const BASE_SEPOLIA_RPC_URL =
  import.meta.env.VITE_RPC_URL?.trim() || baseSepolia.rpcUrls.default.http[0];

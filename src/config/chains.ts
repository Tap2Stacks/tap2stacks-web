import { defineChain } from "viem";

export const LEGACY_TESTNET_RPC_URL = "https://testnet.hashio.io/api";
export const LEGACY_TESTNET_EXPLORER_BASE_URL =
  "https://hashscan.io/testnet";

export const legacyTestnet = defineChain({
  id: 296,
  name: "Legacy Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "HBAR",
    symbol: "HBAR",
  },
  rpcUrls: {
    default: {
      http: [LEGACY_TESTNET_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "Hashscan",
      url: LEGACY_TESTNET_EXPLORER_BASE_URL,
    },
  },
  testnet: true,
});

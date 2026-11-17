import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { LEGACY_TESTNET_RPC_URL, legacyTestnet } from "../config/chains";

const queryClient = new QueryClient();

const config = createConfig({
  chains: [legacyTestnet],
  connectors: [injected()],
  transports: {
    [legacyTestnet.id]: http(LEGACY_TESTNET_RPC_URL),
  },
});

export function Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

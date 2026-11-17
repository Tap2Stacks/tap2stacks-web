/* eslint-disable react-refresh/only-export-components */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { baseAccount, injected } from "wagmi/connectors";
import { BASE_SEPOLIA_RPC_URL, baseSepolia } from "../config/chains";

const queryClient = new QueryClient();

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [baseAccount({ appName: "tap2stacks" }), injected()],
  transports: {
    [baseSepolia.id]: http(BASE_SEPOLIA_RPC_URL),
  },
});

export function Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

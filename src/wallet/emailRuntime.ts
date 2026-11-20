import { http, type EIP1193Provider } from "viem";
import { BASE_SEPOLIA_RPC_URL, baseSepolia } from "../config/chains";
import { setEmailRuntime } from "./emailConnector";

export async function startEmailWallet(projectId: string) {
  const cdp = await import("@coinbase/cdp-core");
  await cdp.initialize({ projectId, ethereum: { createOnLogin: "eoa" }, solana: { createOnLogin: false } });
  const walletConfig = { chains: [baseSepolia], transports: { [baseSepolia.id]: http(BASE_SEPOLIA_RPC_URL) }, announceProvider: false };
  // CDP bundles its own viem version; these chain and transport objects share the same runtime interface.
  const wallet = cdp.createCDPEmbeddedWallet(walletConfig as unknown as Parameters<typeof cdp.createCDPEmbeddedWallet>[0]);
  setEmailRuntime({ provider: wallet.provider as unknown as EIP1193Provider, signOut: cdp.signOut });
  return {
    currentUser: await cdp.getCurrentUser(),
    sendCode: (email: string) => cdp.signInWithEmail({ email }),
    verifyCode: (flowId: string, otp: string) => cdp.verifyEmailOTP({ flowId, otp }),
  };
}

import { createConnector } from "wagmi";
import { getAddress, type Address, type EIP1193Provider } from "viem";
import { withBuilderCodeProvider } from "../lib/builderCode";

export interface EmailRuntime {
  provider: EIP1193Provider;
  signOut: () => Promise<void>;
}
let activeRuntime: EmailRuntime | undefined;
export function setEmailRuntime(runtime: EmailRuntime | undefined) { activeRuntime = runtime; }
export function getEmailRuntime() { return activeRuntime; }

export function emailConnector(
  getRuntime: () => EmailRuntime | undefined = getEmailRuntime,
  getBuilderCode: () => string | undefined = () => import.meta.env.VITE_BASE_BUILDER_CODE,
) {
  return createConnector((config) => {
    let provider: EIP1193Provider | undefined;
    const requireProvider = () => {
      const runtime = getRuntime();
      if (!runtime) throw new Error("Email wallet is not ready");
      return withBuilderCodeProvider(runtime.provider, getBuilderCode);
    };
    const onAccountsChanged = (accounts: string[]) => {
      if (!accounts.length) config.emitter.emit("disconnect");
      else config.emitter.emit("change", { accounts: accounts.map(getAddress) });
    };
    const onChainChanged = (chainId: string) => config.emitter.emit("change", { chainId: Number(chainId) });
    const onDisconnect = () => config.emitter.emit("disconnect");
    return {
      id: "cdpEmail", name: "Email", type: "cdpEmail",
      async connect<withCapabilities extends boolean = false>(parameters?: { withCapabilities?: withCapabilities | boolean }) {
        provider = requireProvider();
        const accounts = (await provider.request({ method: "eth_requestAccounts" })).map(getAddress);
        if (!accounts.length) throw new Error("Email wallet has no account");
        const chainId = Number(await provider.request({ method: "eth_chainId" }));
        provider.on("accountsChanged", onAccountsChanged);
        provider.on("chainChanged", onChainChanged);
        provider.on("disconnect", onDisconnect);
        const result = parameters?.withCapabilities ? accounts.map((address) => ({ address, capabilities: {} })) : accounts;
        return { accounts: result as unknown as withCapabilities extends true ? readonly { address: Address; capabilities: Record<string, unknown> }[] : readonly Address[], chainId };
      },
      async disconnect() {
        provider?.removeListener("accountsChanged", onAccountsChanged);
        provider?.removeListener("chainChanged", onChainChanged);
        provider?.removeListener("disconnect", onDisconnect);
        provider = undefined;
        try { await getRuntime()?.signOut(); } finally { setEmailRuntime(undefined); }
      },
      async getAccounts() { return (await requireProvider().request({ method: "eth_accounts" })).map(getAddress); },
      async getChainId() { return Number(await requireProvider().request({ method: "eth_chainId" })); },
      async getProvider() { return requireProvider(); },
      async isAuthorized() {
        if (!getRuntime()) return false;
        try { return (await this.getAccounts()).length > 0; } catch { return false; }
      },
      onAccountsChanged,
      onChainChanged,
      onDisconnect,
    };
  });
}

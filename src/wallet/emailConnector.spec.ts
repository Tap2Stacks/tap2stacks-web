import { describe, expect, it, vi } from "vitest";
import { createConfig, http } from "wagmi";
import type { EIP1193Provider } from "viem";
import { baseSepolia } from "../config/chains";
import { emailConnector } from "./emailConnector";

const address = "0x1111111111111111111111111111111111111111" as const;
describe("email wallet connector", () => {
  it("uses the embedded provider for accounts and chain, then signs out on disconnect", async () => {
    const request = vi.fn(async ({ method }: { method: string }) => method === "eth_chainId" ? "0x14a34" : [address]);
    const provider = { request, on: vi.fn(), removeListener: vi.fn() };
    const signOut = vi.fn(async () => {});
    const runtime = { provider: provider as unknown as EIP1193Provider, signOut };
    const config = createConfig({ chains: [baseSepolia], transports: { [baseSepolia.id]: http() }, connectors: [emailConnector(() => runtime)] });
    const connector = config.connectors[0];
    expect(await connector.isAuthorized()).toBe(true);
    const connected = await connector.connect();
    expect(connected.accounts).toEqual([address]);
    expect(connected.chainId).toBe(baseSepolia.id);
    await connector.disconnect();
    expect(signOut).toHaveBeenCalledOnce();
    expect(provider.removeListener).toHaveBeenCalled();
  });
  it("does not load or authorize a wallet before the email flow starts", async () => {
    const getRuntime = vi.fn(() => undefined);
    const config = createConfig({ chains: [baseSepolia], transports: { [baseSepolia.id]: http() }, connectors: [emailConnector(getRuntime)] });
    expect(await config.connectors[0].isAuthorized()).toBe(false);
    await expect(config.connectors[0].connect()).rejects.toThrow("Email wallet is not ready");
  });
});

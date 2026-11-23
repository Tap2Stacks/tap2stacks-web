import { afterEach, describe, expect, it, vi } from "vitest";
import { createConfig, http } from "wagmi";
import type { EIP1193Provider } from "viem";
import { baseSepolia } from "../config/chains";
import { emailConnector } from "./emailConnector";

const address = "0x1111111111111111111111111111111111111111" as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

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

  it("appends Base Builder Code ERC-8021 suffix on email wallet eth_sendTransaction writes", async () => {
    vi.stubEnv("VITE_BASE_BUILDER_CODE", "bc_ymo2v08a");
    const request = vi.fn(async ({ method }: { method: string }) =>
      method === "eth_chainId" ? "0x14a34" : method === "eth_sendTransaction" ? "0xtxhash" : [address],
    );
    const provider = { request, on: vi.fn(), removeListener: vi.fn() };
    const runtime = { provider: provider as unknown as EIP1193Provider, signOut: vi.fn(async () => {}) };
    const config = createConfig({ chains: [baseSepolia], transports: { [baseSepolia.id]: http() }, connectors: [emailConnector(() => runtime)] });
    const connector = config.connectors[0];
    const wrapped = (await connector.getProvider()) as EIP1193Provider;

    await wrapped.request({
      method: "eth_sendTransaction",
      params: [{ from: address, to: address, data: "0xde5f72fd" }],
    });

    expect(request).toHaveBeenLastCalledWith({
      method: "eth_sendTransaction",
      params: [
        {
          from: address,
          to: address,
          data: "0xde5f72fd62635f796d6f32763038610b0080218021802180218021802180218021",
        },
      ],
    });
  });
});

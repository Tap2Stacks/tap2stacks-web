import { afterEach, describe, expect, it, vi } from "vitest";
import { baseSepolia, resolveChainId, resolveRpcUrl } from "./chains";

describe("chains config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolveChainId defaults to Base Sepolia (84532) when VITE_CHAIN_ID is unset or blank", () => {
    expect(resolveChainId({})).toBe(84532);
    expect(resolveChainId({ VITE_CHAIN_ID: "" })).toBe(84532);
    expect(resolveChainId({ VITE_CHAIN_ID: "   " })).toBe(84532);
  });

  it("resolveChainId accepts VITE_CHAIN_ID=84532", () => {
    expect(resolveChainId({ VITE_CHAIN_ID: "84532" })).toBe(84532);
    expect(resolveChainId({ VITE_CHAIN_ID: " 84532 " })).toBe(84532);
  });

  it("resolveChainId rejects unsupported or invalid VITE_CHAIN_ID", () => {
    expect(() => resolveChainId({ VITE_CHAIN_ID: "1" })).toThrow(/VITE_CHAIN_ID/);
    expect(() => resolveChainId({ VITE_CHAIN_ID: "abc" })).toThrow(/VITE_CHAIN_ID/);
  });

  it("resolveRpcUrl uses VITE_RPC_URL when set and falls back to baseSepolia default", () => {
    expect(resolveRpcUrl({})).toBe(baseSepolia.rpcUrls.default.http[0]);
    expect(resolveRpcUrl({ VITE_RPC_URL: "  " })).toBe(baseSepolia.rpcUrls.default.http[0]);
    expect(resolveRpcUrl({ VITE_RPC_URL: " https://sepolia.base.org " })).toBe(
      "https://sepolia.base.org",
    );
  });
});

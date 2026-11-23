import { describe, expect, it } from "vitest";
import { visibleWalletConnectors } from "./connectors";

describe("visibleWalletConnectors", () => {
  const base = { id: "baseAccount", name: "Base Account" };
  const generic = { id: "injected", name: "Injected" };
  const metamask = { id: "io.metamask", name: "MetaMask", type: "injected" };
  const rabby = { id: "io.rabby", name: "Rabby", type: "injected" };
  const coinbaseEip6963 = { id: "com.coinbase.wallet", name: "Coinbase Wallet", type: "injected" };

  it("shows Base and each discovered wallet without the duplicate generic wallet", () => {
    expect(visibleWalletConnectors([generic, rabby, base, metamask], true)).toEqual([base, metamask, rabby]);
  });

  it("only offers a generic injected wallet when a legacy provider is present", () => {
    expect(visibleWalletConnectors([generic, base], false)).toEqual([base]);
    expect(visibleWalletConnectors([generic, base], true)).toEqual([base, generic]);
  });

  it("ignores unsupported connectors and de-duplicates IDs", () => {
    expect(visibleWalletConnectors([base, base, { id: "walletConnect", name: "WalletConnect" }], false)).toEqual([base]);
  });

  it("prefers the EIP-6963 Coinbase Wallet provider first inside Coinbase Wallet browser", () => {
    expect(
      visibleWalletConnectors([generic, rabby, base, coinbaseEip6963, metamask], true, true),
    ).toEqual([coinbaseEip6963, base, metamask, rabby]);
  });

  it("falls back to generic injected first inside Coinbase Wallet browser when EIP-6963 is absent", () => {
    expect(
      visibleWalletConnectors([generic, base], true, true),
    ).toEqual([generic, base]);
  });
});

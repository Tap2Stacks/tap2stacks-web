import { describe, expect, it } from "vitest";
import { isCoinbaseWalletBrowser } from "./coinbaseBrowser";

describe("isCoinbaseWalletBrowser", () => {
  it("detects Coinbase Wallet mobile in-app user agent", () => {
    expect(
      isCoinbaseWalletBrowser({
        navigator: {
          userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CoinbaseWallet/28.0",
        },
      }),
    ).toBe(true);
    expect(
      isCoinbaseWalletBrowser({
        navigator: { userAgent: "Mozilla/5.0 CBWallet/1.0" },
      }),
    ).toBe(true);
  });

  it("detects explicit isCoinbaseBrowser flag without false-positiving on desktop Chrome extension", () => {
    expect(
      isCoinbaseWalletBrowser({
        navigator: { userAgent: "Mozilla/5.0 Chrome/120.0.0.0" },
        ethereum: { isCoinbaseBrowser: true, isCoinbaseWallet: true },
      }),
    ).toBe(true);
    expect(
      isCoinbaseWalletBrowser({
        navigator: { userAgent: "Mozilla/5.0 Chrome/120.0.0.0" },
        ethereum: { isCoinbaseWallet: true },
      }),
    ).toBe(false);
  });
});

export const COINBASE_WALLET_RDNS = "com.coinbase.wallet";

interface WindowLike {
  navigator?: { userAgent?: string };
  ethereum?: {
    isCoinbaseBrowser?: boolean;
    isCoinbaseWallet?: boolean;
  };
}

/**
 * Detect whether the app is running inside Coinbase Wallet's (Base App) in-app browser.
 */
export function isCoinbaseWalletBrowser(
  win: WindowLike | undefined = typeof window !== "undefined" ? (window as WindowLike) : undefined,
): boolean {
  if (!win) return false;
  if (win.ethereum?.isCoinbaseBrowser) return true;
  const ua = win.navigator?.userAgent ?? "";
  return /CoinbaseWallet|CBWallet/i.test(ua);
}

/** Base's official blue Square (github.com/base/brand-kit, unaltered), used only to identify Base Account. */
export const BASE_SQUARE_SRC = "/brand/wallets/base-square.svg";

export type WalletIconSource = { kind: "img"; src: string } | { kind: "mail" } | { kind: "wallet" };

/**
 * Which logo a wallet option shows: Base's Square for Base Account, the icon a
 * wallet announces about itself (EIP-6963) when it is an image, a mail icon for
 * email sign-in and a plain wallet icon otherwise.
 */
export function walletIconSource(connector: { id: string; icon?: string }): WalletIconSource {
  if (connector.id === "baseAccount") return { kind: "img", src: BASE_SQUARE_SRC };
  if (connector.id === "cdpEmail") return { kind: "mail" };
  const icon = connector.icon?.trim();
  if (icon && (/^data:image\//i.test(icon) || /^https:\/\//i.test(icon))) return { kind: "img", src: icon };
  return { kind: "wallet" };
}

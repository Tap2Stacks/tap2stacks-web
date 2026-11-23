import { COINBASE_WALLET_RDNS } from "./coinbaseBrowser";

type WalletConnector = { id: string; name: string; type?: string };

export function visibleWalletConnectors<T extends WalletConnector>(
  connectors: readonly T[],
  hasLegacyProvider: boolean,
  preferCoinbaseInjected = false,
): T[] {
  const base = connectors.filter((connector) => connector.id === "baseAccount");
  const coinbaseInjected = preferCoinbaseInjected
    ? connectors.filter((connector) => connector.id === COINBASE_WALLET_RDNS)
    : [];
  const discovered = connectors
    .filter(
      (connector) =>
        connector.type === "injected" &&
        connector.id !== "injected" &&
        (!preferCoinbaseInjected || connector.id !== COINBASE_WALLET_RDNS),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const legacy =
    (preferCoinbaseInjected ? coinbaseInjected.length === 0 : discovered.length === 0) &&
    hasLegacyProvider
      ? connectors.filter((connector) => connector.id === "injected")
      : [];
  const ordered = preferCoinbaseInjected
    ? [...coinbaseInjected, ...legacy, ...base, ...discovered]
    : [...base, ...discovered, ...legacy];
  const seen = new Set<string>();
  return ordered.filter(
    (connector) => !seen.has(connector.id) && !!seen.add(connector.id),
  );
}

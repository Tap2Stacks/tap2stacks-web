type WalletConnector = { id: string; name: string; type?: string };

export function visibleWalletConnectors<T extends WalletConnector>(connectors: readonly T[], hasLegacyProvider: boolean): T[] {
  const base = connectors.filter((connector) => connector.id === "baseAccount");
  const discovered = connectors.filter((connector) => connector.type === "injected" && connector.id !== "injected");
  const legacy = discovered.length === 0 && hasLegacyProvider
    ? connectors.filter((connector) => connector.id === "injected") : [];
  const seen = new Set<string>();
  return [...base, ...discovered.sort((a, b) => a.name.localeCompare(b.name)), ...legacy]
    .filter((connector) => !seen.has(connector.id) && !!seen.add(connector.id));
}

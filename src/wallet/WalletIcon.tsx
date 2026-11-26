import { THEME } from "../ui/theme";
import { walletIconSource } from "./walletIconSource";

/** Decorative logo for a wallet option; the option's text names the wallet, so alt is empty. */
export function WalletIcon({ connector, size = 28 }: { connector: { id: string; icon?: string }; size?: number }) {
  const source = walletIconSource(connector);
  if (source.kind === "img") {
    return <img src={source.src} alt="" width={size} height={size} className="shrink-0 rounded-md object-contain" style={{ width: size, height: size }} />;
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="shrink-0" fill="none" stroke={THEME.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {source.kind === "mail" ? (
        <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3.5 7l8.5 6 8.5-6" /></>
      ) : (
        <><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 9.5h13.5" /><circle cx="16.5" cy="13" r="1.3" fill={THEME.ink} /></>
      )}
    </svg>
  );
}

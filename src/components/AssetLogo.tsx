import nvdaLogo from "../assets/logos/nvda.svg";
import tslaLogo from "../assets/logos/tsla.svg";
import usdcLogo from "../assets/logos/usdc.svg";
import ethLogo from "../assets/logos/eth.svg";
import baseLogo from "../assets/logos/base.svg";
import { THEME } from "../ui/theme";

export interface AssetLogoEntry {
  src: string;
  label: string;
}

const LOGO_ENTRIES: Record<string, AssetLogoEntry> = {
  NVDA: { src: nvdaLogo, label: "NVIDIA" },
  TSLA: { src: tslaLogo, label: "Tesla" },
  USDC: { src: usdcLogo, label: "USDC" },
  TUSDC: { src: usdcLogo, label: "USDC" },
  "USD COIN": { src: usdcLogo, label: "USDC" },
  ETH: { src: ethLogo, label: "Ethereum" },
  WETH: { src: ethLogo, label: "Ethereum" },
  ETHEREUM: { src: ethLogo, label: "Ethereum" },
  BASE: { src: baseLogo, label: "Base" },
  "BASE SEPOLIA": { src: baseLogo, label: "Base" },
  BASE_SEPOLIA: { src: baseLogo, label: "Base" },
  "BASE MAINNET": { src: baseLogo, label: "Base" },
};

export function resolveAssetLogo(symbol: string): AssetLogoEntry | null {
  const key = symbol.trim().toUpperCase();
  if (!key) return null;
  return LOGO_ENTRIES[key] ?? null;
}

export function getAssetMonogram(symbol: string): string {
  const cleaned = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned ? cleaned.slice(0, 2) : "?";
}

export interface AssetLogoProps {
  symbol: string;
  size?: number;
  className?: string;
  alt?: string;
  decorative?: boolean;
}

export function AssetLogo({
  symbol,
  size = 16,
  className = "",
  alt,
  decorative = true,
}: AssetLogoProps) {
  const entry = resolveAssetLogo(symbol);
  if (entry) {
    return (
      <img
        src={entry.src}
        alt={decorative ? "" : (alt ?? entry.label)}
        aria-hidden={decorative ? true : undefined}
        data-symbol={symbol}
        width={size}
        height={size}
        className={`inline-block shrink-0 rounded-full object-contain ${className}`.trim()}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      data-fallback="monogram"
      data-symbol={symbol}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : (alt ?? (symbol.trim() || "Asset"))}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none ${className}`.trim()}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(8, Math.round(size * 0.44)),
        backgroundColor: THEME.yellow,
        color: THEME.ink,
        border: `1px solid ${THEME.ink}`,
      }}
    >
      {getAssetMonogram(symbol)}
    </span>
  );
}

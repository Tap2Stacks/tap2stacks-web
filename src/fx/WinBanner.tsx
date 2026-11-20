import { AssetLogo } from "../components/AssetLogo";
import { THEME } from "../ui/theme";
import { useFxStore } from "./fxStore";

const bannerStyle = {
  position: "fixed",
  top: "20%",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 101,
  pointerEvents: "none",
  textAlign: "center",
  color: THEME.win,
  fontWeight: 800,
  textShadow: `0 2px ${THEME.paper}`,
} as const;

const rowStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
} as const;

const detailStyle = { fontSize: 16 };

export function WinBanner() {
  const moment = useFxStore((state) => state.current);
  if (!moment || moment.tier === "small") return null;
  return (
    <div aria-live="polite" style={{ ...bannerStyle, fontSize: moment.tier === "big" ? 56 : 32 }}>
      <div style={rowStyle}>
        <AssetLogo symbol={moment.ticker} size={moment.tier === "big" ? 36 : 24} />
        <span>+${moment.payout.toFixed(2)}</span>
      </div>
      <div style={detailStyle}>x{moment.rate.toFixed(1)} on ${moment.stake}</div>
    </div>
  );
}

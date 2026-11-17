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

const detailStyle = { fontSize: 16 };

export function WinBanner() {
  const moment = useFxStore((state) => state.current);
  if (!moment || moment.tier === "small") return null;
  return (
    <div aria-live="polite" style={{ ...bannerStyle, fontSize: moment.tier === "big" ? 56 : 32 }}>
      <div>+${moment.payout.toFixed(2)}</div>
      <div style={detailStyle}>x{moment.rate.toFixed(1)} on ${moment.stake}</div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { getRecentFeed } from "../api/feed";
import { onTradeFeed } from "../realtime/bus";
import { THEME } from "../ui/theme";
import { formatEntry, useFeedStore } from "./feedStore";
import type { TradeFeedEntry } from "./types";

const barStyle = {
  overflowX: "auto",
  overflowY: "hidden",
  scrollbarWidth: "none",
  width: "100%",
  height: 32,
  color: THEME.paper,
  fontFamily: THEME.font,
  background: THEME.ink,
} as const;
const rowStyle = { display: "flex" } as const;
const trackStyle = { display: "flex", width: "max-content" } as const;
const entryStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  whiteSpace: "nowrap",
  height: 32,
  padding: "0 14px",
} as const;

function shortAddress(address: string | null): string | null {
  const lower = address?.toLowerCase();
  return lower ? `0x${lower.slice(2, 6)}..${lower.slice(-2)}` : null;
}

function FeedItem({ entry, ownShort }: { entry: TradeFeedEntry; ownShort: string | null }) {
  const item = formatEntry(entry, ownShort);
  const loss = entry.result === "loss";
  const bigWin = entry.big && !loss;
  const background = bigWin ? THEME.highlight : "transparent";
  return (
    <span style={{
      ...entryStyle,
      background,
      color: bigWin ? THEME.ink : THEME.paper,
      opacity: loss ? 0.65 : 1,
    }}>
      <b>{item.who}</b>
      {item.bot && <small>bot</small>}
      <span>{item.text}</span>
      <b style={{ color: !loss && !bigWin ? THEME.winOnInk : "inherit" }}>{item.amount}</b>
    </span>
  );
}

export function RunningBar({ ownAddress }: { ownAddress: string | null }) {
  const entries = useFeedStore((state) => state.entries);
  const add = useFeedStore((state) => state.add);
  const seed = useFeedStore((state) => state.seed);
  const row = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let active = true;
    const unsubscribe = onTradeFeed(add);
    void getRecentFeed().then((recent) => {
      if (active) seed(recent);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [add, seed]);

  useEffect(() => {
    const element = row.current;
    if (!element) return;
    const measure = () => setWidth(element.scrollWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [entries]);

  if (entries.length === 0) return null;

  const ownShort = shortAddress(ownAddress);
  const items = [...entries].reverse().map((entry) => (
    <FeedItem key={entry.id} entry={entry} ownShort={ownShort} />
  ));
  return (
    <div aria-label="Recent trades" className="running-bar [&::-webkit-scrollbar]:hidden" style={barStyle}>
      <div
        className="running-bar-track"
        style={{ ...trackStyle, animationDuration: `${Math.max(width / 40, 1)}s` }}
      >
        <div ref={row} style={rowStyle}>{items}</div>
        <div aria-hidden="true" className="running-bar-copy" style={rowStyle}>{items}</div>
      </div>
    </div>
  );
}

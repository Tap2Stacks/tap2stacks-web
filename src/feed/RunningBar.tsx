import { useEffect, useRef, useState } from "react";
import { getRecentFeed } from "../api/feed";
import { onTradeFeed } from "../realtime/bus";
import { THEME } from "../ui/theme";
import { formatEntry, useFeedStore } from "./feedStore";
import type { TradeFeedEntry } from "./types";

const barStyle = {
  overflow: "hidden",
  fontFamily: THEME.font,
  background: THEME.paper,
} as const;
const rowStyle = { display: "flex" } as const;
const trackStyle = { display: "flex", width: "max-content" } as const;
const entryStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  whiteSpace: "nowrap",
  padding: "7px 14px",
} as const;

function shortAddress(address: string | null): string | null {
  const lower = address?.toLowerCase();
  return lower ? `0x${lower.slice(2, 6)}..${lower.slice(-2)}` : null;
}

function FeedItem({ entry, ownShort }: { entry: TradeFeedEntry; ownShort: string | null }) {
  const item = formatEntry(entry, ownShort);
  const loss = entry.result === "loss";
  const background = entry.big && !loss ? THEME.highlight : "transparent";
  return (
    <span style={{
      ...entryStyle,
      background,
      color: loss ? THEME.loss : THEME.win,
      opacity: loss ? 0.65 : 1,
    }}>
      <b>{item.who}</b>
      {item.bot && <small>bot</small>}
      <span>{item.text}</span>
      <b>{item.amount}</b>
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

  const ownShort = shortAddress(ownAddress);
  const items = [...entries].reverse().map((entry) => (
    <FeedItem key={entry.id} entry={entry} ownShort={ownShort} />
  ));
  return (
    <div aria-label="Recent trades" className="running-bar" style={barStyle}>
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

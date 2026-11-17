import { useEffect, useRef, useState } from "react";
import { THEME } from "../ui/theme";
import { useFxStore } from "./fxStore";
import { createParticleSystem } from "./particles";
import { rainCoinCount, rainDurationMs } from "./tiers";

export const FX_SHAKE_CLASS = "fx-shake";

interface Point { x: number; y: number }
interface Ring extends Point { started: number }
interface SmallTag extends Point { started: number; payout: number }
interface FxCanvasProps {
  viewingTicker: string;
  cellCenter: (cellId: string) => Point | null;
  reducedMotion?: boolean;
}

const canvasStyle = {
  position: "fixed",
  inset: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
  zIndex: 100,
} as const;

function drawRing(ctx: CanvasRenderingContext2D, ring: Ring, now: number): void {
  const age = now - ring.started;
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = THEME.highlight;
  ctx.lineWidth = 3;
  ctx.globalAlpha = Math.max(0, 1 - age / 600);
  ctx.arc(ring.x, ring.y, 10 + age / 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTag(ctx: CanvasRenderingContext2D, tag: SmallTag, now: number): void {
  const progress = Math.min(1, Math.max(0, (now - tag.started) / 900));
  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.fillStyle = THEME.win;
  ctx.font = `bold 16px ${THEME.font}`;
  ctx.textAlign = "center";
  ctx.fillText(`+$${tag.payout.toFixed(2)}`, tag.x, tag.y - 24 * progress);
  ctx.restore();
}

function useReducedMotion(override: boolean | undefined): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return override ?? reduced;
}

function useEffectsRenderer() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const system = useRef(createParticleSystem());
  const ring = useRef<Ring | null>(null);
  const tag = useRef<SmallTag | null>(null);
  const frame = useRef<number | null>(null);
  const previous = useRef(0);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);

  function draw(now: number): void {
    frame.current = null;
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (el.width !== width * dpr || el.height !== height * dpr) {
      el.width = width * dpr;
      el.height = height * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    system.current.step(now - previous.current);
    previous.current = now;
    system.current.draw(ctx);
    if (ring.current && now - ring.current.started < 600) drawRing(ctx, ring.current, now);
    else ring.current = null;
    if (tag.current && now - tag.current.started < 900) drawTag(ctx, tag.current, now);
    else tag.current = null;
    if (system.current.count() > 0 || ring.current || tag.current) {
      frame.current = requestAnimationFrame(draw);
    }
  }

  function start(now: number): void {
    if (frame.current !== null) return;
    if (system.current.count() === 0 && !ring.current && !tag.current) return;
    previous.current = now;
    frame.current = requestAnimationFrame(draw);
  }

  return { canvas, system, ring, tag, start };
}

export function FxCanvas({ viewingTicker, cellCenter, reducedMotion }: FxCanvasProps) {
  const renderer = useEffectsRenderer();
  const rendererRef = useRef(renderer);
  const centerRef = useRef(cellCenter);
  const tickerRef = useRef(viewingTicker);
  const reduce = useReducedMotion(reducedMotion);
  const reduceRef = useRef(reduce);
  const current = useFxStore((state) => state.current);
  const advance = useFxStore((state) => state.advance);
  rendererRef.current = renderer;
  centerRef.current = cellCenter;
  tickerRef.current = viewingTicker;
  reduceRef.current = reduce;

  useEffect(() => {
    if (!current) return;
    const { system, ring, tag, start } = rendererRef.current;
    const point = current.ticker === tickerRef.current
      ? centerRef.current(current.cellId)
      : null;
    const reduce = reduceRef.current;
    const started = performance.now();
    if (point) system.current.burst(point.x, point.y, current.tier);
    if (point && current.tier === "small") {
      tag.current = { ...point, started, payout: current.payout };
    }
    if (point && !reduce && current.tier !== "small") {
      ring.current = { ...point, started };
    }
    const duration = current.tier === "small" ? 900 : rainDurationMs(current.payout, reduce);
    if (current.tier !== "small") {
      system.current.rain(duration, rainCoinCount(current.tier, current.payout, reduce));
    }
    start(started);
    const timer = window.setTimeout(() => advance(Date.now()), duration);
    return () => clearTimeout(timer);
  }, [current, advance]);

  return <canvas ref={renderer.canvas} aria-hidden="true" style={canvasStyle} />;
}

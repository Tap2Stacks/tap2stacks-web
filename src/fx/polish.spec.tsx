import { readFileSync } from "node:fs";
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FxCanvas, FX_SHAKE_CLASS } from "./FxCanvas";
import { useFxStore } from "./fxStore";
import { WinBanner } from "./WinBanner";

const effects = vi.hoisted(() => ({
  burst: vi.fn(),
  rain: vi.fn(),
  step: vi.fn(),
  draw: vi.fn(),
  count: vi.fn(() => 1),
}));
vi.mock("./particles", () => ({ createParticleSystem: () => effects }));

const css = readFileSync(`${process.cwd()}/src/index.css`, "utf8");
const moment = {
  cellId: "a", ticker: "NVDA", stake: 25, payout: 100,
  rate: 4, tier: "big" as const, atMs: 0,
};

afterEach(() => {
  cleanup();
  useFxStore.setState({ current: null, queue: [], flash: null });
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it("places the banner above the canvas and hides it for small wins", () => {
  useFxStore.setState({ current: moment });
  const { container, rerender } = render(
    <><FxCanvas viewingTicker="TSLA" cellCenter={() => null} reducedMotion /><WinBanner /></>,
  );
  const canvas = container.querySelector("canvas")!;
  const banner = container.querySelector('[aria-live="polite"]') as HTMLElement;
  expect(Number(banner.style.zIndex)).toBeGreaterThan(Number(canvas.style.zIndex));
  useFxStore.setState({ current: { ...moment, tier: "small" } });
  rerender(<WinBanner />);
  expect(container.querySelector('[aria-live="polite"]')).toBeNull();
});

it("disables shake and ring with reduced motion", () => {
  expect(css).toMatch(/prefers-reduced-motion: reduce[^}]*\{\s*\.fx-shake\s*\{\s*animation:\s*none/s);
  expect(FX_SHAKE_CLASS).toBe("fx-shake");
  const arc = vi.fn();
  const context = { setTransform: vi.fn(), clearRect: vi.fn(), arc };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const callbacks: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  useFxStore.setState({ current: moment });
  const { container } = render(
    <FxCanvas viewingTicker="NVDA" cellCenter={() => ({ x: 20, y: 20 })} reducedMotion />,
  );
  callbacks[0](performance.now() + 100);
  expect(arc).not.toHaveBeenCalled();
  expect(container.querySelector(`.${FX_SHAKE_CLASS}`)).toBeNull();
});

it("does not schedule an animation loop when idle and stops after particles expire", () => {
  const callbacks: FrameRequestCallback[] = [];
  const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  const context = { setTransform: vi.fn(), clearRect: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const { rerender } = render(<FxCanvas viewingTicker="TSLA" cellCenter={() => null} />);
  expect(request).not.toHaveBeenCalled();
  useFxStore.setState({ current: moment });
  rerender(<FxCanvas viewingTicker="TSLA" cellCenter={() => null} />);
  expect(request).toHaveBeenCalledTimes(1);
  effects.count.mockReturnValue(0);
  callbacks[0](performance.now() + 2000);
  expect(request).toHaveBeenCalledTimes(1);
  effects.count.mockReturnValue(1);
});

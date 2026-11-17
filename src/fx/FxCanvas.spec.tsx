import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FxCanvas } from "./FxCanvas";
import { useFxStore } from "./fxStore";

const effects = vi.hoisted(() => ({
  burst: vi.fn(),
  rain: vi.fn(),
  step: vi.fn(),
  draw: vi.fn(),
  count: vi.fn(() => 1),
}));
vi.mock("./particles", () => ({ createParticleSystem: () => effects }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useFxStore.setState({ queue: [], current: null, flash: null });
});

it("plays rain but skips burst for another ticker and leaves the board tappable", () => {
  useFxStore.setState({
    current: {
      cellId: "a", ticker: "TSLA", stake: 15, payout: 61.5,
      rate: 4.1, tier: "medium", atMs: 0,
    },
  });
  const center = vi.fn(() => ({ x: 1, y: 1 }));
  const { container } = render(
    <FxCanvas viewingTicker="NVDA" cellCenter={center} reducedMotion />,
  );
  expect(center).not.toHaveBeenCalled();
  expect(effects.burst).not.toHaveBeenCalled();
  expect(effects.rain).toHaveBeenCalledWith(1000, 15);
  expect(container.querySelector("canvas")?.style.pointerEvents).toBe("none");
});

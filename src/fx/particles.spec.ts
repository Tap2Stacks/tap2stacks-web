import { expect, it, vi } from "vitest";
import { createParticleSystem } from "./particles";

it("accelerates falling coins under gravity", () => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  const system = createParticleSystem(1);
  system.rain(2000, 1);
  const ys: number[] = [];
  const gradient = { addColorStop: vi.fn() };
  const context = {
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), rotate: vi.fn(),
    scale: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    stroke: vi.fn(), fillText: vi.fn(),
    createLinearGradient: () => gradient,
  } as unknown as CanvasRenderingContext2D;
  vi.mocked(context.translate).mockImplementation((_x, y) => { ys.push(y); });
  system.step(1000);
  system.draw(context);
  system.step(100);
  system.draw(context);
  system.step(100);
  system.draw(context);
  expect(ys[2] - ys[1]).toBeGreaterThan(ys[1] - ys[0]);
  vi.restoreAllMocks();
});

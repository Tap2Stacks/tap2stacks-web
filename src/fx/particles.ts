import { THEME } from "../ui/theme";
import type { Tier } from "./tiers";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  life: number;
  age: number;
  radius: number;
  delay: number;
  angle: number;
  spin: number;
  rain: boolean;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function drawCoin(ctx: CanvasRenderingContext2D, particle: Particle): void {
  const progress = Math.max(0, particle.age - particle.delay) / particle.life;
  const fade = Math.min(1, Math.max(0, (1 - progress) / 0.3));
  const bottomFade = particle.rain
    ? Math.min(1, Math.max(0, (window.innerHeight - particle.y) / 80))
    : 1;
  const radius = particle.radius;
  ctx.save();
  ctx.globalAlpha = fade * bottomFade;
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.angle * 0.15);
  ctx.scale(Math.max(0.08, Math.abs(Math.cos(particle.angle))), 1);
  const gradient = ctx.createLinearGradient(-radius, -radius, radius, radius);
  gradient.addColorStop(0, THEME.coinLight);
  gradient.addColorStop(1, THEME.coinDark);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = THEME.ink;
  ctx.stroke();
  ctx.fillStyle = THEME.ink;
  ctx.font = `bold ${radius * 1.15}px ${THEME.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", 0, 0);
  ctx.restore();
}

export function createParticleSystem(maxParticles = 150) {
  let particles: Particle[] = [];
  const cap = Math.max(0, Math.min(150, maxParticles));

  function add(particle: Particle): void {
    if (particles.length < cap) particles.push(particle);
  }

  function burst(x: number, y: number, tier: Tier): void {
    const count = tier === "small" ? 6 : tier === "medium" ? 14 : 24;
    for (let i = 0; i < count; i += 1) {
      const angle = randomBetween(0, Math.PI * 2);
      const speed = randomBetween(140, 360);
      add({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 200,
        gravity: 1400,
        drag: 0.25,
        life: randomBetween(700, 1100),
        age: 0,
        radius: randomBetween(6, 10),
        delay: 0,
        angle: randomBetween(0, Math.PI * 2),
        spin: randomBetween(-12, 12),
        rain: false,
      });
    }
  }

  function rain(durationMs: number, count: number): void {
    for (let i = 0; i < count; i += 1) {
      const delay = Math.random() * durationMs * 0.45;
      const life = Math.max(1, durationMs - delay);
      const gravity = randomBetween(180, 360);
      const seconds = life / 1000;
      const distance = window.innerHeight + 30;
      const vy = Math.max(50, (distance - 0.5 * gravity * seconds ** 2) / seconds);
      add({
        x: Math.random() * window.innerWidth,
        y: randomBetween(-35, -10),
        vx: randomBetween(-30, 30),
        vy,
        gravity,
        drag: 0,
        life,
        age: 0,
        radius: randomBetween(6, 10),
        delay,
        angle: randomBetween(0, Math.PI * 2),
        spin: randomBetween(-10, 10),
        rain: true,
      });
    }
  }

  function step(dtMs: number): void {
    const elapsed = Math.max(0, dtMs);
    particles = particles.filter((particle) => {
      const oldAge = particle.age;
      particle.age += elapsed;
      const activeMs = Math.max(0, particle.age - Math.max(oldAge, particle.delay));
      const dt = activeMs / 1000;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt + 0.5 * particle.gravity * dt * dt;
      particle.vx *= Math.exp(-particle.drag * dt);
      particle.vy = particle.vy * Math.exp(-particle.drag * dt) + particle.gravity * dt;
      particle.angle += particle.spin * dt;
      return particle.age < particle.life + particle.delay;
    });
  }

  function draw(ctx: CanvasRenderingContext2D): void {
    for (const particle of particles) {
      if (particle.age >= particle.delay) drawCoin(ctx, particle);
    }
  }

  return { burst, rain, step, count: () => particles.length, draw };
}

import type { Tier } from './tiers';
import { THEME } from '../ui/theme';
interface Particle { x:number; y:number; vx:number; vy:number; life:number; age:number; radius:number; delay:number }
export function createParticleSystem(maxParticles = 150) {
  let particles: Particle[] = [];
  const add = (p: Particle) => { if (particles.length < Math.max(0, Math.min(150,maxParticles))) particles.push(p); };
  return {
    burst(x:number,y:number,tier:Tier) {
      const n = tier === 'small' ? 6 : tier === 'medium' ? 12 : 20;
      for (let i=0;i<n;i++) { const a = Math.PI * 2 * i / n; add({x,y,vx:Math.cos(a)*150,vy:Math.sin(a)*150-70,life:900,age:0,radius:6,delay:0}); }
    },
    rain(durationMs:number,count:number) {
      for (let i=0;i<count;i++) { const delay=Math.random()*durationMs*.45; const life=durationMs-delay; add({x:Math.random()*window.innerWidth,y:-15,vx:(Math.random()-.5)*35,vy:(window.innerHeight+40)/Math.max(0.3,life/1000),life,age:0,radius:5+Math.random()*5,delay}); }
    },
    step(dtMs:number) {
      const dt=Math.max(0,dtMs); particles = particles.filter(p => { p.age+=dt; if(p.age > p.delay) { p.x+=p.vx*dt/1000; p.y+=p.vy*dt/1000; } return p.age < p.life+p.delay; });
    },
    count: () => particles.length,
    draw(ctx:CanvasRenderingContext2D) {
      for (const p of particles) { if(p.age < p.delay) continue; ctx.beginPath(); ctx.fillStyle=THEME.coinLight; ctx.strokeStyle=THEME.coinDark; ctx.lineWidth=2; ctx.ellipse(p.x,p.y,p.radius,p.radius*.72,0,0,Math.PI*2); ctx.fill(); ctx.stroke(); }
    },
  };
}

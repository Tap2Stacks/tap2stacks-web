import { useEffect, useRef } from 'react';
import { useFxStore } from './fxStore';
import { createParticleSystem } from './particles';
import { rainCoinCount, rainDurationMs } from './tiers';
import { THEME } from '../ui/theme';
export const FX_SHAKE_CLASS = 'fx-shake';
export function FxCanvas({viewingTicker, cellCenter, reducedMotion}: {viewingTicker:string; cellCenter:(cellId:string)=>{x:number;y:number}|null; reducedMotion?:boolean}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const system = useRef(createParticleSystem());
  const current = useFxStore(s => s.current);
  const advance = useFxStore(s => s.advance);
  const reduce = reducedMotion ?? (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) ?? false;
  useEffect(() => {
    if (!current) return;
    const point = current.ticker === viewingTicker ? cellCenter(current.cellId) : null;
    if (point) system.current.burst(point.x,point.y,current.tier);
    const duration = current.tier === 'small' ? 900 : rainDurationMs(current.payout,reduce);
    if (current.tier !== 'small') system.current.rain(duration,rainCoinCount(current.tier,current.payout,reduce));
    const started = performance.now();
    const timer = window.setTimeout(() => advance(Date.now()),duration);
    let frame = 0, previous = started;
    const draw = (now:number) => {
      const el=canvas.current, ctx=el?.getContext('2d');
      if (!el || !ctx) return;
      const dpr=Math.min(2,window.devicePixelRatio || 1), w=window.innerWidth, h=window.innerHeight;
      if(el.width !== w*dpr || el.height !== h*dpr) { el.width=w*dpr; el.height=h*dpr; }
      ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
      system.current.step(Math.min(50,now-previous)); previous=now; system.current.draw(ctx);
      if(point && !reduce && current.tier !== 'small' && now-started < 600) { ctx.beginPath(); ctx.strokeStyle=THEME.highlight; ctx.lineWidth=3; ctx.globalAlpha=1-(now-started)/600; ctx.arc(point.x,point.y,10+(now-started)/15,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1; }
      frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);
    return () => { clearTimeout(timer); cancelAnimationFrame(frame); };
  },[current,viewingTicker,cellCenter,reduce,advance]);
  return <canvas ref={canvas} aria-hidden="true" style={{position:'fixed',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:100}} />;
}

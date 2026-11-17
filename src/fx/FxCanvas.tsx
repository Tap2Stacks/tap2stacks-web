import { useEffect, useRef, useState } from 'react';
import { useFxStore } from './fxStore';
import { createParticleSystem } from './particles';
import { rainCoinCount, rainDurationMs } from './tiers';
import { THEME } from '../ui/theme';
export const FX_SHAKE_CLASS = 'fx-shake';
export function FxCanvas({viewingTicker, cellCenter, reducedMotion}: {viewingTicker:string; cellCenter:(cellId:string)=>{x:number;y:number}|null; reducedMotion?:boolean}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const system = useRef(createParticleSystem());
  const centerRef=useRef(cellCenter); centerRef.current=cellCenter;
  const tickerRef=useRef(viewingTicker); tickerRef.current=viewingTicker;
  const ring=useRef<{x:number;y:number;started:number}|null>(null);
  const current = useFxStore(s => s.current);
  const advance = useFxStore(s => s.advance);
  const [osReduced,setOsReduced]=useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const reduce = reducedMotion ?? osReduced;
  const reduceRef=useRef(reduce); reduceRef.current=reduce;
  useEffect(()=>{ const media=window.matchMedia?.('(prefers-reduced-motion: reduce)'); if(!media) return; const update=()=>setOsReduced(media.matches); media.addEventListener('change',update); return ()=>media.removeEventListener('change',update); },[]);
  useEffect(() => {
    let frame=0, previous=performance.now();
    const draw = (now:number) => {
      const el=canvas.current, ctx=el?.getContext('2d');
      if (!el || !ctx) return;
      const dpr=Math.min(2,window.devicePixelRatio || 1), w=window.innerWidth, h=window.innerHeight;
      if(el.width !== w*dpr || el.height !== h*dpr) { el.width=w*dpr; el.height=h*dpr; }
      ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
      system.current.step(Math.min(50,now-previous)); previous=now; system.current.draw(ctx);
      const r=ring.current;
      if(r && now-r.started < 600) { ctx.beginPath(); ctx.strokeStyle=THEME.highlight; ctx.lineWidth=3; ctx.globalAlpha=1-(now-r.started)/600; ctx.arc(r.x,r.y,10+(now-r.started)/15,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1; }
      else ring.current=null;
      frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  },[]);
  useEffect(() => {
    if (!current) return;
    const point = current.ticker === tickerRef.current ? centerRef.current(current.cellId) : null;
    const reduce=reduceRef.current;
    if (point) system.current.burst(point.x,point.y,current.tier);
    if(point && !reduce && current.tier !== 'small') ring.current={...point,started:performance.now()};
    const duration = current.tier === 'small' ? 900 : rainDurationMs(current.payout,reduce);
    if (current.tier !== 'small') system.current.rain(duration,rainCoinCount(current.tier,current.payout,reduce));
    const timer = window.setTimeout(() => advance(Date.now()),duration);
    return () => clearTimeout(timer);
  },[current,advance]);
  return <canvas ref={canvas} aria-hidden="true" style={{position:'fixed',inset:0,width:'100%',height:'100%',pointerEvents:'none',zIndex:100}} />;
}

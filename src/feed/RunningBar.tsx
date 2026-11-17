import { useEffect, useRef, useState } from 'react';
import { getRecentFeed } from '../api/feed';
import { onTradeFeed } from '../realtime/bus';
import { THEME } from '../ui/theme';
import { formatEntry, useFeedStore } from './feedStore';
function shortAddress(address:string|null):string|null { const a=address?.toLowerCase(); return a ? `0x${a.slice(2,6)}..${a.slice(-2)}` : null; }
export function RunningBar({ownAddress}:{ownAddress:string|null}) {
  const entries=useFeedStore(s=>s.entries), add=useFeedStore(s=>s.add), seed=useFeedStore(s=>s.seed);
  const row=useRef<HTMLDivElement>(null), [width,setWidth]=useState(0);
  useEffect(()=>{ let active=true; const unsubscribe=onTradeFeed(add); void getRecentFeed().then(entries=>{if(active) seed(entries);}); return ()=>{active=false; unsubscribe();}; },[add,seed]);
  useEffect(()=>{ const el=row.current; if(!el) return; const measure=()=>setWidth(el.scrollWidth); measure(); if(typeof ResizeObserver === 'undefined') return; const observer=new ResizeObserver(measure); observer.observe(el); return ()=>observer.disconnect(); },[entries]);
  const own=shortAddress(ownAddress);
  const items=(duplicate:boolean)=>[...entries].reverse().map(entry=>{ const item=formatEntry(entry,own); return <span key={entry.id} style={{display:'inline-flex',alignItems:'center',gap:8,whiteSpace:'nowrap',padding:'7px 14px',background:item.tone==='big'?THEME.highlight:'transparent',color:item.tone==='loss'?THEME.loss:item.tone==='win'||item.tone==='big'?THEME.win:THEME.ink,opacity:item.tone==='loss'?.65:1}}><b>{item.who}</b>{item.bot && <small>bot</small>}<span>{item.text}</span><b>{item.amount}</b>{duplicate && null}</span>; });
  return <div aria-label="Recent trades" className="running-bar" style={{overflowX:'auto',fontFamily:THEME.font,background:THEME.paper}}><div className="running-bar-track" style={{display:'flex',width:'max-content',animationDuration:`${Math.max(width/40,1)}s`}}><div ref={row} style={{display:'flex'}}>{items(false)}</div><div aria-hidden="true" className="running-bar-copy" style={{display:'flex'}}>{items(true)}</div></div></div>;
}

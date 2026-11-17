import { useFxStore } from './fxStore';
export function WinBanner() {
  const moment = useFxStore(s => s.current);
  if (!moment) return null;
  return <div aria-live="polite" style={{position:'fixed',top:'20%',left:'50%',transform:'translateX(-50%)',zIndex:101,pointerEvents:'none',textAlign:'center',color:'#2F6B34',fontWeight:800,fontSize:moment.tier === 'big' ? 48 : 32,textShadow:'0 2px #F4EBE0'}}><div>+${moment.payout.toFixed(2)}</div><div style={{fontSize:16}}>x{moment.rate.toFixed(1)} on ${moment.stake}</div></div>;
}

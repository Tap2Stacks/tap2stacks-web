import {act,cleanup,renderHook} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {useBalanceDisplay} from './useBalanceDisplay';
import {useFxStore} from '../fx/fxStore';
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('counts up a win over its rain duration and applies losses directly',()=>{
 vi.useFakeTimers();vi.spyOn(performance,'now').mockReturnValue(0);
 let frame:FrameRequestCallback=()=>{};
 vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{frame=cb;return 1;});
 vi.stubGlobal('cancelAnimationFrame',()=>{});
 useFxStore.setState({current:null,queue:[],flash:null});
 const {result,rerender}=renderHook(({balance})=>useBalanceDisplay(balance),{initialProps:{balance:100}});
 act(()=>useFxStore.setState({current:{cellId:'c',ticker:'NVDA',stake:10,payout:50,rate:5,tier:'medium',atMs:0}}));
 rerender({balance:150});act(()=>vi.advanceTimersByTime(0));act(()=>frame(500));
 expect(result.current).toBeGreaterThan(100);expect(result.current).toBeLessThan(150);
 act(()=>frame(1500));expect(result.current).toBe(150);
 act(()=>useFxStore.setState({current:null}));rerender({balance:80});act(()=>vi.advanceTimersByTime(0));act(()=>frame(1501));expect(result.current).toBe(80);
});

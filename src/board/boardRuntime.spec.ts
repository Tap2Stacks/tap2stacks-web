import {afterEach,expect,it,vi} from 'vitest';
import {BoardRuntime} from './boardRuntime';
import {timeToX} from './layout';
import {useGameStore} from '../store';
import {recordingContext} from '../test/recordingContext';
import {testCell} from './fixtures';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it('caps DPR, keeps all quoted columns visible, pauses hidden frames and resumes',()=>{
 let frame:FrameRequestCallback=()=>{},hidden=false;
 vi.stubGlobal('requestAnimationFrame',vi.fn((cb:FrameRequestCallback)=>{frame=cb;return 1;}));vi.stubGlobal('cancelAnimationFrame',vi.fn());vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 vi.spyOn(document,'hidden','get').mockImplementation(()=>hidden);vi.spyOn(Date,'now').mockReturnValue(10000);vi.stubGlobal('devicePixelRatio',3);
 const el=document.createElement('canvas');vi.spyOn(el,'getBoundingClientRect').mockReturnValue({width:1000,height:600} as DOMRect);
 useGameStore.setState({ticker:'NVDA',currentPrice:155,cells:[testCell({timeWindowEnd:45000})],stacks:{},serverTimeOffset:0});
 const runtime=new BoardRuntime(el,recordingContext().ctx,()=>undefined);
 try{frame(0);expect(el.width).toBe(2000);expect(timeToX(runtime.viewport!,45000)).toBeCloseTo(1000);hidden=true;document.dispatchEvent(new Event('visibilitychange'));const count=vi.mocked(requestAnimationFrame).mock.calls.length;frame(16);expect(requestAnimationFrame).toHaveBeenCalledTimes(count);hidden=false;document.dispatchEvent(new Event('visibilitychange'));expect(requestAnimationFrame).toHaveBeenCalledTimes(count+1);}finally{runtime.dispose();}
});
it('keeps historical x coordinates continuous as the six-column quote horizon rolls',()=>{
 let frame:FrameRequestCallback=()=>{};let wall=14999;
 vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{frame=cb;return 1;});vi.stubGlobal('cancelAnimationFrame',()=>{});vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.spyOn(document,'hidden','get').mockReturnValue(false);vi.spyOn(Date,'now').mockImplementation(()=>wall);
 const el=document.createElement('canvas');vi.spyOn(el,'getBoundingClientRect').mockReturnValue({width:1000,height:600} as DOMRect);
 useGameStore.setState({ticker:'NVDA',currentPrice:155,cells:[testCell({timeWindowEnd:45000})],stacks:{},serverTimeOffset:0});
 const runtime=new BoardRuntime(el,recordingContext().ctx,()=>undefined);
 try{frame(0);const before=timeToX(runtime.viewport!,5000);wall=15000;useGameStore.setState({cells:[testCell({timeWindowEnd:50000})]});frame(1);expect(Math.abs(timeToX(runtime.viewport!,5000)-before)).toBeLessThan(.1);expect(timeToX(runtime.viewport!,50000)).toBeCloseTo(1000);}finally{runtime.dispose();}
});
it('cellCenter returns client coordinates only for visible cells of the current ticker',()=>{
 let frame:FrameRequestCallback=()=>{};
 vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{frame=cb;return 1;});vi.stubGlobal('cancelAnimationFrame',()=>{});vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.spyOn(document,'hidden','get').mockReturnValue(false);vi.spyOn(Date,'now').mockReturnValue(10000);
 const el=document.createElement('canvas');vi.spyOn(el,'getBoundingClientRect').mockReturnValue({left:40,top:80,width:1000,height:600} as DOMRect);
 const visible=testCell();const other=testCell({id:'other',original:{...visible.original,ticker:'TSLA'}});const hidden=testCell({id:'hidden',original:{...visible.original,lowerPrice:'900',upperPrice:'901'}});
 useGameStore.setState({ticker:'NVDA',currentPrice:155,cells:[visible,other,hidden],stacks:{},serverTimeOffset:0});
 const runtime=new BoardRuntime(el,recordingContext().ctx,()=>undefined);
 try{expect(runtime.cellCenter(visible.id)).toBeNull();frame(0);expect(runtime.cellCenter(visible.id)?.x).toBeCloseTo(490);expect(runtime.cellCenter(visible.id)?.y).toBeCloseTo(365);expect(runtime.cellCenter(other.id)).toBeNull();expect(runtime.cellCenter(hidden.id)).toBeNull();expect(runtime.cellCenter('missing')).toBeNull();}finally{runtime.dispose();}
});

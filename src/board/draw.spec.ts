import { describe, it, expect } from 'vitest';
import { drawBoard, type BoardScene } from './draw';
import { recordingContext } from '../test/recordingContext';
import { testCell } from './fixtures';
const scene: BoardScene = { viewport: { width: 1000, height: 600, nowMs: 10000, nowFraction: 0.3, msPerPx: 50, pricePerPx: .001, centerPrice: 155 }, cells: [testCell()], line: [{ x: 0, y: 300 }, { x: 300, y: 290 }], livePrice: 155.12, stacks: {} };
describe('drawBoard', () => {
    it('draws each open cell multiplier as x4.1 and price to 2 decimals', () => { const { ctx, calls } = recordingContext(); drawBoard(ctx, scene); expect(calls.some(c => c.name === 'fillText' && c.args[0] === 'x4.1')).toBe(true); expect(calls.some(c => c.args[0] === '155.12')).toBe(true); });
    it('line uses bezierCurveTo, never lineTo between samples', () => { const { ctx, calls } = recordingContext(); drawBoard(ctx, scene); expect(calls.some(c => c.name === 'bezierCurveTo')).toBe(true); expect(calls.some(c => c.name === 'lineTo')).toBe(false); });
    it('locked cells are drawn without heat and dimmed', () => { const { ctx, calls } = recordingContext(); drawBoard(ctx, { ...scene, cells: [testCell({ timeWindowStart: 11000 })] }); const rect = calls.find(c => c.name === 'fillRect' && c.args[0] !== 0); expect(rect?.alpha).toBeLessThan(1); expect(rect?.fill).toBe('#F4EBE0'); });
});
it('drawStack draws a count badge x3 and the total $15', () => { const { ctx, calls } = recordingContext(); drawBoard(ctx, { ...scene, stacks: { [scene.cells[0].id]: { cellId: scene.cells[0].id, ticker: 'NVDA', coins: ['a', 'b', 'c'].map(clientTapId => ({ clientTapId, amount: 5, rate: 4.1, status: 'open', placedAt: 0 })) } } }); expect(calls.some(c => c.args[0] === 'x3')).toBe(true); expect(calls.some(c => c.args[0] === '$15')).toBe(true); });
it('animates settlements in local time despite server clock offset and fades pending additions',()=>{
 const {ctx,calls}=recordingContext();const cell=scene.cells[0];
 const coins=['a','b','c','d'].map((clientTapId,i)=>({clientTapId,amount:5,rate:4.1,status:i===3?'pending' as const:'open' as const,placedAt:10000}));
 drawBoard(ctx,{...scene,viewport:{...scene.viewport,nowMs:70000},animationNowMs:10100,stacks:{[cell.id]:{cellId:cell.id,ticker:'NVDA',coins}}});expect(calls.some(c=>c.name==='ellipse'&&c.alpha===.5)).toBe(true);
 calls.length=0;drawBoard(ctx,{...scene,viewport:{...scene.viewport,nowMs:70000},animationNowMs:10100,stacks:{[cell.id]:{cellId:cell.id,ticker:'NVDA',coins:coins.map(c=>({...c,status:'lost',updatedAt:10000}))}}});expect(calls.some(c=>c.args[0]==='$20')).toBe(true);
});

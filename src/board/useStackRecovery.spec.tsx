import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { useGameStore } from '../store';
import { customClient } from '../services/custom-client';
import { useStackRecovery } from './useStackRecovery';
vi.mock('../services/custom-client', () => ({ customClient: vi.fn() }));
it('rebuilds stacks from open orders after reconnect', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    let reconnect = () => { };
    const socket = { connected: false, on: vi.fn((_: string, cb: () => void) => { reconnect = cb; }), off: vi.fn() };
    useGameStore.setState({ socket: socket as unknown as Socket, wssKey: 'abcd', stacks: {} });
    vi.mocked(customClient).mockResolvedValue([{ cellId: 'c', orderId: '1', status: 'OPEN', amount: 5 }, { cellId: 'c', orderId: '2', status: 'OPEN', amount: 10 }, { cellId: 'd', orderId: '3', status: 'OPEN', amount: 1 }]);
    function Mount() { useStackRecovery(); return null; }
    const el = document.createElement('div'), root = createRoot(el);
    try {
        await act(async () => root.render(<Mount />));
        await act(async () => reconnect());
        expect(useGameStore.getState().stacks.c.coins).toHaveLength(2);
        expect(useGameStore.getState().stacks.d.coins).toHaveLength(1);
    }
    finally {
        act(() => root.unmount());
        useGameStore.setState({ socket: null, wssKey: null });
        vi.unstubAllGlobals();
    }
});
it('retries instead of overwriting taps received while recovery is in flight',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);let resolve:((value:unknown)=>void)=()=>{};
 vi.mocked(customClient).mockReset();vi.mocked(customClient).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 vi.mocked(customClient).mockResolvedValueOnce([{cellId:'new',clientTapId:'tap',orderId:'o',status:'OPEN',amount:5}]);
 const socket={connected:true,on:vi.fn(),off:vi.fn()};useGameStore.setState({socket:socket as unknown as Socket,wssKey:'abcd',stacks:{}});
 function Mount(){useStackRecovery();return null;}const root=createRoot(document.createElement('div'));
 try{await act(async()=>root.render(<Mount/>));useGameStore.getState().addPendingCoin('new','NVDA',{clientTapId:'tap',amount:5,rate:4.1,status:'pending',placedAt:Date.now()});await act(async()=>resolve([]));expect(customClient).toHaveBeenCalledTimes(2);expect(useGameStore.getState().stacks.new.coins[0].status).toBe('open');}
 finally{act(()=>root.unmount());useGameStore.setState({socket:null,wssKey:null});vi.unstubAllGlobals();}
});

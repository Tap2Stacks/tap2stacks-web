import {expect,it} from 'vitest';
import {useGameStore} from '../store';
it('store snapshots replace obsolete stacks and update coins immutably through all transitions',()=>{
 const store=useGameStore;store.setState({stacks:{}});
 store.getState().addPendingCoin('c','NVDA',{clientTapId:'a',amount:5,rate:4.1,status:'pending',placedAt:0});
 const pending=store.getState().stacks;
 store.getState().updateOrder({cellId:'c',clientTapId:'a',orderId:'o',status:'OPEN'});
 expect(pending.c.coins[0].status).toBe('pending');expect(store.getState().stacks.c.coins[0].status).toBe('open');
 store.getState().setOpenBets([{cellId:'d',orderId:'next',ticker:'TSLA',status:'OPEN',amount:10}]);
 expect(store.getState().stacks.c).toBeUndefined();expect(store.getState().stacks.d.coins[0].amount).toBe(10);
 store.getState().addPendingCoin('e','NVDA',{clientTapId:'timeout',amount:5,rate:2,status:'pending',placedAt:0});
 store.getState().expirePendingCoins(5001);expect(store.getState().stacks.e.coins[0].status).toBe('rejected');
 store.getState().updateOrder({cellId:'d',orderId:'next',status:'VOIDED'});expect(store.getState().stacks.d.coins[0].status).toBe('void');
});

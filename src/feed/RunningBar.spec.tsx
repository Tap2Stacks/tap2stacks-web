import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RunningBar } from './RunningBar';
import { useFeedStore } from './feedStore';
vi.mock('../api/feed', () => ({ getRecentFeed: vi.fn(async () => [{id:'a',ticker:'NVDA',playerShort:'0x1234..ab',isBot:true,multiplier:'4.1',stake:'5',payout:'20.5',result:'win',big:false,ts:1}]) }));
afterEach(() => { cleanup(); useFeedStore.setState({entries:[]}); });
it('seeds on mount and shows bot', async () => { render(<RunningBar ownAddress={null}/>); await waitFor(()=>expect(screen.getAllByText('bot').length).toBeGreaterThan(0)); });

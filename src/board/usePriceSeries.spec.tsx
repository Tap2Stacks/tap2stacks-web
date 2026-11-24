import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { fetchRecentPrices } from "../api/prices";
import { useGameStore } from "../store";
import { usePriceSeries } from "./usePriceSeries";
vi.mock("../api/prices", () => ({ fetchRecentPrices: vi.fn() }));
afterEach(cleanup);
it("seeds the reference on load but never overwrites a newer live reference or erases it on fallback", async () => {
    let resolve: (value: Awaited<ReturnType<typeof fetchRecentPrices>>) => void = () => {
    };
    vi.mocked(fetchRecentPrices).mockImplementation(() => new Promise(r => {
        resolve = r;
    }));
    useGameStore.setState({ prevDayPx: {} });
    const { unmount } = renderHook(() => usePriceSeries("NVDA"));
    await act(async () => resolve({ prevDayPx: 154, points: [] }));
    expect(useGameStore.getState().prevDayPx.NVDA).toBe(154);
    unmount();
    const live = renderHook(() => usePriceSeries("NVDA"));
    act(() => useGameStore.getState().setPrevDayPx("NVDA", 155));
    await act(async () => resolve({ prevDayPx: 153, points: [] }));
    expect(useGameStore.getState().prevDayPx.NVDA).toBe(155);
    live.unmount();
    renderHook(() => usePriceSeries("NVDA"));
    await act(async () => resolve({ prevDayPx: null, points: [], source: "deribit-perp-index" }));
    expect(useGameStore.getState().prevDayPx.NVDA).toBe(155);
    expect(useGameStore.getState().priceSource).toBe("deribit-perp-index");
});

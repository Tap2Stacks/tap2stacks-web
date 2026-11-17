import { useEffect } from "react";
import { fetchRecentPrices } from "../api/prices";
import { useGameStore } from "../store";
import { onPrice } from "../realtime/bus";
import { seriesFor } from "./priceSeries";
export function usePriceSeries(ticker: string): void {
    useEffect(() => {
        let alive = true;
        const reference = useGameStore.getState().prevDayPx[ticker];
        void fetchRecentPrices(ticker).then(data => {
            if (!alive)
                return;
            seriesFor(ticker).seed(data.points);
            const state = useGameStore.getState();
            if (data.prevDayPx !== null && state.prevDayPx[ticker] === reference)
                state.setPrevDayPx(ticker, data.prevDayPx);
        });
        return () => {
            alive = false;
        };
    }, [ticker]);
    useEffect(() => onPrice((t, ts, price) => seriesFor(t).push(ts, price)), []);
}

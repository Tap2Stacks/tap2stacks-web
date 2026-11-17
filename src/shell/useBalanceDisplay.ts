import { useEffect, useRef, useState } from "react";
import { useFxStore } from "../fx/fxStore";
import { countUp } from "../fx/countUp";
import { rainDurationMs } from "../fx/tiers";
import { useReducedMotion } from "./useReducedMotion";
export function useBalanceDisplay(balance: number): number {
    const current = useFxStore(s => s.current);
    const reduced = useReducedMotion();
    const [shown, setShown] = useState(balance);
    const value = useRef(balance);
    useEffect(() => {
        let frame = 0;
        const from = value.current;
        const started = performance.now();
        const duration = current && balance > from ? rainDurationMs(current.payout, reduced) : 0;
        const draw = (now: number) => {
            value.current = countUp(from, balance, duration, now - started);
            setShown(value.current);
            if (now - started < duration)
                frame = requestAnimationFrame(draw);
        };
        const timer = setTimeout(() => {
            frame = requestAnimationFrame(draw);
        }, balance > from && !current ? 320 : 0);
        return () => {
            clearTimeout(timer);
            cancelAnimationFrame(frame);
        };
    }, [balance, current, reduced]);
    return shown;
}

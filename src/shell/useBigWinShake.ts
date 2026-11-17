import { useEffect, useState } from "react";
import { useFxStore } from "../fx/fxStore";
import { useReducedMotion } from "./useReducedMotion";
export function useBigWinShake(): boolean {
    const current = useFxStore(s => s.current);
    const reduced = useReducedMotion();
    const [active, setActive] = useState(false);
    useEffect(() => {
        if (current?.tier !== "big" || reduced)
            return;
        const start = setTimeout(() => setActive(true), 0);
        const end = setTimeout(() => setActive(false), 350);
        return () => {
            clearTimeout(start);
            clearTimeout(end);
        };
    }, [current, reduced]);
    return active && !reduced && current?.tier === "big";
}

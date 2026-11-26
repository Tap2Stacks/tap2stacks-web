export function recordingContext() {
    const calls: {
        name: string;
        args: unknown[];
        alpha: number;
        fill: unknown;
    }[] = [];
    const target: Record<string, unknown> = { globalAlpha: 1, fillStyle: '', measureText: () => ({ width: 50 }) };
    const makeGradient = (name: string, args: unknown[]) => {
        const stops: { offset: number; color: string }[] = [];
        calls.push({ name, args: [...args, stops], alpha: target.globalAlpha as number, fill: target.fillStyle });
        return { addColorStop: (offset: number, color: string) => { stops.push({ offset, color }); } };
    };
    target.createLinearGradient = (...args: unknown[]) => makeGradient('createLinearGradient', args);
    target.createRadialGradient = (...args: unknown[]) => makeGradient('createRadialGradient', args);
    const ctx = new Proxy(target, { get(t, key: string) { if (key in t)
            return t[key]; return (...args: unknown[]) => calls.push({ name: key, args, alpha: t.globalAlpha as number, fill: t.fillStyle }); } });
    return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

export function recordingContext() {
    const calls: {
        name: string;
        args: unknown[];
        alpha: number;
        fill: unknown;
    }[] = [];
    const target: Record<string, unknown> = { globalAlpha: 1, fillStyle: '', measureText: () => ({ width: 50 }), createLinearGradient: () => ({ addColorStop: () => { } }) };
    const ctx = new Proxy(target, { get(t, key: string) { if (key in t)
            return t[key]; return (...args: unknown[]) => calls.push({ name: key, args, alpha: t.globalAlpha as number, fill: t.fillStyle }); } });
    return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

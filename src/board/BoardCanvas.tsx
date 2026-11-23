import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useGameStore, type CellData } from '../store';
import { THEME } from '../ui/theme';
import type { BoardScene } from './draw';
import { usePriceSeries } from './usePriceSeries';
import { useStackRecovery } from './useStackRecovery';
import { registerBoardCenters } from './centers';
import { BoardRuntime, type BoardHudState } from './boardRuntime';

const DRAG_THRESHOLD_PX = 8;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_RADIUS_PX = 28;
const VELOCITY_STALE_MS = 85;
const PINCH_PAN_THRESHOLD_PX = 18;

interface GestureState {
    pointers: Map<number, { x: number; y: number }>;
    primaryId: number | null;
    downX: number;
    downY: number;
    lastX: number;
    lastY: number;
    lastMoveTime: number;
    vx: number;
    vy: number;
    didDrag: boolean;
    wasPinch: boolean;
    pinchDist: number;
    pinchMidX: number;
    pinchMidY: number;
    pinchStartMidX: number;
    pinchStartMidY: number;
    lastTap: { x: number; y: number; time: number } | null;
}

function createGestureState(): GestureState {
    return {
        pointers: new Map(),
        primaryId: null,
        downX: 0,
        downY: 0,
        lastX: 0,
        lastY: 0,
        lastMoveTime: 0,
        vx: 0,
        vy: 0,
        didDrag: false,
        wasPinch: false,
        pinchDist: 0,
        pinchMidX: 0,
        pinchMidY: 0,
        pinchStartMidX: 0,
        pinchStartMidY: 0,
        lastTap: null,
    };
}

function twoPointerMetrics(pointers: Map<number, { x: number; y: number }>) {
    const iter = pointers.values();
    const a = iter.next().value!;
    const b = iter.next().value!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return {
        dist: Math.hypot(dx, dy),
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
    };
}

export function BoardCanvas({ onTapCell, flash }: {
    onTapCell: (cell: CellData) => void;
    flash?: BoardScene['flash'];
}) {
    useStackRecovery();
    const canvas = useRef<HTMLCanvasElement>(null);
    const runtime = useRef<BoardRuntime | null>(null);
    const gesture = useRef<GestureState>(createGestureState());
    const flashRef = useRef(flash);
    const onTapCellRef = useRef(onTapCell);
    const [hud, setHud] = useState<BoardHudState>({ following: true, zoomed: false });

    useLayoutEffect(() => {
        flashRef.current = flash;
        onTapCellRef.current = onTapCell;
    }, [flash, onTapCell]);

    const ticker = useGameStore(s => s.ticker);
    usePriceSeries(ticker);

    useEffect(() => {
        const el = canvas.current!;
        const ctx = el.getContext('2d');
        if (!ctx) return;
        const board = new BoardRuntime(el, ctx, () => flashRef.current, setHud);
        runtime.current = board;
        const unregister = registerBoardCenters(id => board.cellCenter(id));

        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            const r = el.getBoundingClientRect();
            const v = board.viewport;
            if (!v || r.width <= 0 || r.height <= 0) return;

            // Horizontal trackpad pan (without pinch ctrlKey)
            if (!event.ctrlKey && Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.25 && Math.abs(event.deltaX) > 2) {
                board.panBy(-event.deltaX, 0);
                return;
            }

            const sensitivity = event.ctrlKey ? 0.01 : 0.0022;
            const factor = Math.max(0.75, Math.min(1.35, Math.exp(-event.deltaY * sensitivity)));
            const canvasX = (event.clientX - r.left) * v.width / r.width;
            const canvasY = (event.clientY - r.top) * v.height / r.height;
            const factorTime = event.shiftKey ? 1 : factor;
            const factorPrice = event.altKey ? 1 : factor;
            board.zoomAt(factorTime, factorPrice, canvasX, canvasY);
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', onWheel);
            unregister();
            board.dispose();
            runtime.current = null;
        };
    }, []);

    const toCanvasCoords = (clientX: number, clientY: number) => {
        const el = canvas.current;
        const v = runtime.current?.viewport;
        if (!el || !v) return { x: clientX, y: clientY };
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return { x: 0, y: 0 };
        return {
            x: (clientX - r.left) * v.width / r.width,
            y: (clientY - r.top) * v.height / r.height,
        };
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const g = gesture.current;
        const el = event.currentTarget;
        try {
            el.setPointerCapture?.(event.pointerId);
        } catch {
            // Synthetic test events may not have an active pointerId
        }
        g.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (g.pointers.size === 1) {
            g.primaryId = event.pointerId;
            g.downX = event.clientX;
            g.downY = event.clientY;
            g.lastX = event.clientX;
            g.lastY = event.clientY;
            g.lastMoveTime = event.timeStamp || Date.now();
            g.vx = 0;
            g.vy = 0;
            g.didDrag = false;
            g.wasPinch = false;
        } else if (g.pointers.size === 2) {
            if (g.didDrag) {
                runtime.current?.endDrag(0, 0);
            }
            g.wasPinch = true;
            g.didDrag = false;
            const m = twoPointerMetrics(g.pointers);
            g.pinchDist = m.dist;
            g.pinchMidX = m.midX;
            g.pinchMidY = m.midY;
            g.pinchStartMidX = m.midX;
            g.pinchStartMidY = m.midY;
        }
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const g = gesture.current;
        if (!g.pointers.has(event.pointerId)) return;
        g.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const board = runtime.current;
        if (!board) return;

        if (g.pointers.size >= 2) {
            const m = twoPointerMetrics(g.pointers);
            if (g.pinchDist > 8 && m.dist > 8) {
                const scale = Math.max(0.7, Math.min(1.4, m.dist / g.pinchDist));
                const anchor = toCanvasCoords(m.midX, m.midY);
                board.zoomAt(scale, scale, anchor.x, anchor.y);
            }
            const dMidX = m.midX - g.pinchMidX;
            const dMidY = m.midY - g.pinchMidY;
            const totalShift = Math.hypot(m.midX - g.pinchStartMidX, m.midY - g.pinchStartMidY);
            if ((!board.isFollowing || totalShift > PINCH_PAN_THRESHOLD_PX) && (Math.abs(dMidX) > 0 || Math.abs(dMidY) > 0)) {
                board.dragBy(dMidX, dMidY);
            }
            g.pinchDist = m.dist;
            g.pinchMidX = m.midX;
            g.pinchMidY = m.midY;
            return;
        }

        if (g.wasPinch || event.pointerId !== g.primaryId) return;

        const now = event.timeStamp || Date.now();
        if (!g.didDrag) {
            const travel = Math.hypot(event.clientX - g.downX, event.clientY - g.downY);
            if (travel < DRAG_THRESHOLD_PX) return;
            g.didDrag = true;
            g.lastTap = null;
            board.beginDrag();
            board.dragBy(event.clientX - g.downX, event.clientY - g.downY);
        } else {
            const dx = event.clientX - g.lastX;
            const dy = event.clientY - g.lastY;
            const dt = Math.max(1, now - g.lastMoveTime);
            const instVx = dx / dt;
            const instVy = dy / dt;
            g.vx = g.vx * 0.45 + instVx * 0.55;
            g.vy = g.vy * 0.45 + instVy * 0.55;
            board.dragBy(dx, dy);
        }
        g.lastX = event.clientX;
        g.lastY = event.clientY;
        g.lastMoveTime = now;
    };

    const finishPointer = (event: React.PointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
        const g = gesture.current;
        if (!g.pointers.has(event.pointerId)) return;
        g.pointers.delete(event.pointerId);
        const board = runtime.current;

        if (g.pointers.size === 1) {
            // Transitioning from 2-finger pinch to 1 finger: re-anchor without jumping
            const [remainingId, pos] = g.pointers.entries().next().value!;
            g.primaryId = remainingId;
            g.lastX = pos.x;
            g.lastY = pos.y;
            g.downX = pos.x;
            g.downY = pos.y;
            return;
        }

        if (g.pointers.size > 0) return;

        const wasDrag = g.didDrag;
        const wasPinch = g.wasPinch;
        const now = event.timeStamp || Date.now();
        const stale = now - g.lastMoveTime > VELOCITY_STALE_MS;
        const vx = stale ? 0 : g.vx;
        const vy = stale ? 0 : g.vy;

        g.primaryId = null;
        g.didDrag = false;
        g.wasPinch = false;
        g.vx = 0;
        g.vy = 0;

        if (!board) return;

        if (wasDrag) {
            board.endDrag(cancelled ? 0 : vx, cancelled ? 0 : vy);
            return;
        }

        if (wasPinch || cancelled) {
            board.endDrag(0, 0);
            return;
        }

        // Pure tap: never fired while dragging or pinching
        const hit = board.hitTest(event.clientX, event.clientY);
        if (hit?.tappable) {
            g.lastTap = null;
            onTapCellRef.current(hit.cell);
            return;
        }

        // Double-tap on non-tappable area (past, locked, empty, or beyond horizon) snaps back to Live
        const prev = g.lastTap;
        if (
            prev &&
            now - prev.time <= DOUBLE_TAP_MS &&
            Math.hypot(event.clientX - prev.x, event.clientY - prev.y) <= DOUBLE_TAP_RADIUS_PX
        ) {
            g.lastTap = null;
            board.snapToLive();
        } else {
            g.lastTap = { x: event.clientX, y: event.clientY, time: now };
        }
    };

    const showLiveButton = !hud.following || hud.zoomed;

    return (
        <div
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                userSelect: 'none',
                WebkitUserSelect: 'none',
            }}
        >
            <canvas
                ref={canvas}
                aria-label="Live price and tap board"
                style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    touchAction: 'none',
                    cursor: hud.following ? 'crosshair' : 'grab',
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={event => finishPointer(event, false)}
                onPointerCancel={event => finishPointer(event, true)}
            />
            {showLiveButton && (
                <button
                    type="button"
                    aria-label="Return to live view"
                    onClick={() => runtime.current?.snapToLive()}
                    style={{
                        position: 'absolute',
                        top: 10,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 10,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 12px',
                        borderRadius: 999,
                        border: `1.5px solid ${THEME.ink}`,
                        background: THEME.ink,
                        color: THEME.paper,
                        fontFamily: THEME.font,
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(29, 27, 24, 0.22)',
                    }}
                >
                    <span
                        aria-hidden="true"
                        style={{
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: THEME.winOnInk,
                            display: 'inline-block',
                        }}
                    />
                    Live
                </button>
            )}
        </div>
    );
}

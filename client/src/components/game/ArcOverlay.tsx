import { useState, useEffect, useCallback, useRef } from 'react';
import { getDiscardPosition, getPlayerGridPosition } from '../../utils/positionRegistry.ts';

interface ArcEvent {
  id: number;
  type: 'success' | 'fail';
  playerId: string;
  phase: 'drawing' | 'holding' | 'fading' | 'done';
  path: string;
  midX: number;
  midY: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  pathLength: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface ArcOverlayProps {
  readonly socket: any;
}

let nextId = 0;

export default function ArcOverlay({ socket }: ArcOverlayProps) {
  const [arcs, setArcs] = useState<ArcEvent[]>([]);
  const [flashes, setFlashes] = useState<Map<string, 'red'>>(new Map());
  const pathRefs = useRef<Map<number, SVGPathElement>>(new Map());

  const addArc = useCallback((type: 'success' | 'fail', playerId: string) => {
    const from = getPlayerGridPosition(playerId);
    const to = getDiscardPosition();
    if (!from || !to) return;

    const midX = (from.x + to.x) / 2;
    const midY = Math.min(from.y, to.y) - 80;
    const path = `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;

    const id = nextId++;
    const arc: ArcEvent = {
      id, type, playerId, phase: 'drawing', path,
      midX, midY,
      startX: from.x, startY: from.y,
      endX: to.x, endY: to.y,
      pathLength: 0,
    };

    setArcs((prev) => [...prev, arc]);

    if (type === 'fail') {
      setFlashes((prev) => new Map(prev).set(playerId, 'red'));
      setTimeout(() => setFlashes((prev) => {
        const next = new Map(prev);
        next.delete(playerId);
        return next;
      }), 400);
    }

    // Timeline: draw 300ms → hold 150ms → fade 200ms → done
    setTimeout(() => setArcs((prev) => prev.map((a) => a.id === id ? { ...a, phase: 'holding' } : a)), 300);
    setTimeout(() => setArcs((prev) => prev.map((a) => a.id === id ? { ...a, phase: 'fading' } : a)), 450);
    setTimeout(() => setArcs((prev) => prev.filter((a) => a.id !== id)), 650);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onSuccess = (data: unknown) => {
      const d = data as { matcherId: string };
      addArc('success', d.matcherId);
    };
    const onFail = (data: unknown) => {
      const d = data as { playerId: string };
      addArc('fail', d.playerId);
    };

    socket.on('game:matchSuccess', onSuccess);
    socket.on('game:matchFail', onFail);
    return () => {
      socket.off('game:matchSuccess', onSuccess);
      socket.off('game:matchFail', onFail);
    };
  }, [socket, addArc]);

  // Measure path lengths after render
  useEffect(() => {
    setArcs((prev) => prev.map((arc) => {
      const el = pathRefs.current.get(arc.id);
      if (el && arc.pathLength === 0) {
        return { ...arc, pathLength: el.getTotalLength() };
      }
      return arc;
    }));
  });

  if (arcs.length === 0 && flashes.size === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-50"
      style={{ width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0 }}
    >
      {arcs.map((arc) => {
        const isSuccess = arc.type === 'success';
        const color = isSuccess ? 'rgba(245,197,24,1)' : 'rgba(233,69,96,1)';
        const shadowColor = isSuccess ? 'rgba(245,197,24,0.8)' : 'rgba(233,69,96,0.8)';
        const len = arc.pathLength || 300;

        const dashOffset = arc.phase === 'drawing' ? 0 : 0;
        const opacity = arc.phase === 'fading' ? 0 : 1;

        return (
          <g key={arc.id}>
            <path
              ref={(el) => { if (el) pathRefs.current.set(arc.id, el); }}
              d={arc.path}
              fill="none"
              stroke={color}
              strokeWidth={2}
              filter={`drop-shadow(0 0 4px ${shadowColor})`}
              strokeDasharray={len}
              strokeDashoffset={arc.phase === 'drawing' ? 0 : dashOffset}
              style={{
                opacity,
                transition: `opacity 200ms ease, stroke-dashoffset 300ms ease`,
                animation: arc.pathLength > 0 ? `arcDraw 300ms ease forwards` : undefined,
              }}
            />

            {/* X indicator for failures at midpoint */}
            {arc.type === 'fail' && arc.phase !== 'drawing' && (
              <g
                transform={`translate(${arc.midX}, ${arc.midY})`}
                style={{
                  opacity: arc.phase === 'fading' ? 0 : 1,
                  transition: 'opacity 200ms ease, transform 200ms ease',
                }}
              >
                <line x1={-6} y1={-6} x2={6} y2={6} stroke="rgba(233,69,96,1)" strokeWidth={2.5} strokeLinecap="round" />
                <line x1={6} y1={-6} x2={-6} y2={6} stroke="rgba(233,69,96,1)" strokeWidth={2.5} strokeLinecap="round" />
              </g>
            )}
          </g>
        );
      })}

      {/* Grid flash overlays */}
      {Array.from(flashes.entries()).map(([playerId]) => {
        const pos = getPlayerGridPosition(playerId);
        if (!pos) return null;
        return (
          <rect
            key={`flash-${playerId}`}
            x={pos.x - 50} y={pos.y - 40}
            width={100} height={80}
            rx={8}
            fill="rgba(233,69,96,0.3)"
            style={{ animation: 'gridFlash 400ms ease' }}
          />
        );
      })}

      <style>{`
        @keyframes arcDraw {
          from { stroke-dashoffset: var(--path-len, 300); }
          to { stroke-dashoffset: 0; }
        }
        @keyframes gridFlash {
          0%, 100% { opacity: 0; }
          25%, 75% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </svg>
  );
}

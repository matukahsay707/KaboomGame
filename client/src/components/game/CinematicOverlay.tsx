import { useState, useEffect, useRef, useCallback } from 'react';
import type { Card as CardType } from '@kaboom/shared';
import { B2 } from '@letele/playing-cards';
import Card from './Card.tsx';
import { getPlayerGridPosition } from '../../utils/positionRegistry.ts';
import type { SoundName } from '../../hooks/useSound.tsx';

// ─── Types ───

interface PeekEvent {
  type: 'peek';
  peekingPlayerId: string;
  targetPlayerId: string;
  targetSlotIndex: number;
  revealedCard?: CardType;
}

interface TradeEvent {
  type: 'trade';
  tradingPlayerId: string;
  tradingSlotIndex: number;
  targetPlayerId: string;
  targetSlotIndex: number;
}

type CinematicEvent = PeekEvent | TradeEvent;

interface CinematicOverlayProps {
  readonly event: CinematicEvent | null;
  readonly localPlayerId: string;
  readonly onComplete: () => void;
  readonly playSound: (name: SoundName) => void;
}

// ─── Peek Animation ───

type PeekPhase = 'highlight' | 'lift' | 'hold' | 'return' | 'done';

function PeekCinematic({ event, localPlayerId, onComplete, playSound }: {
  event: PeekEvent;
  localPlayerId: string;
  onComplete: () => void;
  playSound: (name: SoundName) => void;
}) {
  const [phase, setPhase] = useState<PeekPhase>('highlight');
  const targetPos = getPlayerGridPosition(event.targetPlayerId);
  const isLocalPeeker = event.peekingPlayerId === localPlayerId;

  const cardW = Math.min(70, window.innerWidth * 0.09);
  const cardH = cardW * 1.4;

  useEffect(() => {
    playSound('peek10');

    const t1 = setTimeout(() => setPhase('lift'), 400);
    const t2 = setTimeout(() => setPhase('hold'), 1000);
    const t3 = setTimeout(() => setPhase('return'), 1600);
    const t4 = setTimeout(() => { setPhase('done'); onComplete(); }, 2000);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete, playSound]);

  if (phase === 'done' || !targetPos) return null;

  const isDimmed = phase !== 'highlight';
  const isLifted = phase === 'lift' || phase === 'hold';
  const isHolding = phase === 'hold';

  // Calculate tilt toward peeking player
  const peekerPos = getPlayerGridPosition(event.peekingPlayerId);
  let tiltDeg = 0;
  if (peekerPos && targetPos) {
    const dx = peekerPos.x - targetPos.x;
    tiltDeg = Math.max(-15, Math.min(15, dx * 0.05));
  }

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* Dim layer */}
      <div
        className="absolute inset-0 transition-opacity"
        style={{
          background: 'rgba(0,0,0,0.5)',
          opacity: isDimmed ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      />

      {/* Teal glow on target card position */}
      <div
        style={{
          position: 'absolute',
          left: targetPos.x,
          top: targetPos.y,
          width: cardW + 20,
          height: cardH + 20,
          transform: 'translate(-50%, -50%)',
          borderRadius: 12,
          boxShadow: phase === 'highlight'
            ? '0 0 30px rgba(29, 233, 182, 0.6), inset 0 0 20px rgba(29, 233, 182, 0.2)'
            : 'none',
          transition: 'box-shadow 400ms ease',
        }}
      />

      {/* The lifting card */}
      <div
        style={{
          position: 'absolute',
          left: targetPos.x,
          top: targetPos.y,
          width: cardW,
          height: cardH,
          transform: `translate(-50%, -50%) ${isLifted ? `translateY(-20px) scale(1.3) rotate(${tiltDeg}deg)` : 'scale(1)'}`,
          transition: isLifted
            ? 'transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'transform 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: isLifted ? '0 16px 40px rgba(0,0,0,0.5)' : 'none',
          zIndex: 61,
        }}
      >
        {isLocalPeeker && isHolding && event.revealedCard ? (
          <Card card={event.revealedCard} width={cardW} height={cardH} />
        ) : (
          <B2 className="w-full h-full" />
        )}
      </div>

      {/* Teal border glow around card */}
      {isLifted && (
        <div
          style={{
            position: 'absolute',
            left: targetPos.x,
            top: targetPos.y,
            width: cardW + 8,
            height: cardH + 8,
            transform: `translate(-50%, -50%) translateY(-20px)`,
            border: '2px solid rgba(29, 233, 182, 0.6)',
            borderRadius: 10,
            boxShadow: '0 0 20px rgba(29, 233, 182, 0.4)',
            transition: 'all 600ms ease',
            zIndex: 60,
          }}
        />
      )}
    </div>
  );
}

// ─── Trade Animation ───

type TradePhase = 'lift' | 'arc' | 'land' | 'highlight' | 'done';

function bezier(t: number, p0: number, p1: number, p2: number): number {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}

function TradeCinematic({ event, onComplete, playSound }: {
  event: TradeEvent;
  onComplete: () => void;
  playSound: (name: SoundName) => void;
}) {
  const [phase, setPhase] = useState<TradePhase>('lift');
  const [progress, setProgress] = useState(0);
  const [sparkles, setSparkles] = useState<{ x: number; y: number; id: number }[]>([]);
  const firedRef = useRef(false);

  const pos1 = getPlayerGridPosition(event.tradingPlayerId);
  const pos2 = getPlayerGridPosition(event.targetPlayerId);

  const cardW = Math.min(55, window.innerWidth * 0.07);
  const cardH = cardW * 1.4;

  useEffect(() => {
    // Phase 1: lift (500ms + 600ms hold)
    const t1 = setTimeout(() => {
      setPhase('arc');
      playSound('jackTrade');
    }, 1100);

    // Phase 2: arc (600ms via rAF)
    // Phase 3: land (400ms)
    // Phase 4: highlight (1000ms)

    return () => { clearTimeout(t1); };
  }, [playSound]);

  // Arc animation
  useEffect(() => {
    if (phase !== 'arc' || !pos1 || !pos2) return;

    const start = performance.now();
    const duration = 600;

    function tick(now: number) {
      const elapsed = now - start;
      let t = Math.min(1, elapsed / duration);
      t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setProgress(t);

      if (!firedRef.current && t >= 0.48) {
        firedRef.current = true;
      }

      if (elapsed < duration) {
        requestAnimationFrame(tick);
      } else {
        playSound('cardPlace');

        // Landing sparkles
        if (pos1 && pos2) {
          const now = Date.now();
          setSparkles([
            { x: pos2.x, y: pos2.y, id: now },
            { x: pos2.x - 15, y: pos2.y - 10, id: now + 1 },
            { x: pos2.x + 15, y: pos2.y - 10, id: now + 2 },
            { x: pos2.x, y: pos2.y + 12, id: now + 3 },
            { x: pos1.x, y: pos1.y, id: now + 4 },
            { x: pos1.x - 15, y: pos1.y - 10, id: now + 5 },
            { x: pos1.x + 15, y: pos1.y - 10, id: now + 6 },
            { x: pos1.x, y: pos1.y + 12, id: now + 7 },
          ]);
        }

        setPhase('land');
        setTimeout(() => {
          setSparkles([]);
          setPhase('highlight');
        }, 400);
        setTimeout(() => { setPhase('done'); onComplete(); }, 1400);
      }
    }

    requestAnimationFrame(tick);
  }, [phase, pos1, pos2, onComplete, playSound]);

  if (!pos1 || !pos2) return null;
  if (phase === 'done') return null;

  const isDimmed = true;
  const isLifted = phase === 'lift';
  const isArc = phase === 'arc';
  const isHighlight = phase === 'highlight';

  // Arc control point — 80px above midpoint
  const midX = (pos1.x + pos2.x) / 2;
  const midY = Math.min(pos1.y, pos2.y) - 80;

  // Card positions during arc
  let c1x = pos1.x, c1y = pos1.y;
  let c2x = pos2.x, c2y = pos2.y;
  let c1scale = 1, c2scale = 1;

  if (isLifted) {
    c1scale = 1.15;
    c2scale = 1.15;
  } else if (isArc) {
    c1x = bezier(progress, pos1.x, midX, pos2.x);
    c1y = bezier(progress, pos1.y, midY, pos2.y);
    c2x = bezier(progress, pos2.x, midX, pos1.x);
    c2y = bezier(progress, pos2.y, midY, pos1.y);
    const crossScale = 1 + Math.sin(progress * Math.PI) * 0.2;
    c1scale = crossScale;
    c2scale = crossScale;
  } else if (phase === 'land' || isHighlight) {
    // Cards have arrived at swapped positions
    c1x = pos2.x;
    c1y = pos2.y;
    c2x = pos1.x;
    c2y = pos1.y;
  }

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* Dim */}
      <div
        className="absolute inset-0"
        style={{
          background: 'rgba(0,0,0,0.5)',
          opacity: isDimmed ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      />

      {/* Card 1 — gold glow (trader's card) */}
      <div
        style={{
          position: 'absolute',
          left: c1x, top: c1y,
          width: cardW, height: cardH,
          transform: `translate(-50%, -50%) ${isLifted ? 'translateY(-15px)' : ''} scale(${c1scale})`,
          transition: isArc ? 'none' : 'all 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: isLifted ? '0 0 20px rgba(245,197,24,0.5)' : '0 8px 20px rgba(0,0,0,0.4)',
          zIndex: 62,
        }}
      >
        <B2 className="w-full h-full" />
      </div>

      {/* Card 2 — blue glow (target's card) */}
      <div
        style={{
          position: 'absolute',
          left: c2x, top: c2y,
          width: cardW, height: cardH,
          transform: `translate(-50%, -50%) ${isLifted ? 'translateY(-15px)' : ''} scale(${c2scale})`,
          transition: isArc ? 'none' : 'all 500ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          borderRadius: 8,
          overflow: 'hidden',
          boxShadow: isLifted ? '0 0 20px rgba(33,150,243,0.5)' : '0 8px 20px rgba(0,0,0,0.4)',
          zIndex: 62,
        }}
      >
        <B2 className="w-full h-full" />
      </div>

      {/* Landing sparkles */}
      {sparkles.map((s) => (
        <div
          key={s.id}
          style={{
            position: 'absolute',
            left: s.x, top: s.y,
            width: 8, height: 8,
            borderRadius: '50%',
            background: '#f5c518',
            transform: 'translate(-50%, -50%)',
            animation: 'sparkleRadiate 400ms ease-out forwards',
          }}
        />
      ))}

      {/* Highlight borders on swapped positions */}
      {isHighlight && (
        <>
          <div style={{
            position: 'absolute', left: pos2.x, top: pos2.y,
            width: cardW + 8, height: cardH + 8,
            transform: 'translate(-50%, -50%)',
            border: '2px solid rgba(245,197,24,0.5)',
            borderRadius: 10,
            animation: 'highlightFade 1000ms ease-out forwards',
          }} />
          <div style={{
            position: 'absolute', left: pos1.x, top: pos1.y,
            width: cardW + 8, height: cardH + 8,
            transform: 'translate(-50%, -50%)',
            border: '2px solid rgba(245,197,24,0.5)',
            borderRadius: 10,
            animation: 'highlightFade 1000ms ease-out forwards',
          }} />
        </>
      )}

      <style>{`
        @keyframes sparkleRadiate {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
        }
        @keyframes highlightFade {
          0% { opacity: 1; box-shadow: 0 0 12px rgba(245,197,24,0.4); }
          100% { opacity: 0; box-shadow: 0 0 0 rgba(245,197,24,0); }
        }
      `}</style>
    </div>
  );
}

// ─── Main Overlay ───

export default function CinematicOverlay({ event, localPlayerId, onComplete, playSound }: CinematicOverlayProps) {
  if (!event) return null;

  if (event.type === 'peek') {
    return (
      <PeekCinematic
        event={event}
        localPlayerId={localPlayerId}
        onComplete={onComplete}
        playSound={playSound}
      />
    );
  }

  if (event.type === 'trade') {
    return (
      <TradeCinematic
        event={event}
        onComplete={onComplete}
        playSound={playSound}
      />
    );
  }

  return null;
}

export type { CinematicEvent, PeekEvent, TradeEvent };

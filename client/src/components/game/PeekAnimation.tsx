import { useState, useEffect } from 'react';
import type { Card as CardType } from '@kaboom/shared';
import { B2 } from '@letele/playing-cards';
import Card from './Card.tsx';
import { getPeekPath, getOpponentPosition } from '../../utils/animationPath.ts';
import type { SoundName } from '../../hooks/useSound.tsx';

interface PeekAnimationProps {
  readonly card: CardType;
  readonly sourcePlayerId: string;
  readonly sourceSlotIndex: number;
  readonly localPlayerId: string;
  readonly opponentIds: readonly string[];
  readonly onComplete: () => void;
  readonly playSound: (name: SoundName) => void;
}

type Phase = 'lift' | 'travel' | 'hold' | 'return' | 'done';

export default function PeekAnimation({
  card, sourcePlayerId, sourceSlotIndex, localPlayerId, opponentIds,
  onComplete, playSound,
}: PeekAnimationProps) {
  const [phase, setPhase] = useState<Phase>('lift');
  const [showFace, setShowFace] = useState(false);

  const isMobile = window.innerWidth < 600;

  // Calculate source position on the table
  const isLocalCard = sourcePlayerId === localPlayerId;
  let sourceX = 50;
  let sourceY = 88;

  if (!isLocalCard) {
    const oppIdx = opponentIds.indexOf(sourcePlayerId);
    const oppCount = opponentIds.length;
    if (oppIdx >= 0) {
      const pos = getOpponentPosition(oppIdx, oppCount);
      sourceX = pos.x;
      sourceY = pos.y;
    }
  }

  const path = getPeekPath(sourceX, sourceY, isMobile);

  // Destination: where the card travels TO (toward the viewer)
  // For local cards: barely moves, just lifts
  // For opponent cards: arcs toward bottom-center
  const destX = isLocalCard ? 50 : 50 + path.dx * 5; // subtle offset toward center
  const destY = isLocalCard ? 70 : isMobile ? 50 : 60;

  useEffect(() => {
    playSound('cardFlip');

    const liftMs = 150;
    const travelMs = path.durationMs;
    const holdMs = 800;
    const returnMs = 400;

    const t1 = setTimeout(() => { setPhase('travel'); setShowFace(true); }, liftMs);
    const t2 = setTimeout(() => { setPhase('hold'); }, liftMs + travelMs);
    const t3 = setTimeout(() => { setPhase('return'); }, liftMs + travelMs + holdMs);
    const t4 = setTimeout(() => { playSound('cardPlace'); setPhase('done'); }, liftMs + travelMs + holdMs + returnMs);
    const t5 = setTimeout(onComplete, liftMs + travelMs + holdMs + returnMs + 50);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, [onComplete, playSound, path.durationMs]);

  if (phase === 'done') return null;

  const cardW = isMobile ? 70 : 80;
  const cardH = cardW * 1.4;

  // Position and transform per phase
  let x = sourceX;
  let y = sourceY;
  let scale = 1;
  let rotate = 0;
  let shadow = 'none';
  let transition = '';
  let showVignette = false;
  let showBlur = false;

  switch (phase) {
    case 'lift':
      scale = 1.3;
      y = sourceY - 2;
      shadow = '0 12px 30px rgba(0,0,0,0.4)';
      transition = 'all 150ms cubic-bezier(0.34, 1.56, 0.64, 1)';
      break;
    case 'travel':
      x = destX;
      y = destY;
      scale = path.holdScale;
      rotate = path.tiltDeg;
      shadow = '0 20px 60px rgba(0,0,0,0.5)';
      transition = `all ${path.durationMs}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
      showVignette = true;
      showBlur = true;
      break;
    case 'hold':
      x = destX;
      y = destY;
      scale = path.holdScale;
      rotate = path.tiltDeg;
      shadow = '0 20px 60px rgba(0,0,0,0.5)';
      transition = 'all 200ms ease';
      showVignette = true;
      showBlur = true;
      break;
    case 'return':
      x = sourceX;
      y = sourceY;
      scale = 1;
      rotate = 0;
      shadow = 'none';
      transition = 'all 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      break;
  }

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {/* Vignette */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: showVignette ? 1 : 0,
          background: `radial-gradient(circle at ${destX}% ${destY}%, transparent 12%, rgba(0,0,0,0.6) 55%)`,
        }}
      />

      {/* Blur layer */}
      <style>{`.game-table-content { filter: blur(${showBlur ? 2 : 0}px); transition: filter 300ms ease; }`}</style>

      {/* The animated card */}
      <div
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          width: cardW,
          height: cardH,
          transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotate}deg)`,
          boxShadow: shadow,
          borderRadius: 8,
          overflow: 'hidden',
          transition,
          animation: phase === 'hold' ? `peekBreathe_${sourcePlayerId} 1.5s ease-in-out infinite` : 'none',
          zIndex: 61,
        }}
      >
        {showFace && phase !== 'return' ? (
          <Card card={card} width={cardW} height={cardH} />
        ) : (
          <div className="w-full h-full"><B2 className="w-full h-full" /></div>
        )}
      </div>

      <style>{`
        @keyframes peekBreathe_${sourcePlayerId} {
          0%, 100% { transform: translate(-50%, -50%) scale(${scale}) rotate(${rotate}deg); }
          50% { transform: translate(-50%, -50%) scale(${scale * 1.015}) rotate(${rotate}deg); }
        }
      `}</style>
    </div>
  );
}

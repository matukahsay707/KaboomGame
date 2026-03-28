import { useState, useEffect, useRef } from 'react';
import { B2 } from '@letele/playing-cards';
import { getTradePath, getOpponentPosition } from '../../utils/animationPath.ts';
import type { SoundName } from '../../hooks/useSound.tsx';

interface TradeArcAnimationProps {
  readonly targetPlayerId: string;
  readonly opponentIds: readonly string[];
  readonly isQueen: boolean;
  readonly onComplete: () => void;
  readonly playSound: (name: SoundName) => void;
}

type Phase = 'arc' | 'landing' | 'done';

// Quadratic bezier interpolation
function bezier(t: number, p0: number, p1: number, p2: number): number {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}

export default function TradeArcAnimation({
  targetPlayerId, opponentIds, isQueen, onComplete, playSound,
}: TradeArcAnimationProps) {
  const [phase, setPhase] = useState<Phase>('arc');
  const [progress, setProgress] = useState(0);
  const firedRef = useRef(false);

  // Calculate opponent position
  const oppIdx = opponentIds.indexOf(targetPlayerId);
  const oppCount = opponentIds.length;
  const oppPos = oppIdx >= 0 ? getOpponentPosition(oppIdx, oppCount) : { x: 50, y: 20 };

  const tradePath = getTradePath(oppPos.x, oppPos.y);

  const cardW = Math.min(55, window.innerWidth * 0.07);
  const cardH = cardW * 1.4;

  // Local player position
  const localX = 50;
  const localY = 88;

  useEffect(() => {
    const start = performance.now();
    const duration = tradePath.durationMs;

    function tick(now: number) {
      const elapsed = now - start;
      // Ease in-out cubic
      let t = Math.min(1, elapsed / duration);
      t = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setProgress(t);

      // Fire sound at crossing (t ≈ 0.5)
      if (!firedRef.current && t >= 0.48) {
        firedRef.current = true;
        playSound(isQueen ? 'queenTrade' : 'jackTrade');
      }

      if (elapsed < duration) {
        requestAnimationFrame(tick);
      } else {
        setPhase('landing');
        playSound('cardPlace');
        setTimeout(() => { setPhase('done'); onComplete(); }, 200);
      }
    }

    requestAnimationFrame(tick);
  }, [tradePath.durationMs, onComplete, playSound, isQueen]);

  if (phase === 'done') return null;

  // Card 1 (yours): local → opponent, arcing through outArc control point
  const c1x = bezier(progress, localX, tradePath.outArcX, oppPos.x);
  const c1y = bezier(progress, localY, tradePath.outArcY, oppPos.y);
  const c1scale = phase === 'landing' ? 1 : 1 + Math.sin(progress * Math.PI) * 0.2;
  const c1rotate = progress * tradePath.tiltDeg;

  // Card 2 (theirs): opponent → local, arcing through inArc control point
  const c2x = bezier(progress, oppPos.x, tradePath.inArcX, localX);
  const c2y = bezier(progress, oppPos.y, tradePath.inArcY, localY);
  const c2scale = phase === 'landing' ? 1 : 1 + Math.sin(progress * Math.PI) * 0.2;
  const c2rotate = progress * -tradePath.tiltDeg;

  // Motion blur direction based on movement
  const blurAngle1 = Math.atan2(oppPos.y - localY, oppPos.x - localX);
  const blurAngle2 = Math.atan2(localY - oppPos.y, localX - oppPos.x);
  const blurLen = 12 * Math.sin(progress * Math.PI); // strongest at midpoint
  const shadow1 = `${-Math.cos(blurAngle1) * blurLen}px ${-Math.sin(blurAngle1) * blurLen}px ${blurLen}px rgba(0,0,0,0.4)`;
  const shadow2 = `${-Math.cos(blurAngle2) * blurLen}px ${-Math.sin(blurAngle2) * blurLen}px ${blurLen}px rgba(0,0,0,0.4)`;

  const landingBounce = phase === 'landing' ? 'translateY(-6px)' : '';
  const landingTransition = phase === 'landing' ? 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none';

  return (
    <div className="fixed inset-0 z-[55] pointer-events-none">
      {/* Card 1 — yours traveling to opponent */}
      <div
        className="absolute rounded-lg overflow-hidden"
        style={{
          width: cardW, height: cardH,
          left: `${c1x}%`, top: `${c1y}%`,
          transform: `translate(-50%, -50%) scale(${c1scale}) rotate(${c1rotate}deg) ${landingBounce}`,
          boxShadow: shadow1,
          transition: landingTransition,
          zIndex: 56,
        }}
      >
        <B2 className="w-full h-full" />
      </div>

      {/* Card 2 — theirs traveling to you */}
      <div
        className="absolute rounded-lg overflow-hidden"
        style={{
          width: cardW, height: cardH,
          left: `${c2x}%`, top: `${c2y}%`,
          transform: `translate(-50%, -50%) scale(${c2scale}) rotate(${c2rotate}deg) ${landingBounce}`,
          boxShadow: shadow2,
          transition: landingTransition,
          zIndex: 56,
        }}
      >
        <B2 className="w-full h-full" />
      </div>
    </div>
  );
}

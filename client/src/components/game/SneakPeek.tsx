import { useState, useEffect, useCallback } from 'react';
import type { Card as CardType } from '@kaboom/shared';
import Card from './Card.tsx';
import { B2 } from '@letele/playing-cards';
import type { SoundName } from '../../hooks/useSound.tsx';

interface SneakPeekProps {
  readonly bottomCards: readonly CardType[];
  readonly onDone: () => void;
  readonly playSound: (name: SoundName) => void;
}

const PEEK_DURATION = 10000; // 10 seconds

export default function SneakPeek({ bottomCards, onDone, playSound }: SneakPeekProps) {
  const [timeLeft, setTimeLeft] = useState(PEEK_DURATION);
  const [liftedCard, setLiftedCard] = useState<number>(-1); // -1 = none, 0 = first, 1 = second
  const [phase, setPhase] = useState<'intro' | 'lifting' | 'viewing' | 'closing'>('intro');
  const cardW = Math.min(100, window.innerWidth * 0.2);
  const cardH = cardW * 1.4;

  // Phase timeline
  useEffect(() => {
    // Brief intro
    const t1 = setTimeout(() => {
      setPhase('lifting');
      // Lift first card
      setLiftedCard(0);
      playSound('cardFlip');
    }, 800);

    // Lift second card
    const t2 = setTimeout(() => {
      setLiftedCard(1);
      playSound('cardFlip');
    }, 1400);

    // Both visible
    const t3 = setTimeout(() => {
      setPhase('viewing');
    }, 1800);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [playSound]);

  // Countdown timer
  useEffect(() => {
    if (phase !== 'viewing') return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        const next = t - 100;
        if (next <= 0) {
          clearInterval(interval);
          handleClose();
          return 0;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [phase]);

  const handleClose = useCallback(() => {
    if (phase === 'closing') return;
    setPhase('closing');
    // Cards lower back down
    setLiftedCard(-1);
    setTimeout(() => {
      onDone();
    }, 500);
  }, [phase, onDone]);

  const progress = timeLeft / PEEK_DURATION;
  const seconds = Math.ceil(timeLeft / 1000);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
      {/* No title banner — instruction comes from avatar speech bubble */}

      {/* Cards with 3D lift */}
      <div className="flex gap-4 sm:gap-6 mb-8" style={{ perspective: 600 }}>
        {[0, 1].map((idx) => {
          const isLifted = liftedCard >= idx;
          const card = bottomCards[idx];

          return (
            <div
              key={idx}
              className="relative transition-transform duration-500 ease-out"
              style={{
                width: cardW,
                height: cardH,
                transformStyle: 'preserve-3d',
                transform: isLifted
                  ? `rotateX(-25deg) translateY(-${cardW * 0.15}px) scale(1.05)`
                  : 'rotateX(0deg) translateY(0) scale(1)',
              }}
            >
              {/* Card back (visible when not lifted) */}
              <div
                className="absolute inset-0 rounded-lg overflow-hidden shadow-lg transition-opacity duration-400"
                style={{
                  opacity: isLifted ? 0 : 1,
                  backfaceVisibility: 'hidden',
                }}
              >
                <B2 className="w-full h-full" />
              </div>

              {/* Card face (visible when lifted) */}
              <div
                className="absolute inset-0 rounded-lg overflow-hidden transition-opacity duration-400"
                style={{
                  opacity: isLifted ? 1 : 0,
                  boxShadow: isLifted ? '0 12px 30px rgba(245, 197, 24, 0.3)' : 'none',
                }}
              >
                {card && <Card card={card} width={cardW} height={cardH} />}
              </div>

              {/* Slot label */}
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-500">
                Slot {idx + 3}
              </div>
            </div>
          );
        })}
      </div>

      {/* Timer + progress */}
      {phase === 'viewing' && (
        <div className="w-64 mb-6 animate-fade-in">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Time remaining</span>
            <span className={seconds <= 2 ? 'text-kaboom-accent font-bold' : ''}>{seconds}s</span>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-kaboom-gold rounded-full transition-all duration-100"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Close button */}
      {(phase === 'viewing' || phase === 'lifting') && (
        <button
          onClick={handleClose}
          className="btn-primary px-8 py-3 animate-fade-in"
        >
          I've memorized them!
        </button>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import type { Card as CardType } from '@kaboom/shared';
import Card from './Card.tsx';

interface MatchButtonProps {
  readonly discardedCard: CardType;
  readonly duration: number;
  readonly startTime: number;
  readonly onMatch: (slotIndex: number) => void;
  readonly playerCardCount: number;
}

export default function MatchButton({ discardedCard, duration, startTime, onMatch, playerCardCount }: MatchButtonProps) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, duration - (Date.now() - startTime));
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [duration, startTime]);

  const progress = timeLeft / duration;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 animate-slide-in">
      <div className="bg-kaboom-mid/95 backdrop-blur rounded-2xl p-4 shadow-2xl border border-kaboom-accent/50">
        <div className="flex items-center gap-4 mb-3">
          <Card card={discardedCard} width={50} height={70} />
          <div>
            <p className="font-bold text-sm">Match this card!</p>
            <div className="w-32 h-2 bg-gray-700 rounded-full mt-1 overflow-hidden">
              <div
                className="h-full bg-kaboom-accent rounded-full transition-all duration-100"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: playerCardCount }, (_, i) => (
            <button
              key={i}
              onClick={() => onMatch(i)}
              className="px-3 py-2 bg-kaboom-accent hover:bg-red-600 rounded-lg text-xs font-bold transition-colors min-h-[44px]"
            >
              Slot {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

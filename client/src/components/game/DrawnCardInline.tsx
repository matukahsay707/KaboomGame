import { useState, useEffect } from 'react';
import type { Card as CardType } from '@kaboom/shared';
import { RANK_ABILITIES } from '@kaboom/shared';
import Card from './Card.tsx';

interface DrawnCardInlineProps {
  readonly card: CardType;
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly onSwap: (slotIndex: number) => void;
  readonly onDiscard: () => void;
  readonly onUseSpecial?: () => void;
}

const ABILITY_LABELS: Record<string, string> = {
  peek: 'Peek',
  blindTrade: 'Blind Trade',
  peekAndTrade: 'Peek + Trade',
};

const AUTO_DISCARD_MS = 20000;

export default function DrawnCardInline({
  card, cardWidth, cardHeight, onSwap, onDiscard, onUseSpecial,
}: DrawnCardInlineProps) {
  const [timeLeft, setTimeLeft] = useState(AUTO_DISCARD_MS);

  // Auto-discard timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        const next = t - 100;
        if (next <= 0) {
          clearInterval(interval);
          onDiscard();
          return 0;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [onDiscard]);

  const ability = RANK_ABILITIES[card.rank];
  const abilityLabel = ability ? ABILITY_LABELS[ability] : null;
  const hoverW = cardWidth * 1.4;
  const hoverH = cardHeight * 1.4;
  const progress = timeLeft / AUTO_DISCARD_MS;

  return (
    <div className="flex flex-col items-center animate-slide-up">
      {/* Timer bar */}
      <div className="w-full max-w-[120px] h-1 bg-gray-700/50 rounded-full mb-1.5 overflow-hidden">
        <div
          className="h-full bg-kaboom-gold/60 rounded-full transition-all duration-100"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Hovering card with special badge */}
      <div className="relative">
        <div
          className="rounded-xl shadow-[0_8px_30px_rgba(245,197,24,0.25)] ring-2 ring-kaboom-gold/40 overflow-hidden"
          style={{ width: hoverW, height: hoverH }}
        >
          <Card card={card} width={hoverW} height={hoverH} />
        </div>

        {/* Special ability badge */}
        {abilityLabel && onUseSpecial && (
          <button
            onClick={onUseSpecial}
            className="absolute -top-2 -right-2 bg-kaboom-gold text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg hover:bg-yellow-300 active:scale-95 transition-all whitespace-nowrap z-10"
          >
            {abilityLabel}
          </button>
        )}
      </div>

      {/* Discard button */}
      <button
        onClick={onDiscard}
        className="mt-2 px-4 py-1.5 bg-gray-700/80 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition-colors backdrop-blur"
      >
        Discard
      </button>
    </div>
  );
}

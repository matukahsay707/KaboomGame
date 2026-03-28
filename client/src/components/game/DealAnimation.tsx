import { useState, useEffect, useRef } from 'react';
import { B2 } from '@letele/playing-cards';
import type { SoundName } from '../../hooks/useSound.tsx';

interface DealAnimationProps {
  readonly playerCount: number;
  readonly cardsPerPlayer: number;
  readonly onComplete: () => void;
  readonly playSound: (name: SoundName) => void;
}

interface FlyingCard {
  readonly id: number;
  readonly targetPlayer: number; // 0-based
  readonly targetSlot: number;   // 0-3
  readonly delay: number;        // ms
  readonly landed: boolean;
}

export default function DealAnimation({ playerCount, cardsPerPlayer, onComplete, playSound }: DealAnimationProps) {
  const [cards, setCards] = useState<readonly FlyingCard[]>([]);
  const [deckCount, setDeckCount] = useState(54);
  const completeRef = useRef(false);

  useEffect(() => {
    const allCards: FlyingCard[] = [];
    let id = 0;
    let delay = 400; // start after brief pause

    // Deal in rounds: one card per player per round
    for (let round = 0; round < cardsPerPlayer; round++) {
      for (let p = 0; p < playerCount; p++) {
        allCards.push({
          id: id++,
          targetPlayer: p,
          targetSlot: round,
          delay,
          landed: false,
        });
        delay += 200;
      }
    }

    setCards(allCards);

    // Schedule each card landing
    for (const card of allCards) {
      setTimeout(() => {
        playSound('cardDeal');
        setDeckCount((c) => Math.max(0, c - 1));
        setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, landed: true } : c));
      }, card.delay);
    }

    // Complete after all cards dealt + small buffer
    const totalDuration = delay + 600;
    setTimeout(() => {
      if (!completeRef.current) {
        completeRef.current = true;
        onComplete();
      }
    }, totalDuration);
  }, [playerCount, cardsPerPlayer, onComplete, playSound]);

  // Card size for flying cards
  const cardW = Math.min(60, window.innerWidth * 0.08);
  const cardH = cardW * 1.4;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      {/* Deck indicator in center */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
        style={{ width: cardW, height: cardH }}
      >
        {/* Stacked deck visual */}
        {Array.from({ length: Math.min(5, Math.ceil(deckCount / 10)) }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-lg overflow-hidden shadow-md"
            style={{
              width: cardW,
              height: cardH,
              top: -i * 1.5,
              left: -i * 0.5,
              opacity: 0.9 - i * 0.1,
            }}
          >
            <B2 className="w-full h-full" />
          </div>
        ))}
      </div>

      {/* Flying cards */}
      {cards.map((card) => {
        // Calculate target position based on player index
        // Player 0 = local (bottom), others = opponents on oval
        const oppCount = playerCount - 1;
        let targetX: string;
        let targetY: string;

        if (card.targetPlayer === 0) {
          // Local player — bottom center
          targetX = '50%';
          targetY = '85%';
        } else {
          // Opponent on the top half of oval
          const oppIdx = card.targetPlayer - 1;
          const t = oppCount === 1 ? 0.5 : oppIdx / (oppCount - 1);
          const angle = Math.PI + t * (0 - Math.PI);
          targetX = `${50 + 38 * Math.cos(angle)}%`;
          targetY = `${50 - 35 * Math.sin(angle)}%`;
        }

        return (
          <div
            key={card.id}
            className="absolute rounded-lg overflow-hidden shadow-lg"
            style={{
              width: cardW,
              height: cardH,
              left: card.landed ? targetX : '50%',
              top: card.landed ? targetY : '50%',
              transform: 'translate(-50%, -50%)',
              opacity: card.landed ? 1 : 0,
              transition: `left 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                           top 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                           opacity 0.15s ease`,
              zIndex: card.id + 10,
            }}
          >
            <B2 className="w-full h-full" />
          </div>
        );
      })}

      {/* "Dealing..." label */}
      <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 text-gray-400 text-sm font-medium animate-pulse">
        Dealing cards...
      </div>
    </div>
  );
}

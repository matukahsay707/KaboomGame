import { useEffect, useRef, useState } from 'react';
import type { Card as CardType } from '@kaboom/shared';
import Card from './Card.tsx';
import MatchCountdownRing from './MatchCountdownRing.tsx';
import { B2 } from '@letele/playing-cards';
import { registerPosition } from '../../utils/positionRegistry.ts';

interface CenterAreaProps {
  readonly discardTop: CardType | null;
  readonly drawPileCount: number;
  readonly onDrawDeck: () => void;
  readonly onDrawDiscard: () => void;
  readonly canDraw: boolean;
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly matchActive?: boolean;
  readonly matchDuration?: number;
  readonly matchStartTime?: number;
}

export default function CenterArea({
  discardTop,
  drawPileCount,
  onDrawDeck,
  onDrawDiscard,
  canDraw,
  cardWidth,
  cardHeight,
  matchActive = false,
  matchDuration = 4000,
  matchStartTime = 0,
}: CenterAreaProps) {
  const discardRef = useRef<HTMLDivElement>(null);
  const [showRipple, setShowRipple] = useState(false);
  const prevMatchActive = useRef(false);

  // Register discard pile position
  useEffect(() => {
    registerPosition('discard', discardRef.current);
  }, []);

  // Trigger bounce + ripple when match window opens
  useEffect(() => {
    if (matchActive && !prevMatchActive.current) {
      setShowRipple(true);
      const t = setTimeout(() => setShowRipple(false), 500);
      return () => clearTimeout(t);
    }
    prevMatchActive.current = matchActive;
  }, [matchActive]);

  return (
    <div className="flex items-center justify-center gap-4 sm:gap-6 transition-all duration-200">
      {/* Draw pile — dims during match */}
      <div className={`flex flex-col items-center ${matchActive ? 'match-dimmed' : 'match-undimmed'}`}>
        <button
          onClick={onDrawDeck}
          disabled={!canDraw}
          style={{ width: cardWidth, height: cardHeight }}
          className={`rounded-lg overflow-hidden
            ${canDraw ? 'cursor-pointer hover:scale-105 hover:ring-2 hover:ring-kaboom-gold deck-active' : 'opacity-50 cursor-not-allowed'}
            transition-all duration-200 shadow-lg`}
        >
          <B2 className="w-full h-full" />
        </button>
        <span className="text-[10px] text-gray-500 mt-0.5">{drawPileCount}</span>
      </div>

      {/* Discard pile — stays bright, gets bounce + ripple + ring */}
      <div className="flex flex-col items-center">
        {discardTop ? (
          <div ref={discardRef} className="relative">
            {/* The card with bounce on match */}
            <div className={matchActive ? 'animate-discard-bounce' : ''}>
              <div
                onClick={canDraw ? onDrawDiscard : undefined}
                className={`${canDraw ? 'hover:scale-105 cursor-pointer' : ''} transition-all duration-200 rounded-lg`}
              >
                <Card card={discardTop} width={cardWidth} height={cardHeight} />
              </div>
            </div>

            {/* Gold ripple — fires once */}
            {showRipple && (
              <div
                className="absolute inset-0 rounded-lg border-2 border-kaboom-gold animate-match-ripple"
                style={{ pointerEvents: 'none' }}
              />
            )}

            {/* Countdown ring */}
            {matchActive && matchStartTime > 0 && (
              <MatchCountdownRing
                duration={matchDuration}
                startTime={matchStartTime}
                size={Math.max(cardWidth, cardHeight)}
              />
            )}
          </div>
        ) : (
          <div
            ref={discardRef}
            style={{ width: cardWidth, height: cardHeight }}
            className="rounded-lg border-2 border-dashed border-gray-700/50 flex items-center justify-center"
          />
        )}
      </div>
    </div>
  );
}

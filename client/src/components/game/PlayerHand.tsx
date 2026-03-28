import { useEffect, useRef } from 'react';
import type { ClientPlayerState } from '@kaboom/shared';
import Card from './Card.tsx';
import { registerPosition } from '../../utils/positionRegistry.ts';

interface PlayerHandProps {
  readonly player: ClientPlayerState;
  readonly isCurrentPlayer: boolean;
  readonly isActive?: boolean;
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly onCardClick?: (slotIndex: number) => void;
  readonly selectedSlot?: number | null;
  readonly highlightedSlots?: readonly number[];
  readonly showDealAnimation?: boolean;
  readonly compact?: boolean;
  readonly matchMode?: boolean;
  readonly peekMode?: boolean;
  readonly kaboomLocked?: boolean;
  readonly isMobile?: boolean;
  readonly isDania?: boolean;
}

export default function PlayerHand({
  player,
  isCurrentPlayer,
  isActive = false,
  cardWidth,
  cardHeight,
  onCardClick,
  selectedSlot,
  highlightedSlots = [],
  showDealAnimation,
  compact = false,
  matchMode = false,
  peekMode = false,
  kaboomLocked = false,
  isMobile = false,
  isDania = false,
}: PlayerHandProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const gap = Math.max(2, cardWidth * 0.06);

  // Register grid position for arc overlay
  useEffect(() => {
    registerPosition(`grid-${player.id}`, gridRef.current);
  }, [player.id]);

  if (compact) {
    return (
      <div ref={gridRef} className="flex flex-col items-center gap-0.5">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
            isActive ? 'bg-kaboom-accent text-white ring-2 ring-kaboom-gold' : 'bg-kaboom-mid text-gray-300'
          } ${player.calledKaboom ? 'ring-2 ring-kaboom-gold' : ''}`}
        >
          {player.displayName.charAt(0).toUpperCase()}
        </div>
        <span className="text-[9px] text-gray-400 leading-tight truncate max-w-[48px]">
          {player.displayName.split(' ')[0]}
        </span>
      </div>
    );
  }

  const mainCards = player.cards.slice(0, 4);
  const penaltyCards = player.cards.slice(4);

  // Match mode classes for the grid container
  const matchGridClass = matchMode && isCurrentPlayer ? 'match-grid-active' : '';

  // Active turn: gold pulsing border for active player
  // Local player: subtle permanent gold border at 30% opacity
  let borderClass = '';
  if (isActive && !matchMode) {
    borderClass = 'ring-2 ring-kaboom-gold shadow-[0_0_12px_rgba(245,197,24,0.4)] animate-pulse';
  } else if (isCurrentPlayer) {
    borderClass = 'ring-1 ring-kaboom-gold/30';
  }

  return (
    <div className="flex flex-col items-center transition-all duration-200">
      <div
        ref={gridRef}
        className={`relative rounded-xl p-1 transition-all duration-200 ${borderClass} ${kaboomLocked ? 'opacity-60' : ''} ${matchGridClass}`}
      >
        {/* Kaboom lock overlay */}
        {kaboomLocked && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/20">
            <svg className="w-6 h-6 text-kaboom-gold" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}

        <div className="flex items-start" style={{ gap }}>
          <div className="grid grid-cols-2" style={{ gap }}>
            {mainCards.map((card, idx) => {
              const isMatchTarget = matchMode && isCurrentPlayer && !kaboomLocked && !!card;
              return (
                <div
                  key={idx}
                  className={`relative ${isMatchTarget ? (isMobile ? 'match-pulse-mobile' : 'hover:scale-110 hover:brightness-125') : ''} transition-transform duration-150`}
                >
                  {isMatchTarget && (
                    <div className="absolute inset-0 rounded-lg match-shimmer z-10 pointer-events-none" />
                  )}
                  <Card
                    card={card}
                    width={cardWidth}
                    height={cardHeight}
                    onClick={onCardClick && !kaboomLocked ? () => onCardClick(idx) : undefined}
                    selected={selectedSlot === idx}
                    highlighted={highlightedSlots.includes(idx)}
                    matchTappable={isMatchTarget}
                    peekTarget={peekMode && !kaboomLocked && !!card}
                    dealDelay={showDealAnimation ? idx : undefined}
                  />
                </div>
              );
            })}
          </div>

          {penaltyCards.length > 0 && (
            <div className="flex flex-col" style={{ gap }}>
              {penaltyCards.map((card, idx) => {
                const isMatchTarget = matchMode && isCurrentPlayer && !kaboomLocked && !!card;
                return (
                  <div
                    key={idx + 4}
                    className={`relative ${isMatchTarget ? (isMobile ? 'match-pulse-mobile' : 'hover:scale-110 hover:brightness-125') : ''} transition-transform duration-150`}
                  >
                    {isMatchTarget && (
                      <div className="absolute inset-0 rounded-lg match-shimmer z-10 pointer-events-none" />
                    )}
                    <Card
                      card={card}
                      width={cardWidth}
                      height={cardHeight}
                      onClick={onCardClick && !kaboomLocked ? () => onCardClick(idx + 4) : undefined}
                      selected={selectedSlot === idx + 4}
                      highlighted={highlightedSlots.includes(idx + 4)}
                      matchTappable={isMatchTarget}
                      peekTarget={peekMode && !kaboomLocked && !!card}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Opponent name — small, muted, below grid */}
      {!isCurrentPlayer && !compact && (
        <span className="text-[11px] text-gray-500 mt-1 truncate max-w-[80px] flex items-center gap-1">
          {player.displayName}
          {isDania && (
            <span className="inline-block w-[4px] h-[4px] rounded-full bg-red-500" style={{ animation: 'daniaPulse 2s ease-in-out infinite' }} />
          )}
        </span>
      )}
      <style>{`
        @keyframes daniaPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

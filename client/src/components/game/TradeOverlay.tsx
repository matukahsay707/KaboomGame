import { useState } from 'react';
import type { ClientGameState } from '@kaboom/shared';

interface TradeOverlayProps {
  readonly gameState: ClientGameState;
  readonly onTrade: (mySlot: number, targetPlayer: string, targetSlot: number) => void;
  readonly onSkip: () => void;
  readonly isBlind: boolean;
}

export default function TradeOverlay({ gameState, onTrade, onSkip, isBlind }: TradeOverlayProps) {
  const [mySlot, setMySlot] = useState<number | null>(null);
  const [targetPlayer, setTargetPlayer] = useState<string | null>(null);
  const [targetSlot, setTargetSlot] = useState<number | null>(null);

  const handleConfirm = () => {
    if (mySlot !== null && targetPlayer && targetSlot !== null) {
      onTrade(mySlot, targetPlayer, targetSlot);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-kaboom-mid rounded-2xl p-6 max-w-lg w-full mx-4 animate-slide-in max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-center mb-2">
          {isBlind ? 'Blind Trade' : 'Trade'}
        </h3>
        <p className="text-gray-400 text-sm text-center mb-4">
          {isBlind ? 'Pick your card and an opponent\'s card to swap (blind!)' : 'Choose cards to trade'}
        </p>

        {/* Your cards */}
        <div className="mb-4">
          <p className="text-sm text-gray-300 mb-2">Your card:</p>
          <div className="grid grid-cols-4 gap-2">
            {gameState.you.cards.map((card, idx) => (
              <button
                key={idx}
                onClick={() => card && setMySlot(idx)}
                disabled={!card}
                className={`w-14 h-20 rounded-lg bg-gradient-to-br from-kaboom-accent to-kaboom-green
                  border-2 ${mySlot === idx ? 'border-kaboom-gold ring-2 ring-kaboom-gold' : 'border-gray-600'}
                  flex items-center justify-center hover:scale-105 transition-all
                  disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                <span className="text-xs text-white">{idx + 1}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Opponent cards */}
        {gameState.opponents.map((opp) => (
          <div key={opp.id} className="mb-4">
            <p className="text-sm text-gray-300 mb-2">{opp.displayName}:</p>
            <div className="grid grid-cols-4 gap-2">
              {opp.cards.map((card, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (!card) return;
                    setTargetPlayer(opp.id);
                    setTargetSlot(idx);
                  }}
                  disabled={!card}
                  className={`w-14 h-20 rounded-lg bg-gradient-to-br from-kaboom-accent to-kaboom-green
                    border-2 ${targetPlayer === opp.id && targetSlot === idx ? 'border-kaboom-gold ring-2 ring-kaboom-gold' : 'border-gray-600'}
                    flex items-center justify-center hover:scale-105 transition-all
                    disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  <span className="text-xs text-white">{idx + 1}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleConfirm}
            disabled={mySlot === null || !targetPlayer || targetSlot === null}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            Confirm Trade
          </button>
          <button onClick={onSkip} className="btn-secondary flex-1">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

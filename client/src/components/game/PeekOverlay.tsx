import type { Card as CardType, ClientGameState } from '@kaboom/shared';
import Card from './Card.tsx';

interface PeekOverlayProps {
  readonly gameState: ClientGameState;
  readonly onSelectTarget: (playerId: string, slotIndex: number) => void;
  readonly onSkip: () => void;
  readonly peekedCard?: CardType | null;
}

export default function PeekOverlay({ gameState, onSelectTarget, onSkip, peekedCard }: PeekOverlayProps) {
  if (peekedCard) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-kaboom-mid rounded-2xl p-6 max-w-sm w-full mx-4 animate-slide-in">
          <h3 className="text-lg font-bold text-center mb-4">Peeked Card:</h3>
          <div className="flex justify-center mb-6">
            <Card card={peekedCard} width={100} height={140} />
          </div>
          <button onClick={onSkip} className="btn-primary w-full">
            Got it!
          </button>
        </div>
      </div>
    );
  }

  const allPlayers = [
    { id: gameState.you.id, name: gameState.you.displayName + ' (You)', cards: gameState.you.cards },
    ...gameState.opponents.map((o) => ({ id: o.id, name: o.displayName, cards: o.cards })),
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-kaboom-mid rounded-2xl p-6 max-w-lg w-full mx-4 animate-slide-in max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-center mb-2">Peek at a Card</h3>
        <p className="text-gray-400 text-sm text-center mb-4">
          Choose any card to peek at
        </p>

        {allPlayers.map((player) => (
          <div key={player.id} className="mb-4">
            <p className="text-sm text-gray-300 mb-2">{player.name}</p>
            <div className="grid grid-cols-4 gap-2">
              {player.cards.map((card, idx) => (
                <button
                  key={idx}
                  onClick={() => card && onSelectTarget(player.id, idx)}
                  disabled={!card}
                  className="w-14 h-20 rounded-lg bg-gradient-to-br from-kaboom-accent to-kaboom-green
                    border-2 border-gray-600 flex items-center justify-center
                    hover:border-kaboom-gold hover:scale-105 transition-all
                    disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="text-xs text-white">{idx + 1}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <button onClick={onSkip} className="w-full mt-4 px-4 py-2 text-gray-400 hover:text-white text-sm">
          Skip Ability
        </button>
      </div>
    </div>
  );
}

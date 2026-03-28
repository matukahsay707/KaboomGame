import type { Card as CardType } from '@kaboom/shared';
import Card from './Card.tsx';

interface DrawnCardOverlayProps {
  readonly card: CardType;
  readonly onSwap: (slotIndex: number) => void;
  readonly onDiscard: () => void;
  readonly playerCardCount: number;
}

export default function DrawnCardOverlay({ card, onSwap, onDiscard, playerCardCount }: DrawnCardOverlayProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-kaboom-mid/95 backdrop-blur rounded-2xl p-6 max-w-sm w-full mx-4 animate-slide-in border border-gray-700/50">
        <h3 className="text-lg font-bold text-center mb-4">You drew:</h3>
        <div className="flex justify-center mb-6">
          <Card card={card} width={100} height={140} />
        </div>
        <p className="text-gray-400 text-sm text-center mb-4">
          Tap a slot to swap, or discard this card.
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {Array.from({ length: playerCardCount }, (_, i) => (
            <button key={i} onClick={() => onSwap(i)} className="btn-secondary py-2 text-sm">
              Swap Slot {i + 1}
            </button>
          ))}
        </div>
        <button onClick={onDiscard} className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors">
          Discard
        </button>
      </div>
    </div>
  );
}

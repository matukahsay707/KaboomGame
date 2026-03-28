import type { GamePhase } from '@kaboom/shared';

interface TurnIndicatorProps {
  readonly phase: GamePhase;
  readonly activePlayerName: string | null;
  readonly isYourTurn: boolean;
  readonly kaboomCalled: boolean;
}

export default function TurnIndicator({ phase, activePlayerName, isYourTurn, kaboomCalled }: TurnIndicatorProps) {
  const getPhaseMessage = (): string => {
    switch (phase) {
      case 'PEEK_PHASE':
        return 'Peek at your bottom 2 cards!';
      case 'PLAYER_TURN':
        return isYourTurn ? 'Your turn — draw a card!' : `${activePlayerName}'s turn`;
      case 'SPECIAL_ACTION':
        return isYourTurn ? 'Use your special ability!' : `${activePlayerName} is using a special card`;
      case 'MATCH_WINDOW':
        return 'Match window open!';
      case 'KABOOM_FINAL':
        return isYourTurn ? 'Final turn! Draw a card!' : `${activePlayerName}'s final turn`;
      case 'REVEAL':
        return 'Revealing all cards...';
      case 'GAME_OVER':
        return 'Game Over!';
      default:
        return '';
    }
  };

  return (
    <div className={`text-center py-3 px-6 rounded-xl mb-4 ${
      isYourTurn ? 'bg-kaboom-accent/20 border border-kaboom-accent' : 'bg-kaboom-green/20 border border-kaboom-green'
    }`}>
      <p className="font-bold">{getPhaseMessage()}</p>
      {kaboomCalled && phase !== 'REVEAL' && phase !== 'GAME_OVER' && (
        <p className="text-kaboom-gold text-sm font-bold mt-1">KABOOM has been called! Final round!</p>
      )}
    </div>
  );
}

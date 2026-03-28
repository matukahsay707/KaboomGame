import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameState } from '../hooks/useGameState.tsx';
import { useAuth } from '../hooks/useAuth.tsx';
import GameBoard from '../components/game/GameBoard.tsx';
import ScoreBoard from '../components/game/ScoreBoard.tsx';

export default function GamePage() {
  const navigate = useNavigate();
  const { gameState, scores, winnerIds, leaveRoom, restartGame } = useGameState();
  const { user } = useAuth();

  useEffect(() => {
    if (!gameState) {
      navigate('/lobby');
    }
  }, [gameState, navigate]);

  if (!gameState) {
    return null;
  }

  const handleBackToLobby = () => {
    leaveRoom();
    navigate('/lobby');
  };

  if (scores && winnerIds) {
    return (
      <ScoreBoard
        scores={scores}
        winnerIds={winnerIds}
        currentUserId={user?.uid ?? ''}
        onBackToLobby={handleBackToLobby}
        onPlayAgain={restartGame}
      />
    );
  }

  return <GameBoard gameState={gameState} currentUserId={user?.uid ?? ''} onQuit={handleBackToLobby} />;
}

import { useContext } from 'react';
import { GameContext, type GameContextType } from '../contexts/GameContext.tsx';

export function useGameState(): GameContextType {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGameState must be used within GameProvider');
  return ctx;
}

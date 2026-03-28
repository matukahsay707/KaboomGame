import type { Card, GameState, MatchAttempt } from '@kaboom/shared';
import { GAME_CONFIG } from '@kaboom/shared';

export interface MatchResult {
  readonly success: boolean;
  readonly matcherId: string;
  readonly slotIndex: number;
  readonly matchedCard?: Card;
}

function cardsMatch(card1: Card, card2: Card): boolean {
  // Both Jokers match each other
  if (card1.rank === 'Joker' && card2.rank === 'Joker') return true;
  // Same rank matches
  return card1.rank === card2.rank;
}

export function resolveMatchAttempt(
  gameState: GameState,
  playerId: string,
  slotIndex: number
): MatchResult {
  const matchWindow = gameState.matchWindow;
  if (!matchWindow) {
    return { success: false, matcherId: playerId, slotIndex };
  }

  const now = Date.now();
  const elapsed = now - matchWindow.startTime;

  // Check if window has expired
  if (elapsed > matchWindow.duration) {
    return { success: false, matcherId: playerId, slotIndex };
  }

  // Find the player and their card
  const player = gameState.players.find((p) => p.id === playerId);
  if (!player) {
    return { success: false, matcherId: playerId, slotIndex };
  }

  const playerCard = player.cards[slotIndex];
  if (!playerCard) {
    return { success: false, matcherId: playerId, slotIndex };
  }

  // Check if the card matches the discarded card
  if (!cardsMatch(playerCard, matchWindow.discardedCard)) {
    return { success: false, matcherId: playerId, slotIndex };
  }

  return {
    success: true,
    matcherId: playerId,
    slotIndex,
    matchedCard: playerCard,
  };
}

export function resolveSimultaneousAttempts(
  attempts: readonly MatchAttempt[]
): MatchAttempt | null {
  if (attempts.length === 0) return null;
  if (attempts.length === 1) return attempts[0];

  // Sort by timestamp
  const sorted = [...attempts].sort((a, b) => a.timestamp - b.timestamp);

  // Check if first two are within threshold
  if (sorted[1].timestamp - sorted[0].timestamp <= GAME_CONFIG.SIMULTANEOUS_THRESHOLD_MS) {
    // Random tiebreaker
    const tiedAttempts = sorted.filter(
      (a) => a.timestamp - sorted[0].timestamp <= GAME_CONFIG.SIMULTANEOUS_THRESHOLD_MS
    );
    const randomIndex = Math.floor(Math.random() * tiedAttempts.length);
    return tiedAttempts[randomIndex];
  }

  // First attempt wins
  return sorted[0];
}

export function isMatchWindowActive(matchWindow: GameState['matchWindow']): boolean {
  if (!matchWindow) return false;
  const elapsed = Date.now() - matchWindow.startTime;
  return elapsed <= matchWindow.duration;
}

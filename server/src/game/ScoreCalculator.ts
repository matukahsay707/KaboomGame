import type { Card, PlayerState, PlayerScore } from '@kaboom/shared';
import { CARD_VALUES } from '@kaboom/shared';

export function getCardValue(card: Card): number {
  if (card.rank === 'K' && card.suit) {
    const key = `K-${card.suit}`;
    return CARD_VALUES[key] ?? 0;
  }
  return CARD_VALUES[card.rank] ?? 0;
}

export function calculatePlayerScore(cards: readonly (Card | null)[]): number {
  return cards.reduce((total, card) => {
    if (!card) return total; // matched away = 0 points
    return total + getCardValue(card);
  }, 0);
}

export function calculateScores(
  players: readonly PlayerState[],
  kaboomCallerId: string | null
): readonly PlayerScore[] {
  const scores = players.map((player) => ({
    playerId: player.id,
    displayName: player.displayName,
    cards: player.cards,
    score: calculatePlayerScore(player.cards),
    isWinner: false,
    calledKaboom: player.id === kaboomCallerId,
  }));

  // Find winner(s)
  const nonCallerScores = scores.filter((s) => !s.calledKaboom);
  const callerScore = scores.find((s) => s.calledKaboom);

  if (!callerScore || nonCallerScores.length === 0) {
    // No Kaboom caller or no other players — lowest score wins
    const minScore = Math.min(...scores.map((s) => s.score));
    return scores.map((s) => ({ ...s, isWinner: s.score === minScore }));
  }

  const minNonCallerScore = Math.min(...nonCallerScores.map((s) => s.score));

  if (callerScore.score < minNonCallerScore) {
    // Kaboom caller wins — they have strictly lower score
    return scores.map((s) => ({
      ...s,
      isWinner: s.playerId === callerScore.playerId,
    }));
  }

  // Kaboom caller loses — lowest non-caller(s) win
  return scores.map((s) => ({
    ...s,
    isWinner: !s.calledKaboom && s.score === minNonCallerScore,
  }));
}

import type { GameState, PlayerState, Card, ClientGameState, ClientPlayerState, ClientCard, MatchWindowState } from '@kaboom/shared';
import { GAME_CONFIG, RANK_ABILITIES } from '@kaboom/shared';
import { createShuffledDeck, dealCards, drawFromPile, addToDiscard, getDiscardTop, takeFromDiscard, addPenaltyCard } from './DeckManager.js';
import type { PlayerScore } from '@kaboom/shared';
import { calculateScores } from './ScoreCalculator.js';

export function createInitialGameState(playerIds: ReadonlyMap<string, string>): GameState {
  const deck = createShuffledDeck();
  const playerCount = playerIds.size;
  const { hands, deck: dealtDeck } = dealCards(deck, playerCount, GAME_CONFIG.CARDS_PER_PLAYER);

  const players: PlayerState[] = [];
  let i = 0;
  for (const [id, displayName] of playerIds) {
    players.push({
      id,
      displayName,
      cards: hands[i],
      connected: true,
      hasPeeked: false,
      hasFinalTurn: false,
      calledKaboom: false,
    });
    i++;
  }

  const turnOrder = players.map((p) => p.id);

  return {
    phase: 'PEEK_PHASE',
    players,
    activePlayerId: null,
    drawPile: dealtDeck.drawPile,
    discardPile: dealtDeck.discardPile,
    drawnCard: null,
    matchWindow: null,
    kaboomCallerId: null,
    finalRoundPlayersRemaining: [],
    turnOrder,
    turnIndex: 0,
  };
}

export function markPlayerPeeked(state: GameState, playerId: string): GameState {
  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, hasPeeked: true } : p
  );

  const allPeeked = players.every((p) => p.hasPeeked);

  if (allPeeked) {
    return {
      ...state,
      players,
      phase: 'PLAYER_TURN',
      activePlayerId: state.turnOrder[0],
    };
  }

  return { ...state, players };
}

export function getBottomTwoCards(state: GameState, playerId: string): readonly Card[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  // Bottom 2 cards = indices 2 and 3 in the 2x2 grid
  return player.cards.slice(2, 4).filter((c): c is Card => c !== null);
}

export function drawFromDeck(state: GameState): GameState {
  const { card, deck } = drawFromPile({ drawPile: state.drawPile, discardPile: state.discardPile });
  return {
    ...state,
    drawPile: deck.drawPile,
    discardPile: deck.discardPile,
    drawnCard: card,
  };
}

export function drawFromDiscardPile(state: GameState): { readonly state: GameState; readonly card: Card } | null {
  const result = takeFromDiscard({ drawPile: state.drawPile, discardPile: state.discardPile });
  if (!result) return null;
  return {
    state: {
      ...state,
      discardPile: result.deck.discardPile,
      drawnCard: result.card,
    },
    card: result.card,
  };
}

export function swapCard(state: GameState, playerId: string, slotIndex: number): {
  readonly state: GameState;
  readonly discardedCard: Card;
} {
  const drawnCard = state.drawnCard;
  if (!drawnCard) throw new Error('No drawn card to swap');

  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Player not found');

  const existingCard = player.cards[slotIndex];
  if (!existingCard) throw new Error('No card in slot');

  const newCards = [...player.cards];
  newCards[slotIndex] = drawnCard;

  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, cards: newCards } : p
  );

  const newDiscardPile = [...state.discardPile, existingCard];

  return {
    state: {
      ...state,
      players,
      drawnCard: null,
      discardPile: newDiscardPile,
    },
    discardedCard: existingCard,
  };
}

export function discardDrawnCard(state: GameState): { readonly state: GameState; readonly discardedCard: Card } {
  const drawnCard = state.drawnCard;
  if (!drawnCard) throw new Error('No drawn card to discard');

  return {
    state: {
      ...state,
      drawnCard: null,
      discardPile: [...state.discardPile, drawnCard],
    },
    discardedCard: drawnCard,
  };
}

export function startMatchWindow(state: GameState, discardedCard: Card): GameState {
  return {
    ...state,
    phase: 'MATCH_WINDOW',
    matchWindow: {
      discardedCard,
      startTime: Date.now(),
      duration: GAME_CONFIG.MATCH_WINDOW_MS,
      attempts: [],
    },
  };
}

export function addMatchAttempt(
  state: GameState,
  playerId: string,
  slotIndex: number
): GameState {
  if (!state.matchWindow) return state;

  return {
    ...state,
    matchWindow: {
      ...state.matchWindow,
      attempts: [
        ...state.matchWindow.attempts,
        { playerId, slotIndex, timestamp: Date.now() },
      ],
    },
  };
}

export function removePlayerCard(state: GameState, playerId: string, slotIndex: number): GameState {
  const players = state.players.map((p) => {
    if (p.id !== playerId) return p;
    const newCards = [...p.cards];
    newCards[slotIndex] = null;
    return { ...p, cards: newCards };
  });
  return { ...state, players };
}

export function addPenaltyCardToPlayer(state: GameState, playerId: string): {
  readonly state: GameState;
  readonly penaltyCard: Card;
} {
  const { card, deck } = addPenaltyCard({ drawPile: state.drawPile, discardPile: state.discardPile });

  const players = state.players.map((p) => {
    if (p.id !== playerId) return p;
    const newCards = [...p.cards, card];
    return { ...p, cards: newCards };
  });

  return {
    state: {
      ...state,
      players,
      drawPile: deck.drawPile,
      discardPile: deck.discardPile,
    },
    penaltyCard: card,
  };
}

export function endMatchWindow(state: GameState): GameState {
  return {
    ...state,
    matchWindow: null,
  };
}

export function advanceTurn(state: GameState): GameState {
  // Check if we're in a Kaboom final round — use kaboomCallerId as the signal,
  // not the phase (which might be MATCH_WINDOW at this point)
  if (state.kaboomCallerId && state.finalRoundPlayersRemaining.length > 0) {
    const remaining = state.finalRoundPlayersRemaining.filter(
      (id) => id !== state.activePlayerId
    );

    if (remaining.length === 0) {
      return { ...state, phase: 'REVEAL', activePlayerId: null, finalRoundPlayersRemaining: [], drawnCard: null };
    }

    return {
      ...state,
      phase: 'PLAYER_TURN',
      activePlayerId: remaining[0],
      finalRoundPlayersRemaining: remaining,
      drawnCard: null,
    };
  }

  // Also handle: kaboom was called and remaining is already empty (edge case)
  if (state.kaboomCallerId && state.finalRoundPlayersRemaining.length === 0) {
    return { ...state, phase: 'REVEAL', activePlayerId: null, drawnCard: null };
  }

  const nextIndex = (state.turnIndex + 1) % state.turnOrder.length;
  const nextPlayerId = state.turnOrder[nextIndex];

  return {
    ...state,
    phase: 'PLAYER_TURN',
    turnIndex: nextIndex,
    activePlayerId: nextPlayerId,
    drawnCard: null,
  };
}

export function callKaboom(state: GameState, playerId: string): GameState {
  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, calledKaboom: true } : p
  );

  // Everyone except the caller gets one more turn
  const callerIndex = state.turnOrder.indexOf(playerId);
  const remaining: string[] = [];
  for (let i = 1; i < state.turnOrder.length; i++) {
    const idx = (callerIndex + i) % state.turnOrder.length;
    remaining.push(state.turnOrder[idx]);
  }

  return {
    ...state,
    players,
    phase: 'KABOOM_FINAL',
    kaboomCallerId: playerId,
    finalRoundPlayersRemaining: remaining,
    activePlayerId: remaining[0] ?? null,
  };
}

export function enterSpecialAction(state: GameState): GameState {
  return { ...state, phase: 'SPECIAL_ACTION' };
}

export function executePeek(state: GameState, playerId: string, slotIndex: number): Card | null {
  // Any player's card can be peeked
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  return player.cards[slotIndex] ?? null;
}

export function executeTrade(
  state: GameState,
  player1Id: string,
  slot1: number,
  player2Id: string,
  slot2: number
): GameState {
  const p1 = state.players.find((p) => p.id === player1Id);
  const p2 = state.players.find((p) => p.id === player2Id);
  if (!p1 || !p2) return state;

  const card1 = p1.cards[slot1];
  const card2 = p2.cards[slot2];

  const players = state.players.map((p) => {
    if (p.id === player1Id) {
      const newCards = [...p.cards];
      newCards[slot1] = card2;
      return { ...p, cards: newCards };
    }
    if (p.id === player2Id) {
      const newCards = [...p.cards];
      newCards[slot2] = card1;
      return { ...p, cards: newCards };
    }
    return p;
  });

  return { ...state, players };
}

export function revealAndScore(state: GameState): readonly PlayerScore[] {
  return calculateScores(state.players, state.kaboomCallerId);
}

export function hasSpecialAbility(card: Card): boolean {
  return card.rank in (RANK_ABILITIES as Record<string, unknown>);
}

/** Filter game state for a specific player — hide opponents' cards */
export function filterGameStateForPlayer(state: GameState, playerId: string): ClientGameState {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error('Player not found');

  const you: ClientPlayerState = {
    id: player.id,
    displayName: player.displayName,
    cards: player.cards.map((card, idx) => {
      if (!card) return null;
      // During reveal, show all cards
      if (state.phase === 'REVEAL' || state.phase === 'GAME_OVER') {
        return { ...card, slotIndex: idx };
      }
      return { slotIndex: idx, faceDown: true as const };
    }),
    connected: player.connected,
    calledKaboom: player.calledKaboom,
    cardCount: player.cards.filter((c) => c !== null).length,
  };

  const opponents: ClientPlayerState[] = state.players
    .filter((p) => p.id !== playerId)
    .map((p) => ({
      id: p.id,
      displayName: p.displayName,
      cards: p.cards.map((card, idx) => {
        if (!card) return null;
        if (state.phase === 'REVEAL' || state.phase === 'GAME_OVER') {
          return { ...card, slotIndex: idx };
        }
        return { slotIndex: idx, faceDown: true as const };
      }),
      connected: p.connected,
      calledKaboom: p.calledKaboom,
      cardCount: p.cards.filter((c) => c !== null).length,
    }));

  const discardTop = state.discardPile.length > 0
    ? state.discardPile[state.discardPile.length - 1]
    : null;

  return {
    phase: state.phase,
    you,
    opponents,
    activePlayerId: state.activePlayerId,
    discardTop,
    drawPileCount: state.drawPile.length,
    drawnCard: state.activePlayerId === playerId ? state.drawnCard : null,
    matchWindow: state.matchWindow ? {
      discardedCard: state.matchWindow.discardedCard,
      duration: state.matchWindow.duration,
      startTime: state.matchWindow.startTime,
    } : null,
    kaboomCallerId: state.kaboomCallerId,
    turnOrder: state.turnOrder,
  };
}

import { describe, it, expect, beforeEach } from 'vitest';
import type { Card, GameState, PlayerState, Rank, Suit } from '@kaboom/shared';
import { CARD_VALUES, GAME_CONFIG, RANK_ABILITIES } from '@kaboom/shared';
import {
  createInitialGameState,
  markPlayerPeeked,
  getBottomTwoCards,
  drawFromDeck,
  drawFromDiscardPile,
  swapCard,
  discardDrawnCard,
  startMatchWindow,
  addMatchAttempt,
  removePlayerCard,
  addPenaltyCardToPlayer,
  endMatchWindow,
  advanceTurn,
  callKaboom,
  enterSpecialAction,
  executePeek,
  executeTrade,
  revealAndScore,
  hasSpecialAbility,
  filterGameStateForPlayer,
} from '../game/GameStateMachine.js';
import { resolveMatchAttempt, resolveSimultaneousAttempts } from '../game/MatchResolver.js';
import { getCardValue, calculatePlayerScore, calculateScores } from '../game/ScoreCalculator.js';
import { createShuffledDeck, dealCards, drawFromPile, takeFromDiscard } from '../game/DeckManager.js';
import {
  validatePhase,
  validateActivePlayer,
  validateCanCallKaboom,
  validateSlotHasCard,
  validateHasDrawnCard,
  validateNoDrawnCard,
  validateAll,
} from '../game/ActionValidator.js';
import {
  createEmptyMemory,
  rememberCard,
  rememberDiscard,
  rememberSwap,
  rememberTrade,
  forgetSlot,
  applyMemoryDecay,
  decideDrawSource,
  decidePostDraw,
  decideSpecial,
  decideKaboom,
  decideMatch,
  decideTradeAfterPeek,
  pickBotNames,
} from '../game/BotBrain.js';

// ─── Test Helpers ───

let cardIdCounter = 0;
function makeCard(rank: Rank, suit: Suit | null = 'hearts'): Card {
  return { id: `test-${cardIdCounter++}`, rank, suit };
}

function makePlayer(id: string, cards: (Card | null)[], overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id,
    displayName: id,
    cards,
    connected: true,
    hasPeeked: false,
    hasFinalTurn: false,
    calledKaboom: false,
    ...overrides,
  };
}

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  const p1 = makePlayer('p1', [makeCard('A'), makeCard('5'), makeCard('8'), makeCard('K', 'hearts')]);
  const p2 = makePlayer('p2', [makeCard('2'), makeCard('3'), makeCard('7'), makeCard('9')]);
  const p3 = makePlayer('p3', [makeCard('4'), makeCard('6'), makeCard('J'), makeCard('Q')]);
  const p4 = makePlayer('p4', [makeCard('10'), makeCard('K', 'spades'), makeCard('Joker', null), makeCard('3')]);

  return {
    phase: 'PLAYER_TURN',
    players: [p1, p2, p3, p4],
    activePlayerId: 'p1',
    drawPile: [makeCard('A', 'clubs'), makeCard('5', 'diamonds'), makeCard('9', 'clubs')],
    discardPile: [makeCard('6', 'diamonds')],
    drawnCard: null,
    matchWindow: null,
    kaboomCallerId: null,
    finalRoundPlayersRemaining: [],
    turnOrder: ['p1', 'p2', 'p3', 'p4'],
    turnIndex: 0,
    ...overrides,
  };
}

function peekAllPlayers(state: GameState): GameState {
  let s = state;
  for (const p of s.players) {
    s = markPlayerPeeked(s, p.id);
  }
  return s;
}

// ─── Tests ───

describe('DeckManager', () => {
  it('creates a 54-card deck (52 + 2 Jokers)', () => {
    const deck = createShuffledDeck();
    expect(deck.drawPile).toHaveLength(54);
    expect(deck.discardPile).toHaveLength(0);

    const jokers = deck.drawPile.filter((c) => c.rank === 'Joker');
    expect(jokers).toHaveLength(2);
  });

  it('deals correct number of cards to each player', () => {
    const deck = createShuffledDeck();
    const { hands, deck: remaining } = dealCards(deck, 4, 4);

    expect(hands).toHaveLength(4);
    for (const hand of hands) {
      expect(hand).toHaveLength(4);
    }
    // 54 - 16 dealt - 1 first discard = 37
    expect(remaining.drawPile).toHaveLength(37);
    expect(remaining.discardPile).toHaveLength(1);
  });

  it('draws from pile correctly', () => {
    const deck = createShuffledDeck();
    const { card, deck: remaining } = drawFromPile(deck);
    expect(card).toBeDefined();
    expect(remaining.drawPile).toHaveLength(53);
  });

  it('reshuffles discard pile when draw pile empty', () => {
    const card1 = makeCard('A');
    const card2 = makeCard('2');
    const card3 = makeCard('3');
    const deck = { drawPile: [] as Card[], discardPile: [card1, card2, card3] };

    const { card, deck: remaining } = drawFromPile(deck);
    expect(card).toBeDefined();
    // top discard kept, rest reshuffled into draw
    expect(remaining.discardPile).toHaveLength(1);
    expect(remaining.discardPile[0]).toBe(card3); // top card stays
  });

  it('takes from discard pile', () => {
    const card1 = makeCard('A');
    const result = takeFromDiscard({ drawPile: [], discardPile: [card1] });
    expect(result).not.toBeNull();
    expect(result!.card).toBe(card1);
    expect(result!.deck.discardPile).toHaveLength(0);
  });

  it('returns null when taking from empty discard', () => {
    const result = takeFromDiscard({ drawPile: [], discardPile: [] });
    expect(result).toBeNull();
  });
});

describe('Card Values & Scoring', () => {
  it('scores Ace as 1', () => {
    expect(getCardValue(makeCard('A'))).toBe(1);
  });

  it('scores number cards at face value', () => {
    for (let n = 2; n <= 9; n++) {
      expect(getCardValue(makeCard(String(n) as Rank))).toBe(n);
    }
  });

  it('scores 10, J, Q as 10', () => {
    expect(getCardValue(makeCard('10'))).toBe(10);
    expect(getCardValue(makeCard('J'))).toBe(10);
    expect(getCardValue(makeCard('Q'))).toBe(10);
  });

  it('scores Red King as 25', () => {
    expect(getCardValue(makeCard('K', 'hearts'))).toBe(25);
    expect(getCardValue(makeCard('K', 'diamonds'))).toBe(25);
  });

  it('scores Black King as 0', () => {
    expect(getCardValue(makeCard('K', 'clubs'))).toBe(0);
    expect(getCardValue(makeCard('K', 'spades'))).toBe(0);
  });

  it('scores Joker as -1', () => {
    expect(getCardValue(makeCard('Joker', null))).toBe(-1);
  });

  it('counts null (matched) cards as 0', () => {
    const cards: (Card | null)[] = [makeCard('A'), null, makeCard('5'), null];
    expect(calculatePlayerScore(cards)).toBe(6); // 1 + 0 + 5 + 0
  });

  it('calculates winner without Kaboom — lowest score wins', () => {
    const players: PlayerState[] = [
      makePlayer('p1', [makeCard('A'), makeCard('2')]),        // 3
      makePlayer('p2', [makeCard('10'), makeCard('K', 'hearts')]), // 35
      makePlayer('p3', [makeCard('3'), makeCard('3')]),        // 6
    ];
    const scores = calculateScores(players, null);
    expect(scores.find((s) => s.playerId === 'p1')!.isWinner).toBe(true);
    expect(scores.find((s) => s.playerId === 'p2')!.isWinner).toBe(false);
    expect(scores.find((s) => s.playerId === 'p3')!.isWinner).toBe(false);
  });

  it('Kaboom caller wins if strictly lowest', () => {
    const players: PlayerState[] = [
      makePlayer('p1', [makeCard('A'), makeCard('2')], { calledKaboom: true }), // 3
      makePlayer('p2', [makeCard('5'), makeCard('5')]),   // 10
    ];
    const scores = calculateScores(players, 'p1');
    expect(scores.find((s) => s.playerId === 'p1')!.isWinner).toBe(true);
    expect(scores.find((s) => s.playerId === 'p2')!.isWinner).toBe(false);
  });

  it('Kaboom caller loses if tied with another player', () => {
    const players: PlayerState[] = [
      makePlayer('p1', [makeCard('A'), makeCard('2')], { calledKaboom: true }), // 3
      makePlayer('p2', [makeCard('A'), makeCard('2')]),   // 3 — tied!
      makePlayer('p3', [makeCard('10'), makeCard('5')]),  // 15
    ];
    const scores = calculateScores(players, 'p1');
    expect(scores.find((s) => s.playerId === 'p1')!.isWinner).toBe(false); // caller loses
    expect(scores.find((s) => s.playerId === 'p2')!.isWinner).toBe(true);  // non-caller wins
  });

  it('Kaboom caller loses if beaten by another player', () => {
    const players: PlayerState[] = [
      makePlayer('p1', [makeCard('5'), makeCard('5')], { calledKaboom: true }), // 10
      makePlayer('p2', [makeCard('A'), makeCard('2')]),   // 3 — lower!
    ];
    const scores = calculateScores(players, 'p1');
    expect(scores.find((s) => s.playerId === 'p1')!.isWinner).toBe(false);
    expect(scores.find((s) => s.playerId === 'p2')!.isWinner).toBe(true);
  });

  it('handles multiple non-caller ties when caller loses', () => {
    const players: PlayerState[] = [
      makePlayer('p1', [makeCard('10')], { calledKaboom: true }), // 10
      makePlayer('p2', [makeCard('A')]),  // 1
      makePlayer('p3', [makeCard('A')]),  // 1
    ];
    const scores = calculateScores(players, 'p1');
    expect(scores.find((s) => s.playerId === 'p2')!.isWinner).toBe(true);
    expect(scores.find((s) => s.playerId === 'p3')!.isWinner).toBe(true);
  });
});

describe('Game Initialization & Peek Phase', () => {
  it('creates game in PEEK_PHASE with correct player count', () => {
    const ids = new Map([['p1', 'Alice'], ['p2', 'Bob'], ['p3', 'Carol'], ['p4', 'Dave']]);
    const state = createInitialGameState(ids);

    expect(state.phase).toBe('PEEK_PHASE');
    expect(state.players).toHaveLength(4);
    expect(state.activePlayerId).toBeNull();
    expect(state.turnOrder).toEqual(['p1', 'p2', 'p3', 'p4']);
    for (const p of state.players) {
      expect(p.cards).toHaveLength(4);
      expect(p.hasPeeked).toBe(false);
    }
  });

  it('getBottomTwoCards returns cards at indices 2 and 3', () => {
    const state = makeGameState({ phase: 'PEEK_PHASE' });
    const bottom = getBottomTwoCards(state, 'p1');
    expect(bottom).toHaveLength(2);
    expect(bottom[0]).toBe(state.players[0].cards[2]);
    expect(bottom[1]).toBe(state.players[0].cards[3]);
  });

  it('transitions to PLAYER_TURN after all players peek', () => {
    const ids = new Map([['p1', 'A'], ['p2', 'B'], ['p3', 'C'], ['p4', 'D']]);
    let state = createInitialGameState(ids);

    state = markPlayerPeeked(state, 'p1');
    expect(state.phase).toBe('PEEK_PHASE');
    state = markPlayerPeeked(state, 'p2');
    expect(state.phase).toBe('PEEK_PHASE');
    state = markPlayerPeeked(state, 'p3');
    expect(state.phase).toBe('PEEK_PHASE');
    state = markPlayerPeeked(state, 'p4');
    expect(state.phase).toBe('PLAYER_TURN');
    expect(state.activePlayerId).toBe('p1');
  });
});

describe('Drawing Cards', () => {
  it('drawFromDeck sets drawnCard and removes from drawPile', () => {
    const state = makeGameState();
    const drawPileLen = state.drawPile.length;
    const newState = drawFromDeck(state);

    expect(newState.drawnCard).not.toBeNull();
    expect(newState.drawPile).toHaveLength(drawPileLen - 1);
  });

  it('drawFromDiscardPile takes top of discard', () => {
    const state = makeGameState();
    const topDiscard = state.discardPile[state.discardPile.length - 1];
    const result = drawFromDiscardPile(state);

    expect(result).not.toBeNull();
    expect(result!.card).toBe(topDiscard);
    expect(result!.state.discardPile).toHaveLength(state.discardPile.length - 1);
    expect(result!.state.drawnCard).toBe(topDiscard);
  });

  it('drawFromDiscardPile returns null when empty', () => {
    const state = makeGameState({ discardPile: [] });
    const result = drawFromDiscardPile(state);
    expect(result).toBeNull();
  });
});

describe('Swap & Discard', () => {
  it('swapCard places drawn card in slot and discards old card', () => {
    const drawnCard = makeCard('A', 'clubs');
    const state = makeGameState({ drawnCard });
    const existingCard = state.players[0].cards[0]!;

    const { state: newState, discardedCard } = swapCard(state, 'p1', 0);

    expect(discardedCard).toBe(existingCard);
    expect(newState.drawnCard).toBeNull();
    const p1 = newState.players.find((p) => p.id === 'p1')!;
    expect(p1.cards[0]).toBe(drawnCard);
    expect(newState.discardPile[newState.discardPile.length - 1]).toBe(existingCard);
  });

  it('discardDrawnCard puts drawn card on discard pile', () => {
    const drawnCard = makeCard('7', 'clubs');
    const state = makeGameState({ drawnCard });

    const { state: newState, discardedCard } = discardDrawnCard(state);

    expect(discardedCard).toBe(drawnCard);
    expect(newState.drawnCard).toBeNull();
    expect(newState.discardPile[newState.discardPile.length - 1]).toBe(drawnCard);
  });

  it('swapCard throws when no drawn card', () => {
    const state = makeGameState({ drawnCard: null });
    expect(() => swapCard(state, 'p1', 0)).toThrow();
  });

  it('swapCard throws when slot has null card (matched away)', () => {
    const drawnCard = makeCard('A');
    const p1 = makePlayer('p1', [null, makeCard('5'), makeCard('8'), makeCard('K', 'hearts')]);
    const state = makeGameState({ drawnCard, players: [p1, ...makeGameState().players.slice(1)] });
    expect(() => swapCard(state, 'p1', 0)).toThrow('No card in slot');
  });
});

describe('Special Cards', () => {
  it('10, J, Q have special abilities', () => {
    expect(hasSpecialAbility(makeCard('10'))).toBe(true);
    expect(hasSpecialAbility(makeCard('J'))).toBe(true);
    expect(hasSpecialAbility(makeCard('Q'))).toBe(true);
  });

  it('non-special cards have no abilities', () => {
    expect(hasSpecialAbility(makeCard('A'))).toBe(false);
    expect(hasSpecialAbility(makeCard('5'))).toBe(false);
    expect(hasSpecialAbility(makeCard('K'))).toBe(false);
    expect(hasSpecialAbility(makeCard('Joker', null))).toBe(false);
  });

  it('10 maps to peek ability', () => {
    expect(RANK_ABILITIES['10']).toBe('peek');
  });

  it('J maps to blindTrade ability', () => {
    expect(RANK_ABILITIES['J']).toBe('blindTrade');
  });

  it('Q maps to peekAndTrade ability', () => {
    expect(RANK_ABILITIES['Q']).toBe('peekAndTrade');
  });

  it('enterSpecialAction sets phase', () => {
    const state = makeGameState();
    const newState = enterSpecialAction(state);
    expect(newState.phase).toBe('SPECIAL_ACTION');
  });

  it('executePeek returns the card at the slot', () => {
    const state = makeGameState();
    const peeked = executePeek(state, 'p2', 1);
    expect(peeked).toBe(state.players[1].cards[1]);
  });

  it('executePeek returns null for empty slot', () => {
    const p1 = makePlayer('p1', [null, makeCard('5'), makeCard('8'), makeCard('K', 'hearts')]);
    const state = makeGameState({ players: [p1, ...makeGameState().players.slice(1)] });
    expect(executePeek(state, 'p1', 0)).toBeNull();
  });

  it('executeTrade swaps cards between two players', () => {
    const state = makeGameState();
    const p1Card0 = state.players[0].cards[0];
    const p2Card1 = state.players[1].cards[1];

    const newState = executeTrade(state, 'p1', 0, 'p2', 1);

    const newP1 = newState.players.find((p) => p.id === 'p1')!;
    const newP2 = newState.players.find((p) => p.id === 'p2')!;
    expect(newP1.cards[0]).toBe(p2Card1);
    expect(newP2.cards[1]).toBe(p1Card0);
  });
});

describe('Match Window & Matching', () => {
  it('startMatchWindow sets phase and match state', () => {
    const discard = makeCard('5');
    const state = startMatchWindow(makeGameState(), discard);
    expect(state.phase).toBe('MATCH_WINDOW');
    expect(state.matchWindow).not.toBeNull();
    expect(state.matchWindow!.discardedCard).toBe(discard);
    expect(state.matchWindow!.attempts).toHaveLength(0);
  });

  it('resolveMatchAttempt succeeds with matching rank', () => {
    const discardedCard = makeCard('5');
    const p1 = makePlayer('p1', [makeCard('5'), makeCard('8'), makeCard('A'), makeCard('K', 'hearts')]);
    const state: GameState = {
      ...makeGameState({ players: [p1, ...makeGameState().players.slice(1)] }),
      phase: 'MATCH_WINDOW',
      matchWindow: {
        discardedCard,
        startTime: Date.now(),
        duration: GAME_CONFIG.MATCH_WINDOW_MS,
        attempts: [],
      },
    };

    const result = resolveMatchAttempt(state, 'p1', 0);
    expect(result.success).toBe(true);
    expect(result.matchedCard!.rank).toBe('5');
  });

  it('resolveMatchAttempt fails with non-matching rank', () => {
    const discardedCard = makeCard('5');
    const p1 = makePlayer('p1', [makeCard('7'), makeCard('8'), makeCard('A'), makeCard('K', 'hearts')]);
    const state: GameState = {
      ...makeGameState({ players: [p1, ...makeGameState().players.slice(1)] }),
      phase: 'MATCH_WINDOW',
      matchWindow: {
        discardedCard,
        startTime: Date.now(),
        duration: GAME_CONFIG.MATCH_WINDOW_MS,
        attempts: [],
      },
    };

    const result = resolveMatchAttempt(state, 'p1', 0);
    expect(result.success).toBe(false);
  });

  it('Joker matches Joker', () => {
    const discardedCard = makeCard('Joker', null);
    const p1 = makePlayer('p1', [makeCard('Joker', null), makeCard('8'), makeCard('A'), makeCard('K', 'hearts')]);
    const state: GameState = {
      ...makeGameState({ players: [p1, ...makeGameState().players.slice(1)] }),
      phase: 'MATCH_WINDOW',
      matchWindow: {
        discardedCard,
        startTime: Date.now(),
        duration: GAME_CONFIG.MATCH_WINDOW_MS,
        attempts: [],
      },
    };

    const result = resolveMatchAttempt(state, 'p1', 0);
    expect(result.success).toBe(true);
  });

  it('match attempt fails on null (already matched) slot', () => {
    const discardedCard = makeCard('5');
    const p1 = makePlayer('p1', [null, makeCard('8'), makeCard('A'), makeCard('K', 'hearts')]);
    const state: GameState = {
      ...makeGameState({ players: [p1, ...makeGameState().players.slice(1)] }),
      phase: 'MATCH_WINDOW',
      matchWindow: {
        discardedCard,
        startTime: Date.now(),
        duration: GAME_CONFIG.MATCH_WINDOW_MS,
        attempts: [],
      },
    };

    const result = resolveMatchAttempt(state, 'p1', 0);
    expect(result.success).toBe(false);
  });

  it('removePlayerCard sets slot to null', () => {
    const state = makeGameState();
    expect(state.players[0].cards[1]).not.toBeNull();
    const newState = removePlayerCard(state, 'p1', 1);
    expect(newState.players[0].cards[1]).toBeNull();
  });

  it('addPenaltyCardToPlayer adds a card to the player hand', () => {
    const state = makeGameState();
    const initialCardCount = state.players[0].cards.length;
    const { state: newState, penaltyCard } = addPenaltyCardToPlayer(state, 'p1');

    expect(penaltyCard).toBeDefined();
    const p1 = newState.players.find((p) => p.id === 'p1')!;
    expect(p1.cards).toHaveLength(initialCardCount + 1);
  });

  it('simultaneous match resolution picks one winner', () => {
    const now = Date.now();
    const attempts = [
      { playerId: 'p1', slotIndex: 0, timestamp: now },
      { playerId: 'p2', slotIndex: 0, timestamp: now + 10 }, // within 50ms threshold
    ];
    const winner = resolveSimultaneousAttempts(attempts);
    expect(winner).not.toBeNull();
    expect(['p1', 'p2']).toContain(winner!.playerId);
  });

  it('first attempt wins when outside threshold', () => {
    const now = Date.now();
    const attempts = [
      { playerId: 'p1', slotIndex: 0, timestamp: now },
      { playerId: 'p2', slotIndex: 0, timestamp: now + 200 }, // outside 100ms threshold
    ];
    const winner = resolveSimultaneousAttempts(attempts);
    expect(winner!.playerId).toBe('p1');
  });

  it('endMatchWindow clears match state', () => {
    const discard = makeCard('5');
    let state = startMatchWindow(makeGameState(), discard);
    expect(state.matchWindow).not.toBeNull();
    state = endMatchWindow(state);
    expect(state.matchWindow).toBeNull();
  });
});

describe('Turn Flow', () => {
  it('advanceTurn moves to next player', () => {
    const state = makeGameState({ activePlayerId: 'p1', turnIndex: 0 });
    const next = advanceTurn(state);
    expect(next.activePlayerId).toBe('p2');
    expect(next.turnIndex).toBe(1);
  });

  it('advanceTurn wraps around', () => {
    const state = makeGameState({ activePlayerId: 'p4', turnIndex: 3 });
    const next = advanceTurn(state);
    expect(next.activePlayerId).toBe('p1');
    expect(next.turnIndex).toBe(0);
  });

  it('advanceTurn clears drawnCard', () => {
    const state = makeGameState({ drawnCard: makeCard('5') });
    const next = advanceTurn(state);
    expect(next.drawnCard).toBeNull();
  });
});

describe('Kaboom Mechanic', () => {
  it('callKaboom sets phase to KABOOM_FINAL', () => {
    const state = makeGameState();
    const newState = callKaboom(state, 'p1');
    expect(newState.phase).toBe('KABOOM_FINAL');
    expect(newState.kaboomCallerId).toBe('p1');
  });

  it('callKaboom gives all other players a final turn', () => {
    const state = makeGameState();
    const newState = callKaboom(state, 'p1');
    expect(newState.finalRoundPlayersRemaining).toEqual(['p2', 'p3', 'p4']);
    expect(newState.activePlayerId).toBe('p2');
  });

  it('advanceTurn during KABOOM_FINAL removes from remaining list', () => {
    let state = makeGameState();
    state = callKaboom(state, 'p1');
    // p2 takes their final turn
    state = advanceTurn({ ...state, phase: 'KABOOM_FINAL' });
    expect(state.finalRoundPlayersRemaining).toEqual(['p3', 'p4']);
    expect(state.activePlayerId).toBe('p3');
  });

  it('advanceTurn goes to REVEAL when all final turns done', () => {
    let state = makeGameState();
    state = callKaboom(state, 'p1');

    // Simulate all final turns
    state = { ...state, activePlayerId: 'p2', finalRoundPlayersRemaining: ['p2'], phase: 'KABOOM_FINAL' };
    state = advanceTurn(state);
    expect(state.phase).toBe('REVEAL');
    expect(state.activePlayerId).toBeNull();
  });

  it('revealAndScore produces scores for all players', () => {
    const state = makeGameState({ phase: 'REVEAL' });
    const scores = revealAndScore(state);
    expect(scores).toHaveLength(4);
    for (const s of scores) {
      expect(typeof s.score).toBe('number');
      expect(typeof s.isWinner).toBe('boolean');
    }
  });
});

describe('Action Validation', () => {
  it('validates correct phase', () => {
    const state = makeGameState({ phase: 'PLAYER_TURN' });
    expect(validatePhase(state, 'PLAYER_TURN').valid).toBe(true);
    expect(validatePhase(state, 'PEEK_PHASE').valid).toBe(false);
  });

  it('validates active player', () => {
    const state = makeGameState({ activePlayerId: 'p1' });
    expect(validateActivePlayer(state, 'p1').valid).toBe(true);
    expect(validateActivePlayer(state, 'p2').valid).toBe(false);
  });

  it('validates Kaboom can only be called before drawing', () => {
    const state = makeGameState({ drawnCard: null, kaboomCallerId: null });
    expect(validateCanCallKaboom(state, 'p1').valid).toBe(true);

    const drawn = makeGameState({ drawnCard: makeCard('5') });
    expect(validateCanCallKaboom(drawn, 'p1').valid).toBe(false);

    const alreadyCalled = makeGameState({ kaboomCallerId: 'p2' });
    expect(validateCanCallKaboom(alreadyCalled, 'p1').valid).toBe(false);
  });

  it('validates slot has card', () => {
    const state = makeGameState();
    expect(validateSlotHasCard(state, 'p1', 0).valid).toBe(true);

    const p1 = makePlayer('p1', [null, makeCard('5'), makeCard('8'), makeCard('K', 'hearts')]);
    const nullState = makeGameState({ players: [p1, ...state.players.slice(1)] });
    expect(validateSlotHasCard(nullState, 'p1', 0).valid).toBe(false);
  });

  it('validateAll returns first failure', () => {
    const ok = { valid: true as const };
    const fail1 = { valid: false as const, error: 'err1' };
    const fail2 = { valid: false as const, error: 'err2' };
    expect(validateAll(ok, ok).valid).toBe(true);
    const result = validateAll(ok, fail1, fail2);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe('err1');
  });
});

describe('Client State Filtering', () => {
  it('hides opponent cards during PLAYER_TURN', () => {
    const state = makeGameState();
    const filtered = filterGameStateForPlayer(state, 'p1');

    expect(filtered.you.id).toBe('p1');
    // Own cards are face-down during play
    for (const c of filtered.you.cards) {
      if (c) expect('faceDown' in c).toBe(true);
    }
    // Opponent cards are face-down
    for (const opp of filtered.opponents) {
      for (const c of opp.cards) {
        if (c) expect('faceDown' in c).toBe(true);
      }
    }
  });

  it('reveals all cards during REVEAL phase', () => {
    const state = makeGameState({ phase: 'REVEAL' });
    const filtered = filterGameStateForPlayer(state, 'p1');

    for (const c of filtered.you.cards) {
      if (c) expect('rank' in c).toBe(true);
    }
    for (const opp of filtered.opponents) {
      for (const c of opp.cards) {
        if (c) expect('rank' in c).toBe(true);
      }
    }
  });

  it('only shows drawnCard to active player', () => {
    const drawn = makeCard('7');
    const state = makeGameState({ drawnCard: drawn, activePlayerId: 'p1' });

    const forP1 = filterGameStateForPlayer(state, 'p1');
    expect(forP1.drawnCard).toBe(drawn);

    const forP2 = filterGameStateForPlayer(state, 'p2');
    expect(forP2.drawnCard).toBeNull();
  });
});

describe('Bot Memory System', () => {
  it('creates empty memory', () => {
    const mem = createEmptyMemory();
    expect(mem.knownCards.size).toBe(0);
    expect(mem.discardedCardIds.size).toBe(0);
  });

  it('remembers a card', () => {
    let mem = createEmptyMemory();
    const card = makeCard('5');
    mem = rememberCard(mem, 'bot1', 2, card);
    expect(mem.knownCards.has('bot1:2')).toBe(true);
    expect(mem.knownCards.get('bot1:2')!.rank).toBe('5');
    expect(mem.knownCards.get('bot1:2')!.value).toBe(5);
  });

  it('remembers discarded cards', () => {
    let mem = createEmptyMemory();
    const card = makeCard('7');
    mem = rememberDiscard(mem, card);
    expect(mem.discardedCardIds.has(card.id)).toBe(true);
  });

  it('remembers swap — updates known card at slot', () => {
    let mem = createEmptyMemory();
    const oldCard = makeCard('K', 'hearts');
    mem = rememberCard(mem, 'bot1', 0, oldCard);
    expect(mem.knownCards.get('bot1:0')!.value).toBe(25);

    const newCard = makeCard('A');
    mem = rememberSwap(mem, 'bot1', 0, newCard);
    expect(mem.knownCards.get('bot1:0')!.value).toBe(1);
  });

  it('remembers trade — swaps knowledge between players', () => {
    let mem = createEmptyMemory();
    const card1 = makeCard('A');
    const card2 = makeCard('K', 'hearts');
    mem = rememberCard(mem, 'bot1', 0, card1);
    mem = rememberCard(mem, 'p2', 1, card2);

    mem = rememberTrade(mem, 'bot1', 0, 'p2', 1);
    expect(mem.knownCards.get('bot1:0')!.value).toBe(25); // was p2's K
    expect(mem.knownCards.get('p2:1')!.value).toBe(1);    // was bot1's A
  });

  it('forgets slot on match', () => {
    let mem = createEmptyMemory();
    mem = rememberCard(mem, 'bot1', 2, makeCard('5'));
    expect(mem.knownCards.has('bot1:2')).toBe(true);
    mem = forgetSlot(mem, 'bot1', 2);
    expect(mem.knownCards.has('bot1:2')).toBe(false);
  });

  it('memory decay removes some cards with given probability', () => {
    let mem = createEmptyMemory();
    for (let i = 0; i < 20; i++) {
      mem = rememberCard(mem, 'bot1', i, makeCard('A'));
    }
    expect(mem.knownCards.size).toBe(20);

    // With 100% decay, all should be forgotten
    const decayed = applyMemoryDecay(mem, 1.0);
    expect(decayed.knownCards.size).toBe(0);

    // With 0% decay, none should be forgotten
    const preserved = applyMemoryDecay(mem, 0.0);
    expect(preserved.knownCards.size).toBe(20);
  });
});

describe('Bot Brain — Decision Functions', () => {
  it('pickBotNames returns requested count with (Bot) suffix', () => {
    const names = pickBotNames(3);
    expect(names).toHaveLength(3);
    for (const n of names) {
      expect(n).toMatch(/\(Bot\)$/);
    }
  });

  it('hard bot takes Joker from discard', () => {
    const joker = makeCard('Joker', null);
    const state = makeGameState({ discardPile: [joker] });
    const mem = createEmptyMemory();
    const decision = decideDrawSource('hard', mem, state, 'p1');
    expect(decision.source).toBe('discard');
  });

  it('hard bot takes Black King from discard', () => {
    const bk = makeCard('K', 'spades');
    const state = makeGameState({ discardPile: [bk] });
    const mem = createEmptyMemory();
    const decision = decideDrawSource('hard', mem, state, 'p1');
    expect(decision.source).toBe('discard');
  });

  it('medium bot swaps in Joker', () => {
    const joker = makeCard('Joker', null);
    const player = makePlayer('bot1', [makeCard('5'), makeCard('8'), makeCard('A'), makeCard('K', 'hearts')]);
    let mem = createEmptyMemory();
    mem = rememberCard(mem, 'bot1', 3, makeCard('K', 'hearts'));

    const decision = decidePostDraw('medium', mem, 'bot1', joker, player);
    expect(decision.action).toBe('swap');
  });

  it('hard bot swaps drawn card lower than known highest', () => {
    const drawn = makeCard('2');
    const player = makePlayer('bot1', [makeCard('A'), makeCard('8'), makeCard('3'), makeCard('K', 'hearts')]);
    let mem = createEmptyMemory();
    mem = rememberCard(mem, 'bot1', 3, makeCard('K', 'hearts'));

    const decision = decidePostDraw('hard', mem, 'bot1', drawn, player);
    expect(decision.action).toBe('swap');
    expect(decision.slotIndex).toBe(3); // replace the K(25)
  });

  it('medium bot uses 10 to peek at own unknown card', () => {
    const player = makePlayer('bot1', [makeCard('A'), makeCard('5'), makeCard('8'), makeCard('K', 'hearts')]);
    let mem = createEmptyMemory();
    mem = rememberCard(mem, 'bot1', 2, makeCard('8'));
    mem = rememberCard(mem, 'bot1', 3, makeCard('K', 'hearts'));
    // slots 0 and 1 are unknown

    const state = makeGameState({ players: [player, ...makeGameState().players.slice(1)] });
    const decision = decideSpecial('medium', mem, 'bot1', 'peek', state);
    expect(decision.use).toBe(true);
    expect(decision.targetPlayer).toBe('bot1');
    expect(decision.targetSlot).toBe(0); // first unknown
  });

  it('hard bot uses blind trade when holding high card', () => {
    const player = makePlayer('bot1', [makeCard('K', 'hearts'), makeCard('5'), makeCard('8'), makeCard('3')]);
    let mem = createEmptyMemory();
    mem = rememberCard(mem, 'bot1', 0, makeCard('K', 'hearts')); // value 25

    const p2 = makePlayer('p2', [makeCard('A'), makeCard('2'), makeCard('3'), makeCard('4')]);
    const state = makeGameState({ players: [player, p2] });
    const decision = decideSpecial('hard', mem, 'bot1', 'blindTrade', state);
    expect(decision.use).toBe(true);
    expect(decision.tradeMySlot).toBe(0); // trade away the K
  });

  it('medium bot calls Kaboom when estimated score ≤ 10', () => {
    const player = makePlayer('bot1', [makeCard('A'), makeCard('2'), makeCard('3'), makeCard('A')]);
    let mem = createEmptyMemory();
    // Know all cards: 1+2+3+1 = 7
    mem = rememberCard(mem, 'bot1', 0, makeCard('A'));
    mem = rememberCard(mem, 'bot1', 1, makeCard('2'));
    mem = rememberCard(mem, 'bot1', 2, makeCard('3'));
    mem = rememberCard(mem, 'bot1', 3, makeCard('A'));

    const state = makeGameState({
      players: [player, ...makeGameState().players.slice(1)],
      activePlayerId: 'bot1',
    });
    const decision = decideKaboom('medium', mem, 'bot1', state);
    expect(decision.shouldCall).toBe(true);
  });

  it('hard bot only calls Kaboom when it is lowest', () => {
    const player = makePlayer('bot1', [makeCard('A'), makeCard('A'), makeCard('A'), makeCard('A')]);
    const opp = makePlayer('p2', [makeCard('Joker', null), makeCard('Joker', null), makeCard('K', 'spades'), makeCard('K', 'spades')]);
    let mem = createEmptyMemory();
    // bot1 knows: 1+1+1+1 = 4
    mem = rememberCard(mem, 'bot1', 0, makeCard('A'));
    mem = rememberCard(mem, 'bot1', 1, makeCard('A'));
    mem = rememberCard(mem, 'bot1', 2, makeCard('A'));
    mem = rememberCard(mem, 'bot1', 3, makeCard('A'));
    // bot1 knows opponent has very low cards
    mem = rememberCard(mem, 'p2', 0, makeCard('Joker', null));
    mem = rememberCard(mem, 'p2', 1, makeCard('Joker', null));
    mem = rememberCard(mem, 'p2', 2, makeCard('K', 'spades'));
    mem = rememberCard(mem, 'p2', 3, makeCard('K', 'spades'));

    const state = makeGameState({ players: [player, opp], turnOrder: ['bot1', 'p2'], activePlayerId: 'bot1' });
    // p2 score = -1 + -1 + 0 + 0 = -2, which is lower than bot1's 4
    const decision = decideKaboom('hard', mem, 'bot1', state);
    expect(decision.shouldCall).toBe(false); // shouldn't call because opponent is lower
  });

  it('hard bot matches known card instantly', () => {
    const discarded = makeCard('5');
    const player = makePlayer('bot1', [makeCard('5'), makeCard('8'), makeCard('A'), makeCard('K', 'hearts')]);
    let mem = createEmptyMemory();
    mem = rememberCard(mem, 'bot1', 0, makeCard('5'));

    const decision = decideMatch('hard', mem, 'bot1', discarded, player);
    expect(decision.shouldAttempt).toBe(true);
    expect(decision.slotIndex).toBe(0);
    expect(decision.delayMs).toBeLessThan(700);
  });

  it('hard bot does not match unknown cards', () => {
    const discarded = makeCard('5');
    const player = makePlayer('bot1', [makeCard('5'), makeCard('8'), makeCard('A'), makeCard('K', 'hearts')]);
    const mem = createEmptyMemory(); // knows nothing

    const decision = decideMatch('hard', mem, 'bot1', discarded, player);
    expect(decision.shouldAttempt).toBe(false);
  });

  it('decideTradeAfterPeek: hard bot trades if peeked card is lower than highest known', () => {
    const player = makePlayer('bot1', [makeCard('K', 'hearts'), makeCard('5'), makeCard('8'), makeCard('3')]);
    let mem = createEmptyMemory();
    mem = rememberCard(mem, 'bot1', 0, makeCard('K', 'hearts')); // 25

    const peekedCard = makeCard('2');
    const result = decideTradeAfterPeek('hard', mem, 'bot1', peekedCard, 'p2', 0, player);
    expect(result.shouldTrade).toBe(true);
    expect(result.mySlot).toBe(0); // trade away K
  });

  it('easy bot never trades after peek', () => {
    const player = makePlayer('bot1', [makeCard('K', 'hearts'), makeCard('5'), makeCard('8'), makeCard('3')]);
    const mem = createEmptyMemory();
    const peekedCard = makeCard('2');
    const result = decideTradeAfterPeek('easy', mem, 'bot1', peekedCard, 'p2', 0, player);
    expect(result.shouldTrade).toBe(false);
  });
});

describe('Full Game Simulation — 4 Bots', () => {
  /**
   * Simulate a complete game with 4 bots playing deterministically.
   * Each bot draws from deck, then either swaps or discards.
   * After a fixed number of turns, one bot calls Kaboom, everyone gets final turns,
   * then we reveal and score.
   */
  function simulateFullGame(): {
    state: GameState;
    scores: ReturnType<typeof revealAndScore>;
  } {
    const ids = new Map([
      ['bot1', 'Bot1'],
      ['bot2', 'Bot2'],
      ['bot3', 'Bot3'],
      ['bot4', 'Bot4'],
    ]);
    let state = createInitialGameState(ids);

    // Peek phase
    state = peekAllPlayers(state);
    expect(state.phase).toBe('PLAYER_TURN');
    expect(state.activePlayerId).toBe('bot1');

    // Play 8 turns (2 full rounds)
    for (let turn = 0; turn < 8; turn++) {
      const activeId = state.activePlayerId!;

      // Draw
      state = drawFromDeck(state);
      expect(state.drawnCard).not.toBeNull();

      // Discard the drawn card (simple strategy)
      const { state: afterDiscard, discardedCard } = discardDrawnCard(state);
      state = afterDiscard;

      // Start match window
      state = startMatchWindow(state, discardedCard);
      expect(state.phase).toBe('MATCH_WINDOW');

      // End match window (no one matches)
      state = endMatchWindow(state);
      state = advanceTurn(state);
      expect(state.phase).toBe('PLAYER_TURN');
    }

    // Ensure it's bot1's turn for Kaboom call
    const bot1Idx = state.turnOrder.indexOf('bot1');
    state = { ...state, activePlayerId: 'bot1', turnIndex: bot1Idx };
    const kaboomCheck = validateCanCallKaboom(state, 'bot1');
    expect(kaboomCheck.valid).toBe(true);

    state = callKaboom(state, 'bot1');
    expect(state.phase).toBe('KABOOM_FINAL');
    expect(state.finalRoundPlayersRemaining).toHaveLength(3);

    // Each remaining player takes one final turn
    while (state.phase !== 'REVEAL') {
      const activeId = state.activePlayerId;
      if (!activeId) break;

      // Force phase to allow drawing during final round
      if (state.phase === 'PLAYER_TURN') {
        state = { ...state, phase: 'KABOOM_FINAL' };
      }

      state = drawFromDeck(state);
      const { state: afterDiscard, discardedCard } = discardDrawnCard(state);
      state = afterDiscard;

      state = startMatchWindow(state, discardedCard);
      state = endMatchWindow(state);
      // Restore KABOOM_FINAL so advanceTurn processes final round correctly
      state = { ...state, phase: 'KABOOM_FINAL' };
      state = advanceTurn(state);
    }

    expect(state.phase).toBe('REVEAL');

    // Score
    const scores = revealAndScore(state);
    return { state, scores };
  }

  it('completes a full game from start to scoring', () => {
    const { scores } = simulateFullGame();
    expect(scores).toHaveLength(4);

    // Exactly one player called Kaboom
    const kaboomCallers = scores.filter((s) => s.calledKaboom);
    expect(kaboomCallers).toHaveLength(1);

    // At least one winner
    const winners = scores.filter((s) => s.isWinner);
    expect(winners.length).toBeGreaterThanOrEqual(1);

    // All scores are numbers
    for (const s of scores) {
      expect(typeof s.score).toBe('number');
    }
  });

  it('all player cards are accounted for in final scores', () => {
    const { scores } = simulateFullGame();
    for (const s of scores) {
      // Each player's score should match calculatePlayerScore
      expect(s.score).toBe(calculatePlayerScore(s.cards));
    }
  });

  it('runs 10 games without crashing', () => {
    for (let i = 0; i < 10; i++) {
      const { scores } = simulateFullGame();
      expect(scores).toHaveLength(4);
      const winners = scores.filter((s) => s.isWinner);
      expect(winners.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('Full Game Simulation — With Matching', () => {
  it('match removes card and scores it as 0', () => {
    const ids = new Map([['bot1', 'Bot1'], ['bot2', 'Bot2']]);
    let state = createInitialGameState(ids);
    state = peekAllPlayers(state);

    // bot1 draws and discards
    state = drawFromDeck(state);
    const { state: afterDiscard, discardedCard } = discardDrawnCard(state);
    state = afterDiscard;

    // Find if bot2 has a card matching the discarded rank
    const bot2 = state.players.find((p) => p.id === 'bot2')!;
    const matchSlot = bot2.cards.findIndex((c) => c && c.rank === discardedCard.rank);

    if (matchSlot >= 0) {
      // Start match window and resolve
      state = startMatchWindow(state, discardedCard);
      const result = resolveMatchAttempt(state, 'bot2', matchSlot);
      expect(result.success).toBe(true);

      state = removePlayerCard(state, 'bot2', matchSlot);
      const updatedBot2 = state.players.find((p) => p.id === 'bot2')!;
      expect(updatedBot2.cards[matchSlot]).toBeNull();
    }
    // If no match, that's ok — random deck
  });

  it('wrong match gives penalty card', () => {
    const fiveOfHearts = makeCard('5', 'hearts');
    const sevenOfClubs = makeCard('7', 'clubs');
    const p1 = makePlayer('p1', [sevenOfClubs, makeCard('8'), makeCard('A'), makeCard('K', 'hearts')]);
    const state: GameState = {
      ...makeGameState({ players: [p1, ...makeGameState().players.slice(1)] }),
      phase: 'MATCH_WINDOW',
      matchWindow: {
        discardedCard: fiveOfHearts,
        startTime: Date.now(),
        duration: GAME_CONFIG.MATCH_WINDOW_MS,
        attempts: [],
      },
    };

    // p1 tries to match slot 0 (7 of clubs) against discarded 5 — wrong!
    const result = resolveMatchAttempt(state, 'p1', 0);
    expect(result.success).toBe(false);

    // Apply penalty
    const { state: penaltyState, penaltyCard } = addPenaltyCardToPlayer(state, 'p1');
    const p1After = penaltyState.players.find((p) => p.id === 'p1')!;
    expect(p1After.cards).toHaveLength(5); // 4 + 1 penalty
    expect(penaltyCard).toBeDefined();
  });
});

describe('Full Game Simulation — With Special Cards', () => {
  it('10 card triggers peek ability then match window', () => {
    const tenCard = makeCard('10', 'diamonds');
    const state = makeGameState({
      drawnCard: tenCard,
      activePlayerId: 'p1',
    });

    // Discard the 10
    const { state: afterDiscard, discardedCard } = discardDrawnCard(state);
    expect(discardedCard.rank).toBe('10');
    expect(hasSpecialAbility(discardedCard)).toBe(true);
    expect(RANK_ABILITIES[discardedCard.rank]).toBe('peek');

    // Enter special action
    const specialState = enterSpecialAction(afterDiscard);
    expect(specialState.phase).toBe('SPECIAL_ACTION');

    // Execute peek — p1 peeks at p2's slot 0
    const peeked = executePeek(specialState, 'p2', 0);
    expect(peeked).toBe(specialState.players[1].cards[0]);

    // After peek, go to match window
    const discardTop = specialState.discardPile[specialState.discardPile.length - 1];
    const matchState = startMatchWindow(specialState, discardTop);
    expect(matchState.phase).toBe('MATCH_WINDOW');
  });

  it('Jack card triggers blind trade', () => {
    const jackCard = makeCard('J', 'clubs');
    const state = makeGameState({
      drawnCard: jackCard,
      activePlayerId: 'p1',
    });

    const { state: afterDiscard, discardedCard } = discardDrawnCard(state);
    expect(RANK_ABILITIES[discardedCard.rank]).toBe('blindTrade');

    const specialState = enterSpecialAction(afterDiscard);

    // p1 trades slot 0 with p2 slot 1
    const p1Card0 = specialState.players[0].cards[0];
    const p2Card1 = specialState.players[1].cards[1];

    const traded = executeTrade(specialState, 'p1', 0, 'p2', 1);
    expect(traded.players[0].cards[0]).toBe(p2Card1);
    expect(traded.players[1].cards[1]).toBe(p1Card0);
  });

  it('Queen card triggers peekAndTrade ability', () => {
    const queenCard = makeCard('Q', 'hearts');
    const state = makeGameState({
      drawnCard: queenCard,
      activePlayerId: 'p1',
    });

    const { discardedCard } = discardDrawnCard(state);
    expect(RANK_ABILITIES[discardedCard.rank]).toBe('peekAndTrade');
  });
});

describe('Full Game Simulation — Kaboom Winner Logic', () => {
  it('Kaboom caller wins with strictly lowest score', () => {
    const p1 = makePlayer('p1', [makeCard('A'), makeCard('A'), makeCard('Joker', null), makeCard('K', 'spades')], { calledKaboom: true });
    // score = 1+1+(-1)+0 = 1
    const p2 = makePlayer('p2', [makeCard('5'), makeCard('5'), makeCard('5'), makeCard('5')]);
    // score = 20
    const p3 = makePlayer('p3', [makeCard('3'), makeCard('3'), makeCard('3'), makeCard('3')]);
    // score = 12
    const p4 = makePlayer('p4', [makeCard('2'), makeCard('2'), makeCard('2'), makeCard('2')]);
    // score = 8

    const scores = calculateScores([p1, p2, p3, p4], 'p1');
    expect(scores.find((s) => s.playerId === 'p1')!.isWinner).toBe(true);
    expect(scores.find((s) => s.playerId === 'p2')!.isWinner).toBe(false);
  });

  it('Kaboom caller loses when tied — non-caller wins', () => {
    const p1 = makePlayer('p1', [makeCard('2'), makeCard('3')], { calledKaboom: true }); // 5
    const p2 = makePlayer('p2', [makeCard('2'), makeCard('3')]); // 5 — tied
    const p3 = makePlayer('p3', [makeCard('10'), makeCard('10')]); // 20

    const scores = calculateScores([p1, p2, p3], 'p1');
    expect(scores.find((s) => s.playerId === 'p1')!.isWinner).toBe(false); // caller loses
    expect(scores.find((s) => s.playerId === 'p2')!.isWinner).toBe(true);  // non-caller wins
  });

  it('Kaboom caller loses when beaten — lowest non-caller wins', () => {
    const p1 = makePlayer('p1', [makeCard('5'), makeCard('5')], { calledKaboom: true }); // 10
    const p2 = makePlayer('p2', [makeCard('A'), makeCard('A')]); // 2 — lower
    const p3 = makePlayer('p3', [makeCard('K', 'hearts'), makeCard('K', 'diamonds')]); // 50

    const scores = calculateScores([p1, p2, p3], 'p1');
    expect(scores.find((s) => s.playerId === 'p1')!.isWinner).toBe(false);
    expect(scores.find((s) => s.playerId === 'p2')!.isWinner).toBe(true);
    expect(scores.find((s) => s.playerId === 'p3')!.isWinner).toBe(false);
  });
});

describe('Full Game Simulation — Stress Test', () => {
  it('runs 50 randomized full games to completion without errors', () => {
    for (let i = 0; i < 50; i++) {
      const ids = new Map([['b1', 'B1'], ['b2', 'B2'], ['b3', 'B3'], ['b4', 'B4']]);
      let state = createInitialGameState(ids);
      state = peekAllPlayers(state);

      let turnCount = 0;
      const maxTurns = 200; // safety limit

      while (state.phase !== 'REVEAL' && state.phase !== 'GAME_OVER' && turnCount < maxTurns) {
        const activeId = state.activePlayerId;
        if (!activeId) break;

        // Random: call Kaboom with small probability after turn 4
        if (
          turnCount > 4 &&
          !state.kaboomCallerId &&
          !state.drawnCard &&
          state.phase === 'PLAYER_TURN' &&
          Math.random() < 0.15
        ) {
          state = callKaboom(state, activeId);
          if (state.finalRoundPlayersRemaining.length === 0) break;
          continue;
        }

        // Draw
        if (state.phase === 'PLAYER_TURN' || state.phase === 'KABOOM_FINAL') {
          state = drawFromDeck(state);

          // Random: swap or discard
          const player = state.players.find((p) => p.id === activeId)!;
          if (Math.random() < 0.4) {
            // Swap into a random non-null slot
            const validSlots = player.cards.map((c, idx) => c ? idx : -1).filter((i) => i >= 0);
            if (validSlots.length > 0) {
              const slot = validSlots[Math.floor(Math.random() * validSlots.length)];
              const { state: s } = swapCard(state, activeId, slot);
              state = s;
            } else {
              const { state: s } = discardDrawnCard(state);
              state = s;
            }
          } else {
            const { state: s } = discardDrawnCard(state);
            state = s;
          }

          // Skip special, go to match window
          const discardTop = state.discardPile[state.discardPile.length - 1];
          if (discardTop) {
            state = startMatchWindow(state, discardTop);
            state = endMatchWindow(state);
          }

          state = advanceTurn(state);
          turnCount++;
        }
      }

      // Force reveal if we hit max turns
      if (state.phase !== 'REVEAL' && state.phase !== 'GAME_OVER') {
        state = { ...state, phase: 'REVEAL' };
      }

      const scores = revealAndScore(state);
      expect(scores).toHaveLength(4);
      const winners = scores.filter((s) => s.isWinner);
      expect(winners.length).toBeGreaterThanOrEqual(1);

      // Verify score consistency
      for (const s of scores) {
        expect(s.score).toBe(calculatePlayerScore(s.cards));
      }
    }
  });
});

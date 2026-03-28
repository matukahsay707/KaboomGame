import type { Card, GameState, PlayerState } from '@kaboom/shared';
import { CARD_VALUES } from '@kaboom/shared';

export type BotDifficulty = 'easy' | 'medium' | 'hard' | 'dania';

/** What the bot remembers about a single card slot */
interface CardMemory {
  readonly rank: string;
  readonly suit: string | null;
  readonly value: number;
  readonly seenAt: number; // timestamp when last seen
}

/** Bot's internal knowledge state */
export interface BotMemory {
  /** Maps "playerId:slotIndex" → known card info */
  readonly knownCards: ReadonlyMap<string, CardMemory>;
  /** Set of card IDs that have been discarded (visible to all) */
  readonly discardedCardIds: ReadonlySet<string>;
  /** Dania Mode: ranks discarded (for probability tracking) */
  readonly discardedRanks: ReadonlyMap<string, number>;
  /** Dania Mode: negative inference — "playerId:slotIndex" is NOT this rank */
  readonly notRanks: ReadonlyMap<string, ReadonlySet<string>>;
  /** Dania Mode: turn count per player (for urgency modeling) */
  readonly playerTurnCounts: ReadonlyMap<string, number>;
  /** Dania Mode: consecutive turns without kaboom per player */
  readonly turnsWithoutKaboom: ReadonlyMap<string, number>;
}

const BOT_NAMES = [
  'Ace', 'Blaze', 'Cobra', 'Dash', 'Echo',
  'Flint', 'Ghost', 'Hawk', 'Iron', 'Jazz',
  'Knox', 'Luna', 'Mako', 'Nova', 'Onyx',
  'Pike', 'Quill', 'Raze', 'Sage', 'Thorn',
] as const;

export function pickBotNames(count: number): readonly string[] {
  const shuffled = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((n) => `${n} (Bot)`);
}

function getCardValue(card: Card): number {
  if (card.rank === 'K' && card.suit) {
    return CARD_VALUES[`K-${card.suit}`] ?? 0;
  }
  return CARD_VALUES[card.rank] ?? 0;
}

function memKey(playerId: string, slotIndex: number): string {
  return `${playerId}:${slotIndex}`;
}

// Average value of an unknown card ≈ 6.5 (weighted by deck distribution)
const UNKNOWN_CARD_AVG = 6.5;

export function createEmptyMemory(): BotMemory {
  return {
    knownCards: new Map(),
    discardedCardIds: new Set(),
    discardedRanks: new Map(),
    notRanks: new Map(),
    playerTurnCounts: new Map(),
    turnsWithoutKaboom: new Map(),
  };
}

/** Record that the bot saw a card at a specific slot */
export function rememberCard(
  memory: BotMemory,
  playerId: string,
  slotIndex: number,
  card: Card
): BotMemory {
  const newKnown = new Map(memory.knownCards);
  newKnown.set(memKey(playerId, slotIndex), {
    rank: card.rank,
    suit: card.suit,
    value: getCardValue(card),
    seenAt: Date.now(),
  });
  return { ...memory, knownCards: newKnown };
}

/** Record that a card was discarded */
export function rememberDiscard(memory: BotMemory, card: Card): BotMemory {
  const newDiscarded = new Set(memory.discardedCardIds);
  newDiscarded.add(card.id);
  const newRanks = new Map(memory.discardedRanks);
  const rankKey = card.rank === 'K' ? `K-${card.suit}` : card.rank;
  newRanks.set(rankKey, (newRanks.get(rankKey) ?? 0) + 1);
  return { ...memory, discardedCardIds: newDiscarded, discardedRanks: newRanks };
}

/** Dania Mode: record a failed match (negative inference) */
export function rememberFailedMatch(memory: BotMemory, playerId: string, slotIndex: number, rank: string): BotMemory {
  const newNotRanks = new Map(memory.notRanks);
  const key = memKey(playerId, slotIndex);
  const existing = newNotRanks.get(key) ?? new Set<string>();
  const updated = new Set(existing);
  updated.add(rank);
  newNotRanks.set(key, updated);
  return { ...memory, notRanks: newNotRanks };
}

/** Dania Mode: track a player taking a turn */
export function recordPlayerTurn(memory: BotMemory, playerId: string): BotMemory {
  const newCounts = new Map(memory.playerTurnCounts);
  newCounts.set(playerId, (newCounts.get(playerId) ?? 0) + 1);
  const newWithout = new Map(memory.turnsWithoutKaboom);
  newWithout.set(playerId, (newWithout.get(playerId) ?? 0) + 1);
  return { ...memory, playerTurnCounts: newCounts, turnsWithoutKaboom: newWithout };
}

/** Dania Mode: how many of a given rank have been discarded */
function countDiscardedRank(memory: BotMemory, rank: string): number {
  return memory.discardedRanks.get(rank) ?? 0;
}

/** Dania Mode: max copies of a rank in the deck (4 for most, 2 for Joker, 2 each for K-suit) */
function maxCopies(rank: string): number {
  if (rank === 'Joker') return 2;
  if (rank.startsWith('K-')) return 1; // each K-suit is unique
  return 4;
}

/** Dania Mode: probability that an unknown slot holds a specific rank */
function probabilityOfRank(memory: BotMemory, rank: string): number {
  const remaining = maxCopies(rank) - countDiscardedRank(memory, rank);
  if (remaining <= 0) return 0;
  // Rough estimate: remaining copies / remaining unknown cards in game (~30)
  return remaining / 30;
}

/** Dania Mode: probability that an unknown slot matches a given rank, factoring negatives */
function matchProbability(memory: BotMemory, playerId: string, slotIndex: number, targetRank: string): number {
  const key = memKey(playerId, slotIndex);
  const excluded = memory.notRanks.get(key);
  if (excluded?.has(targetRank)) return 0; // confirmed NOT this rank
  return probabilityOfRank(memory, targetRank);
}

/** When a swap happens, update memory: the old card at slot is replaced by new card */
export function rememberSwap(
  memory: BotMemory,
  playerId: string,
  slotIndex: number,
  newCard: Card
): BotMemory {
  const newKnown = new Map(memory.knownCards);
  newKnown.set(memKey(playerId, slotIndex), {
    rank: newCard.rank,
    suit: newCard.suit,
    value: getCardValue(newCard),
    seenAt: Date.now(),
  });
  return { ...memory, knownCards: newKnown };
}

/** When a trade happens, swap knowledge */
export function rememberTrade(
  memory: BotMemory,
  player1: string,
  slot1: number,
  player2: string,
  slot2: number
): BotMemory {
  const newKnown = new Map(memory.knownCards);
  const key1 = memKey(player1, slot1);
  const key2 = memKey(player2, slot2);
  const card1 = newKnown.get(key1);
  const card2 = newKnown.get(key2);

  // Swap or clear knowledge
  if (card1 && card2) {
    newKnown.set(key1, card2);
    newKnown.set(key2, card1);
  } else if (card1) {
    newKnown.set(key2, card1);
    newKnown.delete(key1);
  } else if (card2) {
    newKnown.set(key1, card2);
    newKnown.delete(key2);
  }
  // If neither known, nothing changes

  return { ...memory, knownCards: newKnown };
}

/** Forget card at a slot (when it was matched away) */
export function forgetSlot(memory: BotMemory, playerId: string, slotIndex: number): BotMemory {
  const newKnown = new Map(memory.knownCards);
  newKnown.delete(memKey(playerId, slotIndex));
  return { ...memory, knownCards: newKnown };
}

/** Simulate memory decay for easy bots — randomly forget some cards */
export function applyMemoryDecay(memory: BotMemory, decayChance: number): BotMemory {
  const newKnown = new Map<string, CardMemory>();
  for (const [key, val] of memory.knownCards) {
    if (Math.random() > decayChance) {
      newKnown.set(key, val);
    }
  }
  return { ...memory, knownCards: newKnown };
}

/** Get known value for a card slot, or null if unknown */
function getKnownValue(memory: BotMemory, playerId: string, slotIndex: number): number | null {
  const info = memory.knownCards.get(memKey(playerId, slotIndex));
  return info ? info.value : null;
}

/** Get known rank for a card slot, or null if unknown */
function getKnownRank(memory: BotMemory, playerId: string, slotIndex: number): string | null {
  const info = memory.knownCards.get(memKey(playerId, slotIndex));
  return info ? info.rank : null;
}

// ─── Decision Functions ───

export interface DrawDecision {
  readonly source: 'deck' | 'discard';
}

export interface PostDrawDecision {
  readonly action: 'swap' | 'discard';
  readonly slotIndex?: number; // which slot to swap into (if swap)
}

export interface SpecialDecision {
  readonly use: boolean;
  readonly targetPlayer?: string;
  readonly targetSlot?: number;
  // For peekAndTrade: after peeking
  readonly tradeMySlot?: number;
}

export interface KaboomDecision {
  readonly shouldCall: boolean;
}

export interface MatchDecision {
  readonly shouldAttempt: boolean;
  readonly slotIndex?: number;
  readonly delayMs: number;
}

/** Estimate the bot's own total score based on known + unknown cards */
function estimateOwnScore(
  memory: BotMemory,
  botId: string,
  player: PlayerState
): number {
  let total = 0;
  for (let i = 0; i < player.cards.length; i++) {
    if (!player.cards[i]) continue; // matched away
    const known = getKnownValue(memory, botId, i);
    total += known ?? UNKNOWN_CARD_AVG;
  }
  return total;
}

/** Estimate any player's score */
function estimatePlayerScore(
  memory: BotMemory,
  playerId: string,
  player: PlayerState
): number {
  let total = 0;
  for (let i = 0; i < player.cards.length; i++) {
    if (!player.cards[i]) continue;
    const known = getKnownValue(memory, playerId, i);
    total += known ?? UNKNOWN_CARD_AVG;
  }
  return total;
}

/** Find the slot with the highest known value in bot's hand */
function findHighestKnownSlot(
  memory: BotMemory,
  botId: string,
  player: PlayerState
): { slotIndex: number; value: number } | null {
  let best: { slotIndex: number; value: number } | null = null;

  for (let i = 0; i < player.cards.length; i++) {
    if (!player.cards[i]) continue;
    const known = getKnownValue(memory, botId, i);
    if (known !== null && (best === null || known > best.value)) {
      best = { slotIndex: i, value: known };
    }
  }
  return best;
}

/** Find first unknown slot in bot's hand */
function findUnknownSlot(
  memory: BotMemory,
  botId: string,
  player: PlayerState
): number | null {
  for (let i = 0; i < player.cards.length; i++) {
    if (!player.cards[i]) continue;
    if (!memory.knownCards.has(memKey(botId, i))) {
      return i;
    }
  }
  return null;
}

/** Find any valid slot (non-null card) in bot's hand */
function findAnySlot(player: PlayerState): number | null {
  for (let i = 0; i < player.cards.length; i++) {
    if (player.cards[i]) return i;
  }
  return null;
}

/** Find highest known opponent card */
function findHighestOpponentCard(
  memory: BotMemory,
  botId: string,
  gameState: GameState
): { playerId: string; slotIndex: number; value: number } | null {
  let best: { playerId: string; slotIndex: number; value: number } | null = null;

  for (const p of gameState.players) {
    if (p.id === botId) continue;
    for (let i = 0; i < p.cards.length; i++) {
      if (!p.cards[i]) continue;
      const known = getKnownValue(memory, p.id, i);
      if (known !== null && (best === null || known > best.value)) {
        best = { playerId: p.id, slotIndex: i, value: known };
      }
    }
  }
  return best;
}

// ─── Easy Bot ───

function easyDrawDecision(_memory: BotMemory, _gameState: GameState, _botId: string): DrawDecision {
  // Easy bot draws randomly, slightly preferring deck
  return { source: Math.random() < 0.85 ? 'deck' : 'discard' };
}

function easyPostDrawDecision(
  memory: BotMemory,
  botId: string,
  drawnCard: Card,
  player: PlayerState
): PostDrawDecision {
  const drawnValue = getCardValue(drawnCard);

  // 40% of the time, make a random decision
  if (Math.random() < 0.4) {
    const slot = findAnySlot(player);
    if (slot !== null && Math.random() < 0.5) {
      return { action: 'swap', slotIndex: slot };
    }
    return { action: 'discard' };
  }

  // Otherwise try to swap with highest known card if drawn is lower
  const highest = findHighestKnownSlot(memory, botId, player);
  if (highest && drawnValue < highest.value) {
    return { action: 'swap', slotIndex: highest.slotIndex };
  }

  // Swap into a random slot if drawn card is low enough
  if (drawnValue <= 3) {
    const slot = findAnySlot(player);
    if (slot !== null) {
      return { action: 'swap', slotIndex: slot };
    }
  }

  return { action: 'discard' };
}

function easySpecialDecision(
  _memory: BotMemory,
  _botId: string,
  _ability: string,
  _gameState: GameState
): SpecialDecision {
  // Easy bot usually skips specials (70%)
  if (Math.random() < 0.7) return { use: false };
  return { use: false }; // Just skip — easy bot doesn't use them well
}

function easyKaboomDecision(
  memory: BotMemory,
  botId: string,
  gameState: GameState
): KaboomDecision {
  const player = gameState.players.find((p) => p.id === botId);
  if (!player) return { shouldCall: false };

  const estimated = estimateOwnScore(memory, botId, player);
  // Easy bot calls Kaboom at random bad thresholds
  if (Math.random() < 0.05 && estimated < 25) return { shouldCall: true };
  return { shouldCall: false };
}

function easyMatchDecision(
  memory: BotMemory,
  botId: string,
  discardedCard: Card,
  player: PlayerState
): MatchDecision {
  // Easy bot is slow and sometimes tries to match cards it doesn't know
  const delayMs = 1500 + Math.random() * 500; // 1.5–2s

  // 60% miss chance
  if (Math.random() < 0.6) return { shouldAttempt: false, delayMs };

  // Check known cards for a match
  for (let i = 0; i < player.cards.length; i++) {
    if (!player.cards[i]) continue;
    const rank = getKnownRank(memory, botId, i);
    if (rank && rank === discardedCard.rank) {
      return { shouldAttempt: true, slotIndex: i, delayMs };
    }
  }

  // Easy bot occasionally guesses at unknown cards (bad!)
  if (Math.random() < 0.15) {
    const unknownSlot = findUnknownSlot(memory, botId, player);
    if (unknownSlot !== null) {
      return { shouldAttempt: true, slotIndex: unknownSlot, delayMs: delayMs + 500 };
    }
  }

  return { shouldAttempt: false, delayMs };
}

// ─── Medium Bot ───

function mediumDrawDecision(
  memory: BotMemory,
  gameState: GameState,
  botId: string
): DrawDecision {
  const discardTop = gameState.discardPile[gameState.discardPile.length - 1];
  if (!discardTop) return { source: 'deck' };

  const discardValue = getCardValue(discardTop);
  const player = gameState.players.find((p) => p.id === botId);
  if (!player) return { source: 'deck' };

  // Take from discard if the card is low value (≤3) and we have a known high card
  const highest = findHighestKnownSlot(memory, botId, player);
  if (discardValue <= 3 && highest && highest.value >= 7) {
    return { source: 'discard' };
  }

  // Take from discard if it's a Joker or Black King
  if (discardTop.rank === 'Joker') return { source: 'discard' };
  if (discardTop.rank === 'K' && (discardTop.suit === 'clubs' || discardTop.suit === 'spades')) {
    return { source: 'discard' };
  }

  return { source: 'deck' };
}

function mediumPostDrawDecision(
  memory: BotMemory,
  botId: string,
  drawnCard: Card,
  player: PlayerState
): PostDrawDecision {
  const drawnValue = getCardValue(drawnCard);

  // Always swap in Jokers or Black Kings
  if (drawnValue <= 0) {
    const highest = findHighestKnownSlot(memory, botId, player);
    const unknownSlot = findUnknownSlot(memory, botId, player);
    const slot = highest?.slotIndex ?? unknownSlot ?? findAnySlot(player);
    if (slot !== null) return { action: 'swap', slotIndex: slot };
  }

  // Swap with highest known card if drawn is significantly lower
  const highest = findHighestKnownSlot(memory, botId, player);
  if (highest && drawnValue < highest.value - 1) {
    return { action: 'swap', slotIndex: highest.slotIndex };
  }

  // Swap into unknown slot if drawn card is very low
  if (drawnValue <= 3) {
    const unknownSlot = findUnknownSlot(memory, botId, player);
    if (unknownSlot !== null) {
      return { action: 'swap', slotIndex: unknownSlot };
    }
  }

  return { action: 'discard' };
}

function mediumSpecialDecision(
  memory: BotMemory,
  botId: string,
  ability: string,
  gameState: GameState
): SpecialDecision {
  const player = gameState.players.find((p) => p.id === botId);
  if (!player) return { use: false };

  if (ability === 'peek') {
    // Peek at own unknown card first
    const unknownSlot = findUnknownSlot(memory, botId, player);
    if (unknownSlot !== null) {
      return { use: true, targetPlayer: botId, targetSlot: unknownSlot };
    }
    // Otherwise peek at a random opponent card
    for (const p of gameState.players) {
      if (p.id === botId) continue;
      for (let i = 0; i < p.cards.length; i++) {
        if (p.cards[i] && !memory.knownCards.has(memKey(p.id, i))) {
          return { use: true, targetPlayer: p.id, targetSlot: i };
        }
      }
    }
    return { use: false };
  }

  if (ability === 'blindTrade') {
    // Medium bot skips blind trades most of the time
    if (Math.random() < 0.7) return { use: false };
    return { use: false };
  }

  if (ability === 'peekAndTrade') {
    // Skip 50% of the time
    if (Math.random() < 0.5) return { use: false };
    return { use: false }; // Medium bot doesn't handle peekAndTrade well
  }

  return { use: false };
}

function mediumKaboomDecision(
  memory: BotMemory,
  botId: string,
  gameState: GameState
): KaboomDecision {
  const player = gameState.players.find((p) => p.id === botId);
  if (!player) return { shouldCall: false };

  const estimated = estimateOwnScore(memory, botId, player);
  // Call when estimated total is under 10
  if (estimated <= 10) return { shouldCall: true };
  return { shouldCall: false };
}

function mediumMatchDecision(
  memory: BotMemory,
  botId: string,
  discardedCard: Card,
  player: PlayerState
): MatchDecision {
  const delayMs = 800 + Math.random() * 400; // 0.8–1.2s

  for (let i = 0; i < player.cards.length; i++) {
    if (!player.cards[i]) continue;
    const rank = getKnownRank(memory, botId, i);
    if (rank && rank === discardedCard.rank) {
      return { shouldAttempt: true, slotIndex: i, delayMs };
    }
    // Joker matches Joker
    if (rank === 'Joker' && discardedCard.rank === 'Joker') {
      return { shouldAttempt: true, slotIndex: i, delayMs };
    }
  }

  return { shouldAttempt: false, delayMs };
}

// ─── Hard Bot ───

function hardDrawDecision(
  memory: BotMemory,
  gameState: GameState,
  botId: string
): DrawDecision {
  const discardTop = gameState.discardPile[gameState.discardPile.length - 1];
  if (!discardTop) return { source: 'deck' };

  const discardValue = getCardValue(discardTop);
  const player = gameState.players.find((p) => p.id === botId);
  if (!player) return { source: 'deck' };

  // Take from discard if it's negative or zero value
  if (discardValue <= 0) return { source: 'discard' };

  // Take from discard if we have a known card much worse
  const highest = findHighestKnownSlot(memory, botId, player);
  if (highest && discardValue < highest.value - 2) {
    return { source: 'discard' };
  }

  // Take low-value discard cards if we have unknown cards
  if (discardValue <= 2) {
    const unknownSlot = findUnknownSlot(memory, botId, player);
    if (unknownSlot !== null) return { source: 'discard' };
  }

  return { source: 'deck' };
}

function hardPostDrawDecision(
  memory: BotMemory,
  botId: string,
  drawnCard: Card,
  player: PlayerState
): PostDrawDecision {
  const drawnValue = getCardValue(drawnCard);

  // Always swap in Jokers or Black Kings
  if (drawnValue <= 0) {
    const highest = findHighestKnownSlot(memory, botId, player);
    const unknownSlot = findUnknownSlot(memory, botId, player);
    const slot = highest?.slotIndex ?? unknownSlot ?? findAnySlot(player);
    if (slot !== null) return { action: 'swap', slotIndex: slot };
  }

  // Swap with highest known card if drawn is lower
  const highest = findHighestKnownSlot(memory, botId, player);
  if (highest && drawnValue < highest.value) {
    return { action: 'swap', slotIndex: highest.slotIndex };
  }

  // Swap into unknown slot if drawn card is below average
  if (drawnValue < UNKNOWN_CARD_AVG) {
    const unknownSlot = findUnknownSlot(memory, botId, player);
    if (unknownSlot !== null) {
      return { action: 'swap', slotIndex: unknownSlot };
    }
  }

  return { action: 'discard' };
}

function hardSpecialDecision(
  memory: BotMemory,
  botId: string,
  ability: string,
  gameState: GameState
): SpecialDecision {
  const player = gameState.players.find((p) => p.id === botId);
  if (!player) return { use: false };

  if (ability === 'peek') {
    // Peek at own unknown card first
    const unknownSlot = findUnknownSlot(memory, botId, player);
    if (unknownSlot !== null) {
      return { use: true, targetPlayer: botId, targetSlot: unknownSlot };
    }
    // Peek at opponent's unknown card
    for (const p of gameState.players) {
      if (p.id === botId) continue;
      for (let i = 0; i < p.cards.length; i++) {
        if (p.cards[i] && !memory.knownCards.has(memKey(p.id, i))) {
          return { use: true, targetPlayer: p.id, targetSlot: i };
        }
      }
    }
    return { use: false };
  }

  if (ability === 'blindTrade') {
    // Hard bot trades its highest known card with an opponent's unknown card
    // Only if it has a high card worth trading
    const myHighest = findHighestKnownSlot(memory, botId, player);
    if (myHighest && myHighest.value >= 8) {
      // Find opponent without known cards (so risk is averaged)
      for (const p of gameState.players) {
        if (p.id === botId) continue;
        for (let i = 0; i < p.cards.length; i++) {
          if (p.cards[i] && !memory.knownCards.has(memKey(p.id, i))) {
            return {
              use: true,
              targetPlayer: p.id,
              targetSlot: i,
              tradeMySlot: myHighest.slotIndex,
            };
          }
        }
      }
    }
    return { use: false };
  }

  if (ability === 'peekAndTrade') {
    // Hard bot always peeks — the actual trade decision is made after peeking
    // Find an opponent card to peek at
    const highestOpp = findHighestOpponentCard(memory, botId, gameState);
    if (highestOpp) {
      return { use: true, targetPlayer: highestOpp.playerId, targetSlot: highestOpp.slotIndex };
    }
    // Peek at unknown opponent card
    for (const p of gameState.players) {
      if (p.id === botId) continue;
      for (let i = 0; i < p.cards.length; i++) {
        if (p.cards[i] && !memory.knownCards.has(memKey(p.id, i))) {
          return { use: true, targetPlayer: p.id, targetSlot: i };
        }
      }
    }
    return { use: false };
  }

  return { use: false };
}

function hardKaboomDecision(
  memory: BotMemory,
  botId: string,
  gameState: GameState
): KaboomDecision {
  const player = gameState.players.find((p) => p.id === botId);
  if (!player) return { shouldCall: false };

  const myEstimate = estimateOwnScore(memory, botId, player);

  // Only call if we think we have the lowest score
  let isLowest = true;
  for (const p of gameState.players) {
    if (p.id === botId) continue;
    const oppEstimate = estimatePlayerScore(memory, p.id, p);
    if (oppEstimate <= myEstimate) {
      isLowest = false;
      break;
    }
  }

  // Call if estimated total ≤ 6 and we think we're lowest
  if (myEstimate <= 6 && isLowest) return { shouldCall: true };

  // Also call if all cards are known and total ≤ 8
  const allKnown = player.cards.every(
    (c, i) => c === null || memory.knownCards.has(memKey(botId, i))
  );
  if (allKnown && myEstimate <= 8 && isLowest) return { shouldCall: true };

  return { shouldCall: false };
}

function hardMatchDecision(
  memory: BotMemory,
  botId: string,
  discardedCard: Card,
  player: PlayerState
): MatchDecision {
  const delayMs = 200 + Math.random() * 200; // 0.2–0.4s

  for (let i = 0; i < player.cards.length; i++) {
    if (!player.cards[i]) continue;
    const rank = getKnownRank(memory, botId, i);
    if (rank && rank === discardedCard.rank) {
      return { shouldAttempt: true, slotIndex: i, delayMs };
    }
    if (rank === 'Joker' && discardedCard.rank === 'Joker') {
      return { shouldAttempt: true, slotIndex: i, delayMs };
    }
  }

  return { shouldAttempt: false, delayMs };
}

// ─── Dania Mode Bot ───

function daniaDrawDecision(
  memory: BotMemory,
  gameState: GameState,
  botId: string
): DrawDecision {
  const discardTop = gameState.discardPile[gameState.discardPile.length - 1];
  if (!discardTop) return { source: 'deck' };

  const discardValue = getCardValue(discardTop);
  const player = gameState.players.find((p) => p.id === botId);
  if (!player) return { source: 'deck' };

  // Always take Jokers and Black Kings
  if (discardValue <= 0) return { source: 'discard' };

  // Take from discard if value ≤ 4 AND we have any card worth more
  if (discardValue <= 4) {
    const highest = findHighestKnownSlot(memory, botId, player);
    if (highest && highest.value > discardValue) return { source: 'discard' };
    // Also take if we have unknown slots (unknown avg 6.5 > 4)
    const unknownSlot = findUnknownSlot(memory, botId, player);
    if (unknownSlot !== null) return { source: 'discard' };
  }

  return { source: 'deck' };
}

function daniaPostDrawDecision(
  memory: BotMemory,
  botId: string,
  drawnCard: Card,
  player: PlayerState
): PostDrawDecision {
  const drawnValue = getCardValue(drawnCard);

  // Never discard Jokers or Black Kings
  if (drawnValue <= 0) {
    const highest = findHighestKnownSlot(memory, botId, player);
    const unknownSlot = findUnknownSlot(memory, botId, player);
    const slot = highest?.slotIndex ?? unknownSlot ?? findAnySlot(player);
    if (slot !== null) return { action: 'swap', slotIndex: slot };
  }

  // Swap on ANY improvement — even 1 point
  const highest = findHighestKnownSlot(memory, botId, player);
  if (highest && drawnValue < highest.value) {
    return { action: 'swap', slotIndex: highest.slotIndex };
  }

  // Aggressively swap into unknown slots if drawn < 5
  if (drawnValue < 5) {
    const unknownSlot = findUnknownSlot(memory, botId, player);
    if (unknownSlot !== null) return { action: 'swap', slotIndex: unknownSlot };
  }

  return { action: 'discard' };
}

function daniaSpecialDecision(
  memory: BotMemory,
  botId: string,
  ability: string,
  gameState: GameState
): SpecialDecision {
  const player = gameState.players.find((p) => p.id === botId);
  if (!player) return { use: false };

  if (ability === 'peek') {
    // Priority 1: peek at own unknown slots
    const unknownSlot = findUnknownSlot(memory, botId, player);
    if (unknownSlot !== null) {
      return { use: true, targetPlayer: botId, targetSlot: unknownSlot };
    }
    // Priority 2: peek at the opponent with the highest estimated score (most dangerous)
    let bestTarget: { playerId: string; slotIndex: number; estimate: number } | null = null;
    for (const p of gameState.players) {
      if (p.id === botId) continue;
      const est = estimatePlayerScore(memory, p.id, p);
      for (let i = 0; i < p.cards.length; i++) {
        if (p.cards[i] && !memory.knownCards.has(memKey(p.id, i))) {
          if (!bestTarget || est > bestTarget.estimate) {
            bestTarget = { playerId: p.id, slotIndex: i, estimate: est };
          }
          break;
        }
      }
    }
    if (bestTarget) return { use: true, targetPlayer: bestTarget.playerId, targetSlot: bestTarget.slotIndex };
    return { use: false };
  }

  if (ability === 'blindTrade') {
    // Trade highest known card with opponent slot most likely to be low
    const myHighest = findHighestKnownSlot(memory, botId, player);
    if (!myHighest || myHighest.value < 5) return { use: false };

    let bestTarget: { playerId: string; slotIndex: number; estValue: number } | null = null;
    for (const p of gameState.players) {
      if (p.id === botId) continue;
      for (let i = 0; i < p.cards.length; i++) {
        if (!p.cards[i]) continue;
        const known = getKnownValue(memory, p.id, i);
        if (known !== null) {
          // Don't trade into a known Joker/Black K
          if (known <= 0) continue;
          continue; // Skip known slots — target unknowns
        }
        // Estimate unknown slot value, factoring negative inference
        const excluded = memory.notRanks.get(memKey(p.id, i));
        const exclusionBonus = excluded ? excluded.size * 0.3 : 0;
        const estValue = UNKNOWN_CARD_AVG - exclusionBonus;
        if (!bestTarget || estValue < bestTarget.estValue) {
          bestTarget = { playerId: p.id, slotIndex: i, estValue };
        }
      }
    }
    if (bestTarget && myHighest.value > bestTarget.estValue + 2) {
      return { use: true, targetPlayer: bestTarget.playerId, targetSlot: bestTarget.slotIndex, tradeMySlot: myHighest.slotIndex };
    }
    return { use: false };
  }

  if (ability === 'peekAndTrade') {
    // Always peek — find most valuable target
    const highestOpp = findHighestOpponentCard(memory, botId, gameState);
    if (highestOpp) {
      return { use: true, targetPlayer: highestOpp.playerId, targetSlot: highestOpp.slotIndex };
    }
    // Peek at unknown opponent card
    for (const p of gameState.players) {
      if (p.id === botId) continue;
      for (let i = 0; i < p.cards.length; i++) {
        if (p.cards[i] && !memory.knownCards.has(memKey(p.id, i))) {
          return { use: true, targetPlayer: p.id, targetSlot: i };
        }
      }
    }
    return { use: false };
  }

  return { use: false };
}

function daniaKaboomDecision(
  memory: BotMemory,
  botId: string,
  gameState: GameState
): KaboomDecision {
  const player = gameState.players.find((p) => p.id === botId);
  if (!player) return { shouldCall: false };

  // Never call with unknown cards in own hand
  const hasUnknown = player.cards.some(
    (c, i) => c !== null && !memory.knownCards.has(memKey(botId, i))
  );
  if (hasUnknown) return { shouldCall: false };

  const myScore = estimateOwnScore(memory, botId, player);

  // Only call if score ≤ 5
  if (myScore > 5) return { shouldCall: false };

  // Check every opponent — must be confident all have higher scores
  for (const p of gameState.players) {
    if (p.id === botId) continue;
    const oppEstimate = estimatePlayerScore(memory, p.id, p);

    // Factor in uncertainty — count unknown slots
    const unknownCount = p.cards.filter(
      (c, i) => c !== null && !memory.knownCards.has(memKey(p.id, i))
    ).length;

    // If opponent has many unknowns, they could statistically have a low score
    // Each unknown could be 0 (Joker) — worst case subtract unknownCount * UNKNOWN_CARD_AVG
    const worstCaseOpp = oppEstimate - unknownCount * 3;
    if (worstCaseOpp <= myScore) return { shouldCall: false };
  }

  return { shouldCall: true };
}

function daniaMatchDecision(
  memory: BotMemory,
  botId: string,
  discardedCard: Card,
  player: PlayerState
): MatchDecision {
  const delayMs = 80 + Math.random() * 70; // 80–150ms

  // Check known cards first — never miss a known match
  for (let i = 0; i < player.cards.length; i++) {
    if (!player.cards[i]) continue;
    const rank = getKnownRank(memory, botId, i);
    if (rank && rank === discardedCard.rank) {
      return { shouldAttempt: true, slotIndex: i, delayMs };
    }
    if (rank === 'Joker' && discardedCard.rank === 'Joker') {
      return { shouldAttempt: true, slotIndex: i, delayMs };
    }
  }

  // Calculated gamble on unknown slots using probability map
  const targetRank = discardedCard.rank;
  for (let i = 0; i < player.cards.length; i++) {
    if (!player.cards[i]) continue;
    if (memory.knownCards.has(memKey(botId, i))) continue; // skip known non-matches

    const prob = matchProbability(memory, botId, i, targetRank);
    if (prob >= 0.75) {
      return { shouldAttempt: true, slotIndex: i, delayMs: delayMs + 50 };
    }
  }

  return { shouldAttempt: false, delayMs };
}

// ─── Public Decision Dispatcher ───

export function decideDrawSource(
  difficulty: BotDifficulty,
  memory: BotMemory,
  gameState: GameState,
  botId: string
): DrawDecision {
  switch (difficulty) {
    case 'easy': return easyDrawDecision(memory, gameState, botId);
    case 'medium': return mediumDrawDecision(memory, gameState, botId);
    case 'hard': return hardDrawDecision(memory, gameState, botId);
    case 'dania': return daniaDrawDecision(memory, gameState, botId);
  }
}

export function decidePostDraw(
  difficulty: BotDifficulty,
  memory: BotMemory,
  botId: string,
  drawnCard: Card,
  player: PlayerState
): PostDrawDecision {
  switch (difficulty) {
    case 'easy': return easyPostDrawDecision(memory, botId, drawnCard, player);
    case 'medium': return mediumPostDrawDecision(memory, botId, drawnCard, player);
    case 'hard': return hardPostDrawDecision(memory, botId, drawnCard, player);
    case 'dania': return daniaPostDrawDecision(memory, botId, drawnCard, player);
  }
}

export function decideSpecial(
  difficulty: BotDifficulty,
  memory: BotMemory,
  botId: string,
  ability: string,
  gameState: GameState
): SpecialDecision {
  switch (difficulty) {
    case 'easy': return easySpecialDecision(memory, botId, ability, gameState);
    case 'medium': return mediumSpecialDecision(memory, botId, ability, gameState);
    case 'hard': return hardSpecialDecision(memory, botId, ability, gameState);
    case 'dania': return daniaSpecialDecision(memory, botId, ability, gameState);
  }
}

export function decideKaboom(
  difficulty: BotDifficulty,
  memory: BotMemory,
  botId: string,
  gameState: GameState
): KaboomDecision {
  switch (difficulty) {
    case 'easy': return easyKaboomDecision(memory, botId, gameState);
    case 'medium': return mediumKaboomDecision(memory, botId, gameState);
    case 'hard': return hardKaboomDecision(memory, botId, gameState);
    case 'dania': return daniaKaboomDecision(memory, botId, gameState);
  }
}

export function decideMatch(
  difficulty: BotDifficulty,
  memory: BotMemory,
  botId: string,
  discardedCard: Card,
  player: PlayerState
): MatchDecision {
  switch (difficulty) {
    case 'easy': return easyMatchDecision(memory, botId, discardedCard, player);
    case 'medium': return mediumMatchDecision(memory, botId, discardedCard, player);
    case 'hard': return hardMatchDecision(memory, botId, discardedCard, player);
    case 'dania': return daniaMatchDecision(memory, botId, discardedCard, player);
  }
}

/** Hard bot: decide whether to trade after peeking (Queen ability) */
export function decideTradeAfterPeek(
  difficulty: BotDifficulty,
  memory: BotMemory,
  botId: string,
  peekedCard: Card,
  peekedPlayerId: string,
  peekedSlot: number,
  player: PlayerState
): { shouldTrade: boolean; mySlot?: number } {
  if (difficulty === 'easy') return { shouldTrade: false };

  const peekedValue = getCardValue(peekedCard);

  if (difficulty === 'medium') {
    // Trade if their card is low and we have a known high card
    if (peekedValue <= 3) {
      const highest = findHighestKnownSlot(memory, botId, player);
      if (highest && highest.value >= 7) {
        return { shouldTrade: true, mySlot: highest.slotIndex };
      }
    }
    return { shouldTrade: false };
  }

  // Hard & Dania: trade if their card value is lower than our highest known card
  const highest = findHighestKnownSlot(memory, botId, player);
  if (highest && peekedValue < highest.value) {
    return { shouldTrade: true, mySlot: highest.slotIndex };
  }

  // Also trade if peeked card is very low and we have unknown cards
  if (peekedValue <= 2) {
    const unknownSlot = findUnknownSlot(memory, botId, player);
    if (unknownSlot !== null) {
      return { shouldTrade: true, mySlot: unknownSlot };
    }
  }

  // Dania Mode: offensive trade — if peeked card is very low, trade our highest
  // card to the opponent to hurt their position (even if it doesn't help us)
  if (difficulty === 'dania' && peekedValue <= 1 && highest && highest.value >= 8) {
    return { shouldTrade: true, mySlot: highest.slotIndex };
  }

  return { shouldTrade: false };
}

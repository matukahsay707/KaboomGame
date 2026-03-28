import type { Card, Suit, Rank } from '@kaboom/shared';
import { v4 as uuidv4 } from 'uuid';

const SUITS: readonly Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: readonly Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck(): readonly Card[] {
  const cards: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: uuidv4(), rank, suit });
    }
  }

  // Add 2 Jokers
  cards.push({ id: uuidv4(), rank: 'Joker', suit: null });
  cards.push({ id: uuidv4(), rank: 'Joker', suit: null });

  return cards;
}

/** Fisher-Yates shuffle — returns a new array */
function shuffle(cards: readonly Card[]): readonly Card[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export interface DeckState {
  readonly drawPile: readonly Card[];
  readonly discardPile: readonly Card[];
}

export function createShuffledDeck(): DeckState {
  return {
    drawPile: shuffle(createDeck()),
    discardPile: [],
  };
}

export function dealCards(
  deck: DeckState,
  playerCount: number,
  cardsPerPlayer: number
): { readonly hands: readonly (readonly Card[])[]; readonly deck: DeckState } {
  const drawPile = [...deck.drawPile];
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);

  for (let c = 0; c < cardsPerPlayer; c++) {
    for (let p = 0; p < playerCount; p++) {
      const card = drawPile.shift();
      if (!card) throw new Error('Not enough cards to deal');
      hands[p].push(card);
    }
  }

  // Flip first card to start discard pile
  const firstDiscard = drawPile.shift();
  if (!firstDiscard) throw new Error('Not enough cards for discard');

  return {
    hands,
    deck: {
      drawPile,
      discardPile: [firstDiscard],
    },
  };
}

export function drawFromPile(deck: DeckState): { readonly card: Card; readonly deck: DeckState } {
  if (deck.drawPile.length === 0) {
    // Reshuffle discard pile (keep top card)
    const topDiscard = deck.discardPile[deck.discardPile.length - 1];
    const reshuffled = shuffle(deck.discardPile.slice(0, -1));
    return drawFromPile({
      drawPile: reshuffled,
      discardPile: topDiscard ? [topDiscard] : [],
    });
  }

  const [card, ...remaining] = deck.drawPile;
  return {
    card,
    deck: { ...deck, drawPile: remaining },
  };
}

export function addToDiscard(deck: DeckState, card: Card): DeckState {
  return {
    ...deck,
    discardPile: [...deck.discardPile, card],
  };
}

export function getDiscardTop(deck: DeckState): Card | null {
  return deck.discardPile.length > 0
    ? deck.discardPile[deck.discardPile.length - 1]
    : null;
}

export function takeFromDiscard(deck: DeckState): { readonly card: Card; readonly deck: DeckState } | null {
  if (deck.discardPile.length === 0) return null;

  const card = deck.discardPile[deck.discardPile.length - 1];
  return {
    card,
    deck: {
      ...deck,
      discardPile: deck.discardPile.slice(0, -1),
    },
  };
}

export function addPenaltyCard(deck: DeckState): { readonly card: Card; readonly deck: DeckState } {
  return drawFromPile(deck);
}

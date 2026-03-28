export const GAME_CONFIG = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 6,
  CARDS_PER_PLAYER: 4,
  MATCH_WINDOW_MS: 4000,
  SIMULTANEOUS_THRESHOLD_MS: 100,
  ROOM_CODE_LENGTH: 6,
  PEEK_CARDS_COUNT: 2,
} as const;

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'Joker';

export const CARD_VALUES: Record<string, number> = {
  'A': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 10,
  'Q': 10,
  'K-hearts': 25,
  'K-diamonds': 25,
  'K-clubs': 0,
  'K-spades': 0,
  'Joker': -1,
};

export const SPECIAL_RANKS: readonly Rank[] = ['10', 'J', 'Q'] as const;

export type SpecialAbility = 'peek' | 'blindTrade' | 'peekAndTrade';

export const RANK_ABILITIES: Partial<Record<Rank, SpecialAbility>> = {
  '10': 'peek',
  'J': 'blindTrade',
  'Q': 'peekAndTrade',
};

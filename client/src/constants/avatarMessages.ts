/** All avatar speech bubble messages — centralized for easy editing and localization */

export const AVATAR_MESSAGES = {
  // Sneak peek
  sneakPeek: 'Memorize your bottom 2 cards',

  // Peek
  peekPrompt: 'Tap any card to peek at it',
  queenTradePrompt: 'Trade a card? Tap yours then theirs — or skip',

  // Trade
  blindTradePickYours: 'Pick one of your cards to trade',
  tradePickOpponent: "Now tap an opponent's card",

  // Turn
  yourTurnDraw: 'Draw a card or take from the discard',
  cardDrawnDecision: 'Swap with a slot or discard it',

  // Special cards drawn
  specialDrawn10: 'Peek ability — swap, peek, or discard',
  specialDrawnJack: 'Blind trade — swap, trade, or discard',
  specialDrawnQueen: 'Queen — swap, peek, trade, or discard',

  // Matching
  matchWindowOpen: 'Tap your card fast if you have a match',
  matchSuccess: 'Nice match',
  matchPenalty: 'Wrong match — penalty card incoming',

  // Kaboom
  someoneCalledKaboom: 'Last round — make it count',

  // Timer
  timerWarning: 'Hurry up — 5 seconds left',
  timerTimeout: 'Too slow — auto draw',
} as const;

export type AvatarMessageKey = keyof typeof AVATAR_MESSAGES;

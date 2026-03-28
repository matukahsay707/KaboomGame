import type { Suit, Rank } from './constants.js';

export type GamePhase =
  | 'WAITING'
  | 'PEEK_PHASE'
  | 'PLAYER_TURN'
  | 'SPECIAL_ACTION'
  | 'MATCH_WINDOW'
  | 'KABOOM_FINAL'
  | 'REVEAL'
  | 'GAME_OVER';

export interface Card {
  readonly id: string;
  readonly rank: Rank;
  readonly suit: Suit | null; // null for Jokers
}

export interface HiddenCard {
  readonly slotIndex: number;
  readonly faceDown: true;
}

export type VisibleCard = Card & { readonly slotIndex: number };

export type ClientCard = HiddenCard | VisibleCard;

export interface PlayerState {
  readonly id: string;
  readonly displayName: string;
  readonly cards: readonly (Card | null)[]; // null = matched away
  readonly connected: boolean;
  readonly hasPeeked: boolean;
  readonly hasFinalTurn: boolean;
  readonly calledKaboom: boolean;
}

export interface ClientPlayerState {
  readonly id: string;
  readonly displayName: string;
  readonly cards: readonly (ClientCard | null)[];
  readonly connected: boolean;
  readonly calledKaboom: boolean;
  readonly cardCount: number;
}

export interface GameState {
  readonly phase: GamePhase;
  readonly players: readonly PlayerState[];
  readonly activePlayerId: string | null;
  readonly drawPile: readonly Card[];
  readonly discardPile: readonly Card[];
  readonly drawnCard: Card | null;
  readonly matchWindow: MatchWindowState | null;
  readonly kaboomCallerId: string | null;
  readonly finalRoundPlayersRemaining: readonly string[];
  readonly turnOrder: readonly string[];
  readonly turnIndex: number;
}

export interface ClientGameState {
  readonly phase: GamePhase;
  readonly you: ClientPlayerState;
  readonly opponents: readonly ClientPlayerState[];
  readonly activePlayerId: string | null;
  readonly discardTop: Card | null;
  readonly drawPileCount: number;
  readonly drawnCard: Card | null; // only visible to the active player
  readonly matchWindow: ClientMatchWindow | null;
  readonly kaboomCallerId: string | null;
  readonly turnOrder: readonly string[];
}

export interface MatchWindowState {
  readonly discardedCard: Card;
  readonly startTime: number;
  readonly duration: number;
  readonly attempts: readonly MatchAttempt[];
}

export interface ClientMatchWindow {
  readonly discardedCard: Card;
  readonly duration: number;
  readonly startTime: number;
}

export interface MatchAttempt {
  readonly playerId: string;
  readonly slotIndex: number;
  readonly timestamp: number;
}

export interface RoomState {
  readonly roomCode: string;
  readonly hostId: string;
  readonly players: readonly RoomPlayer[];
  readonly maxPlayers: number;
  readonly gameInProgress: boolean;
}

export interface RoomPlayer {
  readonly id: string;
  readonly displayName: string;
  readonly ready: boolean;
}

export interface PlayerScore {
  readonly playerId: string;
  readonly displayName: string;
  readonly cards: readonly (Card | null)[];
  readonly score: number;
  readonly isWinner: boolean;
  readonly calledKaboom: boolean;
}

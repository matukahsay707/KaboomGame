import type { Card, ClientGameState, RoomState, RoomPlayer, PlayerScore, ClientMatchWindow } from './game.js';
import type { SpecialAbility } from './constants.js';

// Client → Server events
export interface ClientToServerEvents {
  'room:create': (payload: { maxPlayers: number }) => void;
  'room:join': (payload: { roomCode: string }) => void;
  'room:leave': () => void;
  'game:start': () => void;
  'game:peekDone': () => void;
  'game:drawDeck': () => void;
  'game:drawDiscard': () => void;
  'game:swap': (payload: { slotIndex: number }) => void;
  'game:discard': () => void;
  'game:discardUseSpecial': () => void;
  'game:useSpecial': (payload: { ability: SpecialAbility; targetPlayer?: string; targetSlot?: number }) => void;
  'game:skipSpecial': () => void;
  'game:peekResult': (payload: { slotIndex: number }) => void;
  'game:tradeSelect': (payload: { mySlot: number; targetPlayer: string; targetSlot: number }) => void;
  'game:matchAttempt': (payload: { slotIndex: number }) => void;
  'game:callKaboom': () => void;
  'bot:start': (payload: { difficulty: string; botCount?: number }) => void;
  'room:rejoin': () => void;
  'game:restart': () => void;
  'matchmaking:join': (payload: { playerCount: number }) => void;
  'matchmaking:cancel': () => void;
}

// Server → Client events
export interface ServerToClientEvents {
  'room:created': (payload: { roomCode: string; roomState: RoomState }) => void;
  'room:playerJoined': (payload: { player: RoomPlayer; roomState: RoomState }) => void;
  'room:playerLeft': (payload: { playerId: string; roomState: RoomState }) => void;
  'game:started': (payload: { gameState: ClientGameState }) => void;
  'game:peekCards': (payload: { bottomCards: readonly Card[] }) => void;
  'game:allPeeked': () => void;
  'game:turnStart': (payload: { activePlayerId: string }) => void;
  'game:cardDrawn': (payload: { source: 'deck' | 'discard'; card: Card | null }) => void;
  'game:cardSwapped': (payload: { playerId: string; slotIndex: number; discardedCard: Card }) => void;
  'game:cardDiscarded': (payload: { discardedCard: Card }) => void;
  'game:specialPrompt': (payload: { cardRank: string; ability: SpecialAbility }) => void;
  'game:peekStart': (payload: { peekingPlayerId: string; targetPlayerId: string; targetSlotIndex: number }) => void;
  'game:peekReveal': (payload: { card: Card; slotIndex: number }) => void;
  'game:tradeStart': (payload: { tradingPlayerId: string; tradingSlotIndex: number; targetPlayerId: string; targetSlotIndex: number }) => void;
  'game:tradeComplete': (payload: { player1: string; slot1: number; player2: string; slot2: number }) => void;
  'game:actionAnnounce': (payload: { type: 'peek' | 'blindTrade' | 'queenPeek' | 'queenPeekTrade' | 'queenTrade'; playerId: string; playerName: string; targetPlayerName?: string }) => void;
  'game:matchWindow': (payload: ClientMatchWindow) => void;
  'game:matchSuccess': (payload: { matcherId: string; slotIndex: number }) => void;
  'game:matchFail': (payload: { playerId: string; penaltyCard: boolean }) => void;
  'game:matchWindowClosed': () => void;
  'game:kaboomCalled': (payload: { playerId: string }) => void;
  'game:daniaKaboom': (payload: { playerId: string }) => void;
  'game:reveal': (payload: { players: readonly PlayerScore[] }) => void;
  'game:winner': (payload: { winnerIds: readonly string[]; players: readonly PlayerScore[] }) => void;
  'game:error': (payload: { message: string }) => void;
  'game:stateUpdate': (payload: { gameState: ClientGameState }) => void;
  'room:rejoined': (payload: { roomState: RoomState; gameState: ClientGameState | null }) => void;
  'game:backToLobby': (payload: { roomState: RoomState }) => void;
  'matchmaking:waiting': (payload: { currentCount: number; targetCount: number }) => void;
  'matchmaking:update': (payload: { currentCount: number; targetCount: number }) => void;
  'matchmaking:found': (payload: { roomCode: string; roomState: RoomState }) => void;
  'matchmaking:cancelled': () => void;
}

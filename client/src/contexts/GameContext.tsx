import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { ClientGameState, RoomState, Card, PlayerScore } from '@kaboom/shared';
import { useSocket, type ConnectionStatus } from '../hooks/useSocket.tsx';

export interface GameContextType {
  roomState: RoomState | null;
  gameState: ClientGameState | null;
  drawnCard: Card | null;
  peekCards: readonly Card[];
  scores: readonly PlayerScore[] | null;
  winnerIds: readonly string[] | null;
  error: string | null;
  specialPrompt: { cardRank: string; ability: string } | null;
  matchWindow: { discardedCard: Card; duration: number; startTime: number } | null;
  peekReveal: { card: Card; playerId: string; slotIndex: number } | null;
  connectionStatus: ConnectionStatus;
  reconnectAttempt: number;
  createRoom: (maxPlayers: number) => void;
  joinRoom: (roomCode: string) => void;
  leaveRoom: () => void;
  startGame: () => void;
  peekDone: () => void;
  drawFromDeck: () => void;
  drawFromDiscard: () => void;
  swapCard: (slotIndex: number) => void;
  discardCard: () => void;
  discardUseSpecial: () => void;
  useSpecial: (ability: string, targetPlayer?: string, targetSlot?: number) => void;
  skipSpecial: () => void;
  peekResult: (slotIndex: number) => void;
  tradeSelect: (mySlot: number, targetPlayer: string, targetSlot: number) => void;
  matchAttempt: (slotIndex: number) => void;
  callKaboom: () => void;
  startBotGame: (difficulty: string, botCount?: number) => void;
  restartGame: () => void;
  joinMatchmaking: (playerCount: number) => void;
  cancelMatchmaking: () => void;
  matchmakingStatus: { currentCount: number; targetCount: number } | null;
  daniaKaboom: boolean;
  clearError: () => void;
  forceReconnect: () => void;
  socket: ReturnType<typeof import('../hooks/useSocket.tsx').useSocket>['socket'];
}

export const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { readonly children: ReactNode }) {
  const { socket, connected, status, reconnectAttempt, forceReconnect } = useSocket();
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [drawnCard, setDrawnCard] = useState<Card | null>(null);
  const [peekCards, setPeekCards] = useState<readonly Card[]>([]);
  const [scores, setScores] = useState<readonly PlayerScore[] | null>(null);
  const [winnerIds, setWinnerIds] = useState<readonly string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [specialPrompt, setSpecialPrompt] = useState<{ cardRank: string; ability: string } | null>(null);
  const [matchWindow, setMatchWindow] = useState<{ discardedCard: Card; duration: number; startTime: number } | null>(null);
  const [peekReveal, setPeekReveal] = useState<{ card: Card; playerId: string; slotIndex: number } | null>(null);
  const [peekTargetRef] = useState<{ playerId: string | null }>({ playerId: null });
  const [matchmakingStatus, setMatchmakingStatus] = useState<{ currentCount: number; targetCount: number } | null>(null);
  const [daniaKaboom, setDaniaKaboom] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Auto-rejoin on connect — checks if we were in a room
    socket.emit('room:rejoin');

    socket.on('room:created', ({ roomState: rs }) => setRoomState(rs));
    socket.on('room:playerJoined', ({ roomState: rs }) => setRoomState(rs));
    socket.on('room:playerLeft', ({ roomState: rs }) => setRoomState(rs));

    // Handle rejoin — restore room and game state
    socket.on('room:rejoined', ({ roomState: rs, gameState: gs }) => {
      setRoomState(rs);
      if (gs) {
        setGameState(gs);
        setScores(null);
        setWinnerIds(null);
        setDrawnCard(null);
      }
    });

    socket.on('game:started', ({ gameState: gs }) => {
      setGameState(gs);
      setScores(null);
      setWinnerIds(null);
      setDrawnCard(null);
    });

    socket.on('game:peekCards', ({ bottomCards }) => setPeekCards(bottomCards));
    socket.on('game:allPeeked', () => setPeekCards([]));

    socket.on('game:stateUpdate', ({ gameState: gs }) => setGameState(gs));

    socket.on('game:cardDrawn', ({ card }) => {
      if (card) setDrawnCard(card);
    });

    socket.on('game:cardSwapped', () => setDrawnCard(null));
    socket.on('game:cardDiscarded', () => setDrawnCard(null));

    socket.on('game:specialPrompt', (prompt) => setSpecialPrompt(prompt));

    socket.on('game:peekReveal', ({ card, slotIndex }) => {
      const playerId = peekTargetRef.playerId ?? 'unknown';
      setPeekReveal({ card, playerId, slotIndex });
      // Auto-clear after 2 seconds
      setTimeout(() => setPeekReveal(null), 2000);
    });

    socket.on('game:daniaKaboom', () => {
      setDaniaKaboom(true);
      setTimeout(() => setDaniaKaboom(false), 4000);
    });

    socket.on('game:matchWindow', (mw) => setMatchWindow(mw));
    socket.on('game:matchWindowClosed', () => setMatchWindow(null));
    socket.on('game:matchSuccess', () => setMatchWindow(null));

    socket.on('game:reveal', ({ players }) => setScores(players));
    socket.on('game:winner', ({ winnerIds: wids }) => setWinnerIds(wids));

    socket.on('game:error', ({ message }) => setError(message));

    socket.on('game:backToLobby', ({ roomState: rs }) => {
      setRoomState(rs);
      setGameState(null);
      setScores(null);
      setWinnerIds(null);
      setDrawnCard(null);
      setPeekCards([]);
      setSpecialPrompt(null);
      setMatchWindow(null);
      setPeekReveal(null);
    });

    // Matchmaking events
    socket.on('matchmaking:waiting', (status) => setMatchmakingStatus(status));
    socket.on('matchmaking:update', (status) => setMatchmakingStatus(status));
    socket.on('matchmaking:found', ({ roomState: rs }) => {
      setMatchmakingStatus(null);
      setRoomState(rs);
    });
    socket.on('matchmaking:cancelled', () => setMatchmakingStatus(null));

    return () => {
      socket.removeAllListeners();
    };
  }, [socket]);

  const createRoom = useCallback((maxPlayers: number) => {
    socket?.emit('room:create', { maxPlayers });
  }, [socket]);

  const joinRoom = useCallback((roomCode: string) => {
    socket?.emit('room:join', { roomCode });
  }, [socket]);

  const leaveRoom = useCallback(() => {
    socket?.emit('room:leave');
    setRoomState(null);
    setGameState(null);
  }, [socket]);

  const startGame = useCallback(() => {
    socket?.emit('game:start');
  }, [socket]);

  const peekDone = useCallback(() => {
    socket?.emit('game:peekDone');
  }, [socket]);

  const drawFromDeck = useCallback(() => {
    socket?.emit('game:drawDeck');
  }, [socket]);

  const drawFromDiscard = useCallback(() => {
    socket?.emit('game:drawDiscard');
  }, [socket]);

  const swapCard = useCallback((slotIndex: number) => {
    socket?.emit('game:swap', { slotIndex });
  }, [socket]);

  const discardCard = useCallback(() => {
    socket?.emit('game:discard');
    setDrawnCard(null);
  }, [socket]);

  const discardUseSpecial = useCallback(() => {
    socket?.emit('game:discardUseSpecial');
    setDrawnCard(null);
  }, [socket]);

  const useSpecial = useCallback((ability: string, targetPlayer?: string, targetSlot?: number) => {
    // Save peek target so peekReveal handler knows which player
    if (ability === 'peek' && targetPlayer) {
      peekTargetRef.playerId = targetPlayer;
    }
    socket?.emit('game:useSpecial', {
      ability: ability as 'peek' | 'blindTrade' | 'peekAndTrade',
      targetPlayer,
      targetSlot,
    });
    setSpecialPrompt(null);
  }, [socket, peekTargetRef]);

  const skipSpecial = useCallback(() => {
    socket?.emit('game:skipSpecial');
    setSpecialPrompt(null);
  }, [socket]);

  const peekResult = useCallback((slotIndex: number) => {
    socket?.emit('game:peekResult', { slotIndex });
  }, [socket]);

  const tradeSelect = useCallback((mySlot: number, targetPlayer: string, targetSlot: number) => {
    socket?.emit('game:tradeSelect', { mySlot, targetPlayer, targetSlot });
    setSpecialPrompt(null);
  }, [socket]);

  const matchAttempt = useCallback((slotIndex: number) => {
    socket?.emit('game:matchAttempt', { slotIndex });
  }, [socket]);

  const callKaboom = useCallback(() => {
    socket?.emit('game:callKaboom');
  }, [socket]);

  const startBotGame = useCallback((difficulty: string, botCount?: number) => {
    socket?.emit('bot:start', { difficulty, botCount: botCount ?? 3 });
  }, [socket]);

  const restartGame = useCallback(() => {
    socket?.emit('game:restart');
  }, [socket]);

  const joinMatchmaking = useCallback((playerCount: number) => {
    socket?.emit('matchmaking:join', { playerCount });
  }, [socket]);

  const cancelMatchmaking = useCallback(() => {
    socket?.emit('matchmaking:cancel');
    setMatchmakingStatus(null);
  }, [socket]);

  const clearError = useCallback(() => setError(null), []);

  return (
    <GameContext.Provider
      value={{
        roomState,
        gameState,
        drawnCard,
        peekCards,
        scores,
        winnerIds,
        error,
        specialPrompt,
        matchWindow,
        peekReveal,
        connectionStatus: status,
        reconnectAttempt,
        createRoom,
        joinRoom,
        leaveRoom,
        startGame,
        peekDone,
        drawFromDeck,
        drawFromDiscard,
        swapCard,
        discardCard,
        discardUseSpecial,
        useSpecial,
        skipSpecial,
        peekResult,
        tradeSelect,
        matchAttempt,
        callKaboom,
        startBotGame,
        restartGame,
        joinMatchmaking,
        cancelMatchmaking,
        matchmakingStatus,
        daniaKaboom,
        clearError,
        forceReconnect,
        socket,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

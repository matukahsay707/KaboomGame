import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, GameState } from '@kaboom/shared';
import { RANK_ABILITIES } from '@kaboom/shared';
import type { RoomManager } from '../game/RoomManager.js';
import type { BotManager } from '../game/BotManager.js';
import {
  markPlayerPeeked,
  drawFromDeck,
  drawFromDiscardPile,
  swapCard,
  discardDrawnCard,
  startMatchWindow,
  endMatchWindow,
  advanceTurn,
  callKaboom,
  enterSpecialAction,
  executePeek,
  executeTrade,
  revealAndScore,
  filterGameStateForPlayer,
  hasSpecialAbility,
  removePlayerCard,
  addPenaltyCardToPlayer,
} from '../game/GameStateMachine.js';
import { resolveMatchAttempt } from '../game/MatchResolver.js';
import {
  validatePhase,
  validateActivePlayer,
  validateSlotIndex,
  validateSlotHasCard,
  validateHasDrawnCard,
  validateNoDrawnCard,
  validateCanCallKaboom,
  validateAll,
  validatePlayerExists,
} from '../game/ActionValidator.js';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function emitToPlayer(io: TypedServer, roomCode: string, playerId: string, event: string, payload: unknown): void {
  const sockets = io.sockets.adapter.rooms.get(roomCode);
  if (!sockets) return;
  for (const socketId of sockets) {
    const s = io.sockets.sockets.get(socketId);
    if (s?.data.uid === playerId) {
      (s as TypedSocket).emit(event as keyof ServerToClientEvents, payload as never);
    }
  }
}

function broadcastGameState(io: TypedServer, roomCode: string, gameState: GameState): void {
  const sockets = io.sockets.adapter.rooms.get(roomCode);
  if (!sockets) return;
  for (const socketId of sockets) {
    const s = io.sockets.sockets.get(socketId);
    if (s) {
      const filtered = filterGameStateForPlayer(gameState, s.data.uid);
      (s as TypedSocket).emit('game:stateUpdate', { gameState: filtered });
    }
  }
}

function startMatchWindowTimer(
  io: TypedServer,
  roomManager: RoomManager,
  roomCode: string,
  botManager: BotManager
): void {
  const timer = setTimeout(() => {
    const gameState = roomManager.getGameState(roomCode);
    if (!gameState || gameState.phase !== 'MATCH_WINDOW') return;

    let newState = endMatchWindow(gameState);
    newState = advanceTurn(newState);
    roomManager.updateGameState(roomCode, newState);

    io.to(roomCode).emit('game:matchWindowClosed');

    if (newState.phase === 'REVEAL') {
      handleReveal(io, roomManager, roomCode, newState);
      return;
    }

    if (newState.activePlayerId) {
      io.to(roomCode).emit('game:turnStart', { activePlayerId: newState.activePlayerId });
    }
    broadcastGameState(io, roomCode, newState);

    // If next player is a bot, schedule their turn
    if (newState.activePlayerId && botManager.isBot(roomCode, newState.activePlayerId)) {
      botManager.scheduleBotTurn(io, roomManager, roomCode, newState.activePlayerId);
    }
  }, Number(process.env.MATCH_WINDOW_TIMER_MS) || 5000);

  roomManager.setMatchWindowTimer(roomCode, timer);
}

/** After a human action that creates a match window, also schedule bot match attempts */
function triggerBotMatchesIfNeeded(
  io: TypedServer,
  roomManager: RoomManager,
  roomCode: string,
  botManager: BotManager,
  discardedCard: import('@kaboom/shared').Card,
  discarderId: string
): void {
  if (!botManager.hasBots(roomCode)) return;
  // Use the bot manager's internal match scheduling
  // We need to call into the bot manager to schedule match attempts
  // The bot manager handles this through scheduleBotMatches (which is private)
  // Instead, we re-dispatch via a public method
  botManager.handleBotMatchWindow(io, roomManager, roomCode, discardedCard, discarderId);
}

export function registerGameHandlers(
  io: TypedServer,
  socket: TypedSocket,
  roomManager: RoomManager,
  botManager: BotManager
): void {
  const getContext = () => {
    const uid = socket.data.uid;
    const roomCode = roomManager.getRoomCode(uid);
    if (!roomCode) return null;
    const gameState = roomManager.getGameState(roomCode);
    if (!gameState) return null;
    return { uid, roomCode, gameState };
  };

  socket.on('game:peekDone', () => {
    const ctx = getContext();
    if (!ctx) return;

    const check = validatePhase(ctx.gameState, 'PEEK_PHASE');
    if (!check.valid) { socket.emit('game:error', { message: check.error }); return; }

    const newState = markPlayerPeeked(ctx.gameState, ctx.uid);
    roomManager.updateGameState(ctx.roomCode, newState);

    if (newState.phase === 'PLAYER_TURN') {
      io.to(ctx.roomCode).emit('game:allPeeked');
      io.to(ctx.roomCode).emit('game:turnStart', { activePlayerId: newState.activePlayerId! });
      broadcastGameState(io, ctx.roomCode, newState);

      // If first turn is a bot, schedule it
      if (newState.activePlayerId && botManager.isBot(ctx.roomCode, newState.activePlayerId)) {
        botManager.scheduleBotTurn(io, roomManager, ctx.roomCode, newState.activePlayerId);
      }
    }
  });

  socket.on('game:drawDeck', () => {
    const ctx = getContext();
    if (!ctx) return;

    const check = validateAll(
      validatePhase(ctx.gameState, 'PLAYER_TURN', 'KABOOM_FINAL'),
      validateActivePlayer(ctx.gameState, ctx.uid),
      validateNoDrawnCard(ctx.gameState)
    );
    if (!check.valid) { socket.emit('game:error', { message: check.error }); return; }

    const newState = drawFromDeck(ctx.gameState);
    roomManager.updateGameState(ctx.roomCode, newState);

    // Only the drawer sees the card
    socket.emit('game:cardDrawn', { source: 'deck', card: newState.drawnCard });

    // Others know a card was drawn
    socket.to(ctx.roomCode).emit('game:cardDrawn', { source: 'deck', card: null });
    broadcastGameState(io, ctx.roomCode, newState);
  });

  socket.on('game:drawDiscard', () => {
    const ctx = getContext();
    if (!ctx) return;

    const check = validateAll(
      validatePhase(ctx.gameState, 'PLAYER_TURN', 'KABOOM_FINAL'),
      validateActivePlayer(ctx.gameState, ctx.uid),
      validateNoDrawnCard(ctx.gameState)
    );
    if (!check.valid) { socket.emit('game:error', { message: check.error }); return; }

    const result = drawFromDiscardPile(ctx.gameState);
    if (!result) { socket.emit('game:error', { message: 'Discard pile is empty' }); return; }

    roomManager.updateGameState(ctx.roomCode, result.state);

    // Everyone sees what was taken from discard
    io.to(ctx.roomCode).emit('game:cardDrawn', { source: 'discard', card: result.card });
    broadcastGameState(io, ctx.roomCode, result.state);
  });

  socket.on('game:swap', ({ slotIndex }) => {
    const ctx = getContext();
    if (!ctx) return;

    const check = validateAll(
      validatePhase(ctx.gameState, 'PLAYER_TURN', 'KABOOM_FINAL'),
      validateActivePlayer(ctx.gameState, ctx.uid),
      validateHasDrawnCard(ctx.gameState),
      validateSlotIndex(slotIndex),
      validateSlotHasCard(ctx.gameState, ctx.uid, slotIndex)
    );
    if (!check.valid) { socket.emit('game:error', { message: check.error }); return; }

    const { state: newState, discardedCard } = swapCard(ctx.gameState, ctx.uid, slotIndex);

    // Swapped-out card goes straight to discard — no special ability activation
    // Special abilities only trigger when the DRAWN card is discarded (game:discard)
    const matchState = startMatchWindow(newState, discardedCard);
    roomManager.updateGameState(ctx.roomCode, matchState);

    io.to(ctx.roomCode).emit('game:cardSwapped', {
      playerId: ctx.uid,
      slotIndex,
      discardedCard,
    });
    io.to(ctx.roomCode).emit('game:matchWindow', {
      discardedCard: matchState.matchWindow!.discardedCard,
      duration: matchState.matchWindow!.duration,
      startTime: matchState.matchWindow!.startTime,
    });

    startMatchWindowTimer(io, roomManager, ctx.roomCode, botManager);
    triggerBotMatchesIfNeeded(io, roomManager, ctx.roomCode, botManager, discardedCard, ctx.uid);
    broadcastGameState(io, ctx.roomCode, matchState);
  });

  socket.on('game:discard', () => {
    const ctx = getContext();
    if (!ctx) return;

    const check = validateAll(
      validatePhase(ctx.gameState, 'PLAYER_TURN', 'KABOOM_FINAL'),
      validateActivePlayer(ctx.gameState, ctx.uid),
      validateHasDrawnCard(ctx.gameState)
    );
    if (!check.valid) { socket.emit('game:error', { message: check.error }); return; }

    const { state: newState, discardedCard } = discardDrawnCard(ctx.gameState);

    // Plain discard — never triggers special ability (player chose not to use it)
    const matchState = startMatchWindow(newState, discardedCard);
    roomManager.updateGameState(ctx.roomCode, matchState);

    io.to(ctx.roomCode).emit('game:cardDiscarded', { discardedCard });
    io.to(ctx.roomCode).emit('game:matchWindow', {
      discardedCard: matchState.matchWindow!.discardedCard,
      duration: matchState.matchWindow!.duration,
      startTime: matchState.matchWindow!.startTime,
    });

    startMatchWindowTimer(io, roomManager, ctx.roomCode, botManager);
    triggerBotMatchesIfNeeded(io, roomManager, ctx.roomCode, botManager, discardedCard, ctx.uid);
    broadcastGameState(io, ctx.roomCode, matchState);
  });

  // Discard drawn card AND use its special ability (player's choice)
  socket.on('game:discardUseSpecial', () => {
    const ctx = getContext();
    if (!ctx) return;

    const check = validateAll(
      validatePhase(ctx.gameState, 'PLAYER_TURN', 'KABOOM_FINAL'),
      validateActivePlayer(ctx.gameState, ctx.uid),
      validateHasDrawnCard(ctx.gameState)
    );
    if (!check.valid) { socket.emit('game:error', { message: check.error }); return; }

    const { state: newState, discardedCard } = discardDrawnCard(ctx.gameState);

    if (!hasSpecialAbility(discardedCard)) {
      // Not a special card — just do a normal discard
      const matchState = startMatchWindow(newState, discardedCard);
      roomManager.updateGameState(ctx.roomCode, matchState);
      io.to(ctx.roomCode).emit('game:cardDiscarded', { discardedCard });
      io.to(ctx.roomCode).emit('game:matchWindow', {
        discardedCard: matchState.matchWindow!.discardedCard,
        duration: matchState.matchWindow!.duration,
        startTime: matchState.matchWindow!.startTime,
      });
      startMatchWindowTimer(io, roomManager, ctx.roomCode, botManager);
      triggerBotMatchesIfNeeded(io, roomManager, ctx.roomCode, botManager, discardedCard, ctx.uid);
      broadcastGameState(io, ctx.roomCode, matchState);
      return;
    }

    const ability = RANK_ABILITIES[discardedCard.rank];
    if (ability) {
      const specialState = enterSpecialAction(newState);
      roomManager.updateGameState(ctx.roomCode, specialState);
      io.to(ctx.roomCode).emit('game:cardDiscarded', { discardedCard });
      socket.emit('game:specialPrompt', { cardRank: discardedCard.rank, ability });
      broadcastGameState(io, ctx.roomCode, specialState);
    }
  });

  socket.on('game:useSpecial', ({ ability, targetPlayer, targetSlot }) => {
    const ctx = getContext();
    if (!ctx) return;

    const check = validateAll(
      validatePhase(ctx.gameState, 'SPECIAL_ACTION'),
      validateActivePlayer(ctx.gameState, ctx.uid)
    );
    if (!check.valid) { socket.emit('game:error', { message: check.error }); return; }

    if (ability === 'peek' && targetPlayer !== undefined && targetSlot !== undefined) {
      const slotCheck = validateSlotHasCard(ctx.gameState, targetPlayer, targetSlot);
      if (!slotCheck.valid) { socket.emit('game:error', { message: slotCheck.error }); return; }

      // Broadcast peek start to all — animation begins
      io.to(ctx.roomCode).emit('game:peekStart', {
        peekingPlayerId: ctx.uid,
        targetPlayerId: targetPlayer,
        targetSlotIndex: targetSlot,
      });

      const peekedCard = executePeek(ctx.gameState, targetPlayer, targetSlot);
      if (peekedCard) {
        // Only the peeking player sees the card value
        socket.emit('game:peekReveal', { card: peekedCard, slotIndex: targetSlot });
      }

      // Broadcast peek announcement to all
      io.to(ctx.roomCode).emit('game:actionAnnounce', {
        type: 'peek',
        playerId: ctx.uid,
        playerName: socket.data.displayName,
      });

      // After peek, go to match window with the discarded card
      const discardTop = ctx.gameState.discardPile[ctx.gameState.discardPile.length - 1];
      if (discardTop) {
        const matchState = startMatchWindow(ctx.gameState, discardTop);
        roomManager.updateGameState(ctx.roomCode, matchState);
        io.to(ctx.roomCode).emit('game:matchWindow', {
          discardedCard: discardTop,
          duration: matchState.matchWindow!.duration,
          startTime: matchState.matchWindow!.startTime,
        });
        startMatchWindowTimer(io, roomManager, ctx.roomCode, botManager);
        triggerBotMatchesIfNeeded(io, roomManager, ctx.roomCode, botManager, discardTop, ctx.uid);
        broadcastGameState(io, ctx.roomCode, matchState);
      } else {
        let newState: GameState = { ...ctx.gameState, phase: 'PLAYER_TURN' };
        newState = advanceTurn(newState);
        roomManager.updateGameState(ctx.roomCode, newState);
        io.to(ctx.roomCode).emit('game:turnStart', { activePlayerId: newState.activePlayerId! });
        broadcastGameState(io, ctx.roomCode, newState);
        if (newState.activePlayerId && botManager.isBot(ctx.roomCode, newState.activePlayerId)) {
          botManager.scheduleBotTurn(io, roomManager, ctx.roomCode, newState.activePlayerId);
        }
      }
    } else if (ability === 'blindTrade' || ability === 'peekAndTrade') {
      socket.emit('game:error', { message: 'Use game:tradeSelect for trades' });
    }
  });

  socket.on('game:peekResult', ({ slotIndex }) => {
    const ctx = getContext();
    if (!ctx) return;

    const check = validatePhase(ctx.gameState, 'SPECIAL_ACTION');
    if (!check.valid) { socket.emit('game:error', { message: check.error }); return; }

    const peekedCard = executePeek(ctx.gameState, ctx.uid, slotIndex);
    if (peekedCard) {
      socket.emit('game:peekReveal', { card: peekedCard, slotIndex });
    }
  });

  socket.on('game:tradeSelect', ({ mySlot, targetPlayer, targetSlot }) => {
    const ctx = getContext();
    if (!ctx) return;

    const check = validateAll(
      validatePhase(ctx.gameState, 'SPECIAL_ACTION'),
      validateActivePlayer(ctx.gameState, ctx.uid),
      validateSlotHasCard(ctx.gameState, ctx.uid, mySlot),
      validatePlayerExists(ctx.gameState, targetPlayer),
      validateSlotHasCard(ctx.gameState, targetPlayer, targetSlot)
    );
    if (!check.valid) { socket.emit('game:error', { message: check.error }); return; }

    // Broadcast trade start to all — animation begins
    io.to(ctx.roomCode).emit('game:tradeStart', {
      tradingPlayerId: ctx.uid,
      tradingSlotIndex: mySlot,
      targetPlayerId: targetPlayer,
      targetSlotIndex: targetSlot,
    });

    const newState = executeTrade(ctx.gameState, ctx.uid, mySlot, targetPlayer, targetSlot);

    io.to(ctx.roomCode).emit('game:tradeComplete', {
      player1: ctx.uid,
      slot1: mySlot,
      player2: targetPlayer,
      slot2: targetSlot,
    });

    // Broadcast trade announcement
    const discardedForAbility = ctx.gameState.discardPile[ctx.gameState.discardPile.length - 1];
    const targetPlayerObj = ctx.gameState.players.find(p => p.id === targetPlayer);
    const tradeType = discardedForAbility?.rank === 'Q' ? 'queenPeekTrade' : 'blindTrade';
    io.to(ctx.roomCode).emit('game:actionAnnounce', {
      type: tradeType as 'blindTrade' | 'queenPeekTrade',
      playerId: ctx.uid,
      playerName: socket.data.displayName,
      targetPlayerName: targetPlayerObj?.displayName,
    });

    // After trade, go to match window
    const discardTop = newState.discardPile[newState.discardPile.length - 1];
    if (discardTop) {
      const matchState = startMatchWindow(newState, discardTop);
      roomManager.updateGameState(ctx.roomCode, matchState);
      io.to(ctx.roomCode).emit('game:matchWindow', {
        discardedCard: discardTop,
        duration: matchState.matchWindow!.duration,
        startTime: matchState.matchWindow!.startTime,
      });
      startMatchWindowTimer(io, roomManager, ctx.roomCode, botManager);
      triggerBotMatchesIfNeeded(io, roomManager, ctx.roomCode, botManager, discardTop, ctx.uid);
      broadcastGameState(io, ctx.roomCode, matchState);
    } else {
      let finalState: GameState = { ...newState, phase: 'PLAYER_TURN' };
      finalState = advanceTurn(finalState);
      roomManager.updateGameState(ctx.roomCode, finalState);
      io.to(ctx.roomCode).emit('game:turnStart', { activePlayerId: finalState.activePlayerId! });
      broadcastGameState(io, ctx.roomCode, finalState);
      if (finalState.activePlayerId && botManager.isBot(ctx.roomCode, finalState.activePlayerId)) {
        botManager.scheduleBotTurn(io, roomManager, ctx.roomCode, finalState.activePlayerId);
      }
    }
  });

  socket.on('game:skipSpecial', () => {
    const ctx = getContext();
    if (!ctx) return;

    const check = validateAll(
      validatePhase(ctx.gameState, 'SPECIAL_ACTION'),
      validateActivePlayer(ctx.gameState, ctx.uid)
    );
    if (!check.valid) { socket.emit('game:error', { message: check.error }); return; }

    // Skip ability — go to match window
    const discardTop = ctx.gameState.discardPile[ctx.gameState.discardPile.length - 1];
    if (discardTop) {
      const matchState = startMatchWindow(ctx.gameState, discardTop);
      roomManager.updateGameState(ctx.roomCode, matchState);
      io.to(ctx.roomCode).emit('game:matchWindow', {
        discardedCard: discardTop,
        duration: matchState.matchWindow!.duration,
        startTime: matchState.matchWindow!.startTime,
      });
      startMatchWindowTimer(io, roomManager, ctx.roomCode, botManager);
      triggerBotMatchesIfNeeded(io, roomManager, ctx.roomCode, botManager, discardTop, ctx.uid);
      broadcastGameState(io, ctx.roomCode, matchState);
    } else {
      let newState: GameState = { ...ctx.gameState, phase: 'PLAYER_TURN' };
      newState = advanceTurn(newState);
      roomManager.updateGameState(ctx.roomCode, newState);
      io.to(ctx.roomCode).emit('game:turnStart', { activePlayerId: newState.activePlayerId! });
      broadcastGameState(io, ctx.roomCode, newState);
      if (newState.activePlayerId && botManager.isBot(ctx.roomCode, newState.activePlayerId)) {
        botManager.scheduleBotTurn(io, roomManager, ctx.roomCode, newState.activePlayerId);
      }
    }
  });

  socket.on('game:matchAttempt', ({ slotIndex }) => {
    const ctx = getContext();
    if (!ctx) return;

    const check = validatePhase(ctx.gameState, 'MATCH_WINDOW');
    if (!check.valid) { socket.emit('game:error', { message: check.error }); return; }

    const result = resolveMatchAttempt(ctx.gameState, ctx.uid, slotIndex);

    if (result.success) {
      // Remove card from player's grid
      const newState = removePlayerCard(ctx.gameState, ctx.uid, slotIndex);
      roomManager.updateGameState(ctx.roomCode, newState);

      io.to(ctx.roomCode).emit('game:matchSuccess', {
        matcherId: ctx.uid,
        slotIndex,
      });
      broadcastGameState(io, ctx.roomCode, newState);
    } else {
      // Penalty: draw extra card
      const { state: penaltyState } = addPenaltyCardToPlayer(ctx.gameState, ctx.uid);
      roomManager.updateGameState(ctx.roomCode, penaltyState);

      io.to(ctx.roomCode).emit('game:matchFail', {
        playerId: ctx.uid,
        penaltyCard: true,
      });
      broadcastGameState(io, ctx.roomCode, penaltyState);
    }
  });

  socket.on('game:callKaboom', () => {
    const ctx = getContext();
    if (!ctx) return;

    const check = validateCanCallKaboom(ctx.gameState, ctx.uid);
    if (!check.valid) { socket.emit('game:error', { message: check.error }); return; }

    const newState = callKaboom(ctx.gameState, ctx.uid);
    roomManager.updateGameState(ctx.roomCode, newState);

    io.to(ctx.roomCode).emit('game:kaboomCalled', { playerId: ctx.uid });

    if (newState.activePlayerId) {
      io.to(ctx.roomCode).emit('game:turnStart', { activePlayerId: newState.activePlayerId });
    }
    broadcastGameState(io, ctx.roomCode, newState);

    // If no remaining players, go straight to reveal
    if (newState.finalRoundPlayersRemaining.length === 0) {
      handleReveal(io, roomManager, ctx.roomCode, newState);
    } else if (newState.activePlayerId && botManager.isBot(ctx.roomCode, newState.activePlayerId)) {
      botManager.scheduleBotTurn(io, roomManager, ctx.roomCode, newState.activePlayerId);
    }
  });
}

function handleReveal(
  io: TypedServer,
  roomManager: RoomManager,
  roomCode: string,
  gameState: GameState
): void {
  const revealState: GameState = { ...gameState, phase: 'REVEAL' };
  roomManager.updateGameState(roomCode, revealState);

  const scores = revealAndScore(revealState);
  const winnerIds = scores.filter((s) => s.isWinner).map((s) => s.playerId);

  console.log(`[REVEAL] Room ${roomCode}: ${scores.length} players scored`);
  for (const s of scores) {
    console.log(`  ${s.displayName}: ${s.score} pts, ${s.cards.filter(Boolean).length} cards, winner=${s.isWinner}, kaboom=${s.calledKaboom}`);
  }

  io.to(roomCode).emit('game:reveal', { players: scores });
  io.to(roomCode).emit('game:winner', { winnerIds, players: scores });

  const finalState: GameState = { ...revealState, phase: 'GAME_OVER' };
  roomManager.updateGameState(roomCode, finalState);

  const sockets = io.sockets.adapter.rooms.get(roomCode);
  if (sockets) {
    for (const socketId of sockets) {
      const s = io.sockets.sockets.get(socketId);
      if (s) {
        const filtered = filterGameStateForPlayer(finalState, s.data.uid);
        s.emit('game:stateUpdate', { gameState: filtered });
      }
    }
  }
}

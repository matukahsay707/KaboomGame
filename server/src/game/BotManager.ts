import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, GameState, Card } from '@kaboom/shared';
import { RANK_ABILITIES } from '@kaboom/shared';
import type { RoomManager } from './RoomManager.js';
import {
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
  markPlayerPeeked,
  getBottomTwoCards,
} from './GameStateMachine.js';
import { resolveMatchAttempt } from './MatchResolver.js';
import {
  type BotDifficulty,
  type BotMemory,
  createEmptyMemory,
  rememberCard,
  rememberDiscard,
  rememberSwap,
  rememberTrade,
  forgetSlot,
  applyMemoryDecay,
  rememberFailedMatch,
  recordPlayerTurn,
  decideDrawSource,
  decidePostDraw,
  decideSpecial,
  decideKaboom,
  decideMatch,
  decideTradeAfterPeek,
  pickBotNames,
} from './BotBrain.js';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

interface BotState {
  readonly id: string;
  readonly displayName: string;
  readonly difficulty: BotDifficulty;
  memory: BotMemory; // mutable — updated as game progresses
}

interface BotRoom {
  readonly roomCode: string;
  readonly bots: readonly BotState[];
  turnTimer: ReturnType<typeof setTimeout> | null;
  matchTimers: ReturnType<typeof setTimeout>[];
}

export class BotManager {
  private readonly botRooms = new Map<string, BotRoom>();

  /** Register bots for a room */
  registerBots(roomCode: string, bots: readonly { id: string; displayName: string; difficulty: BotDifficulty }[]): void {
    this.botRooms.set(roomCode, {
      roomCode,
      bots: bots.map((b) => ({
        id: b.id,
        displayName: b.displayName,
        difficulty: b.difficulty,
        memory: createEmptyMemory(),
      })),
      turnTimer: null,
      matchTimers: [],
    });
  }

  /** Check if a player ID is a bot in a given room */
  isBot(roomCode: string, playerId: string): boolean {
    const botRoom = this.botRooms.get(roomCode);
    if (!botRoom) return false;
    return botRoom.bots.some((b) => b.id === playerId);
  }

  /** Check if a room has bots */
  hasBots(roomCode: string): boolean {
    return this.botRooms.has(roomCode);
  }

  /** Get bot state */
  private getBot(roomCode: string, botId: string): BotState | null {
    const botRoom = this.botRooms.get(roomCode);
    if (!botRoom) return null;
    return botRoom.bots.find((b) => b.id === botId) ?? null;
  }

  /** Clean up when game ends */
  cleanup(roomCode: string): void {
    const botRoom = this.botRooms.get(roomCode);
    if (botRoom) {
      if (botRoom.turnTimer) clearTimeout(botRoom.turnTimer);
      for (const t of botRoom.matchTimers) clearTimeout(t);
      this.botRooms.delete(roomCode);
    }
  }

  /** Handle peek phase for all bots in a room */
  handleBotPeeks(
    io: TypedServer,
    roomManager: RoomManager,
    roomCode: string
  ): void {
    const botRoom = this.botRooms.get(roomCode);
    if (!botRoom) return;

    const gameState = roomManager.getGameState(roomCode);
    if (!gameState || gameState.phase !== 'PEEK_PHASE') return;

    // Each bot peeks with a stagger
    let delay = 2000;
    for (const bot of botRoom.bots) {
      setTimeout(() => {
        const currentState = roomManager.getGameState(roomCode);
        if (!currentState || currentState.phase !== 'PEEK_PHASE') return;

        // Bot remembers its bottom 2 cards
        const bottomCards = getBottomTwoCards(currentState, bot.id);
        const player = currentState.players.find((p) => p.id === bot.id);
        if (player) {
          for (let i = 2; i < 4; i++) {
            const card = player.cards[i];
            if (card) {
              bot.memory = rememberCard(bot.memory, bot.id, i, card);
            }
          }
        }

        // Mark as peeked
        const newState = markPlayerPeeked(currentState, bot.id);
        roomManager.updateGameState(roomCode, newState);

        if (newState.phase === 'PLAYER_TURN') {
          io.to(roomCode).emit('game:allPeeked');
          io.to(roomCode).emit('game:turnStart', { activePlayerId: newState.activePlayerId! });
          this.broadcastState(io, roomCode, newState);

          // If the first turn is a bot, schedule its action
          if (newState.activePlayerId && this.isBot(roomCode, newState.activePlayerId)) {
            this.scheduleBotTurn(io, roomManager, roomCode, newState.activePlayerId);
          }
        }
      }, delay);
      delay += 1000;
    }
  }

  /** Schedule a bot's turn with realistic delay */
  scheduleBotTurn(
    io: TypedServer,
    roomManager: RoomManager,
    roomCode: string,
    botId: string
  ): void {
    const botRoom = this.botRooms.get(roomCode);
    if (!botRoom) return;

    // Clear any existing timer
    if (botRoom.turnTimer) clearTimeout(botRoom.turnTimer);

    const bot = this.getBot(roomCode, botId);
    const delay = bot?.difficulty === 'dania'
      ? 1500 + Math.random() * 1500  // 1.5–3s — faster, more intimidating
      : 3000 + Math.random() * 3000; // 3–6s
    botRoom.turnTimer = setTimeout(() => {
      this.executeBotTurn(io, roomManager, roomCode, botId);
    }, delay);
  }

  /** Execute a bot's full turn */
  private executeBotTurn(
    io: TypedServer,
    roomManager: RoomManager,
    roomCode: string,
    botId: string
  ): void {
    const bot = this.getBot(roomCode, botId);
    if (!bot) return;

    let gameState = roomManager.getGameState(roomCode);
    if (!gameState || gameState.activePlayerId !== botId) return;
    if (gameState.phase !== 'PLAYER_TURN' && gameState.phase !== 'KABOOM_FINAL') return;

    // Apply memory decay for easy bots
    if (bot.difficulty === 'easy') {
      bot.memory = applyMemoryDecay(bot.memory, 0.15);
    }

    // Step 1: Should we call Kaboom? (only if no drawn card and no existing kaboom)
    if (!gameState.drawnCard && !gameState.kaboomCallerId && gameState.phase === 'PLAYER_TURN') {
      const kaboomDecision = decideKaboom(bot.difficulty, bot.memory, botId, gameState);
      if (kaboomDecision.shouldCall) {
        const newState = callKaboom(gameState, botId);
        roomManager.updateGameState(roomCode, newState);
        io.to(roomCode).emit('game:kaboomCalled', { playerId: botId });
        if (bot.difficulty === 'dania') {
          io.to(roomCode).emit('game:daniaKaboom', { playerId: botId });
        }

        if (newState.activePlayerId) {
          io.to(roomCode).emit('game:turnStart', { activePlayerId: newState.activePlayerId });
        }
        this.broadcastState(io, roomCode, newState);

        if (newState.finalRoundPlayersRemaining.length === 0) {
          this.handleReveal(io, roomManager, roomCode, newState);
        } else if (newState.activePlayerId && this.isBot(roomCode, newState.activePlayerId)) {
          this.scheduleBotTurn(io, roomManager, roomCode, newState.activePlayerId);
        }
        return;
      }
    }

    // Step 2: Draw
    const drawDecision = decideDrawSource(bot.difficulty, bot.memory, gameState, botId);

    if (drawDecision.source === 'discard') {
      const result = drawFromDiscardPile(gameState);
      if (result) {
        gameState = result.state;
        roomManager.updateGameState(roomCode, gameState);

        // Everyone sees what was taken from discard
        io.to(roomCode).emit('game:cardDrawn', { source: 'discard', card: result.card });
        this.broadcastState(io, roomCode, gameState);
      } else {
        // Discard empty, draw from deck instead
        gameState = drawFromDeck(gameState);
        roomManager.updateGameState(roomCode, gameState);
        // Only human players need to see the card; bots process internally
        this.emitCardDrawnToHumans(io, roomCode, 'deck');
        this.broadcastState(io, roomCode, gameState);
      }
    } else {
      gameState = drawFromDeck(gameState);
      roomManager.updateGameState(roomCode, gameState);
      this.emitCardDrawnToHumans(io, roomCode, 'deck');
      this.broadcastState(io, roomCode, gameState);
    }

    // Delay before post-draw action — bots "think"
    const thinkDelay = bot.difficulty === 'dania'
      ? 800 + Math.random() * 800   // 0.8–1.6s — decisive
      : 2000 + Math.random() * 2000; // 2–4s
    setTimeout(() => {
      this.executeBotPostDraw(io, roomManager, roomCode, botId);
    }, thinkDelay);
  }

  /** Execute post-draw decision (swap or discard) */
  private executeBotPostDraw(
    io: TypedServer,
    roomManager: RoomManager,
    roomCode: string,
    botId: string
  ): void {
    const bot = this.getBot(roomCode, botId);
    if (!bot) return;

    let gameState = roomManager.getGameState(roomCode);
    if (!gameState || !gameState.drawnCard) return;

    const player = gameState.players.find((p) => p.id === botId);
    if (!player) return;

    const drawnCard = gameState.drawnCard;
    const decision = decidePostDraw(bot.difficulty, bot.memory, botId, drawnCard, player);

    if (decision.action === 'swap' && decision.slotIndex !== undefined) {
      const slotIndex = decision.slotIndex;
      // Validate slot exists
      if (slotIndex >= 0 && slotIndex < player.cards.length && player.cards[slotIndex]) {
        const { state: newState, discardedCard } = swapCard(gameState, botId, slotIndex);

        // Bot remembers what it swapped in
        bot.memory = rememberSwap(bot.memory, botId, slotIndex, drawnCard);
        bot.memory = rememberDiscard(bot.memory, discardedCard);

        io.to(roomCode).emit('game:cardSwapped', {
          playerId: botId,
          slotIndex,
          discardedCard,
        });

        // Swapped-out card goes straight to discard — no special ability activation
        this.startMatchWindowWithBots(io, roomManager, roomCode, newState, discardedCard, botId);
        return;
      }
    }

    // Discard
    const { state: newState, discardedCard } = discardDrawnCard(gameState);
    bot.memory = rememberDiscard(bot.memory, discardedCard);

    io.to(roomCode).emit('game:cardDiscarded', { discardedCard });

    // Bot decides whether to use the special ability (it's a choice, not mandatory)
    if (hasSpecialAbility(discardedCard)) {
      const ability = RANK_ABILITIES[discardedCard.rank];
      if (ability) {
        const specialDecision = decideSpecial(bot.difficulty, bot.memory, botId, ability, gameState);
        if (specialDecision.use) {
          const specialState = enterSpecialAction(newState);
          roomManager.updateGameState(roomCode, specialState);
          this.broadcastState(io, roomCode, specialState);

          setTimeout(() => {
            this.executeBotSpecial(io, roomManager, roomCode, botId, ability, discardedCard);
          }, 2000 + Math.random() * 1000);
          return;
        }
        // Bot chose not to use the ability — just discard normally
      }
    }

    this.startMatchWindowWithBots(io, roomManager, roomCode, newState, discardedCard, botId);
  }

  /** Execute bot special ability */
  private executeBotSpecial(
    io: TypedServer,
    roomManager: RoomManager,
    roomCode: string,
    botId: string,
    ability: string,
    _discardedCard: Card
  ): void {
    const bot = this.getBot(roomCode, botId);
    if (!bot) return;

    let gameState = roomManager.getGameState(roomCode);
    if (!gameState || gameState.phase !== 'SPECIAL_ACTION') return;

    const specialDecision = decideSpecial(bot.difficulty, bot.memory, botId, ability, gameState);

    if (!specialDecision.use) {
      // Skip special — go to match window
      const discardTop = gameState.discardPile[gameState.discardPile.length - 1];
      if (discardTop) {
        this.startMatchWindowWithBots(io, roomManager, roomCode, gameState, discardTop, botId);
      } else {
        this.advanceAndBroadcast(io, roomManager, roomCode, gameState);
      }
      return;
    }

    if (ability === 'peek' && specialDecision.targetPlayer && specialDecision.targetSlot !== undefined) {
      const peekedCard = executePeek(gameState, specialDecision.targetPlayer, specialDecision.targetSlot);
      if (peekedCard) {
        bot.memory = rememberCard(bot.memory, specialDecision.targetPlayer, specialDecision.targetSlot, peekedCard);
      }

      io.to(roomCode).emit('game:actionAnnounce', {
        type: 'peek',
        playerId: botId,
        playerName: bot.displayName,
      });

      // After peek, go to match window
      const discardTop = gameState.discardPile[gameState.discardPile.length - 1];
      if (discardTop) {
        this.startMatchWindowWithBots(io, roomManager, roomCode, gameState, discardTop, botId);
      } else {
        this.advanceAndBroadcast(io, roomManager, roomCode, gameState);
      }
      return;
    }

    if (ability === 'blindTrade' && specialDecision.targetPlayer && specialDecision.targetSlot !== undefined && specialDecision.tradeMySlot !== undefined) {
      const newState = executeTrade(
        gameState, botId, specialDecision.tradeMySlot,
        specialDecision.targetPlayer, specialDecision.targetSlot
      );

      // Update bot memory for trade
      bot.memory = rememberTrade(
        bot.memory, botId, specialDecision.tradeMySlot,
        specialDecision.targetPlayer, specialDecision.targetSlot
      );

      const tradeTargetPlayer = gameState.players.find(p => p.id === specialDecision.targetPlayer);
      io.to(roomCode).emit('game:tradeComplete', {
        player1: botId,
        slot1: specialDecision.tradeMySlot,
        player2: specialDecision.targetPlayer,
        slot2: specialDecision.targetSlot,
      });
      io.to(roomCode).emit('game:actionAnnounce', {
        type: 'blindTrade',
        playerId: botId,
        playerName: bot.displayName,
        targetPlayerName: tradeTargetPlayer?.displayName,
      });

      const discardTop = newState.discardPile[newState.discardPile.length - 1];
      if (discardTop) {
        this.startMatchWindowWithBots(io, roomManager, roomCode, newState, discardTop, botId);
      } else {
        this.advanceAndBroadcast(io, roomManager, roomCode, newState);
      }
      return;
    }

    if (ability === 'peekAndTrade' && specialDecision.targetPlayer && specialDecision.targetSlot !== undefined) {
      // Peek first
      const peekedCard = executePeek(gameState, specialDecision.targetPlayer, specialDecision.targetSlot);
      if (peekedCard) {
        bot.memory = rememberCard(bot.memory, specialDecision.targetPlayer, specialDecision.targetSlot, peekedCard);

        const player = gameState.players.find((p) => p.id === botId);
        if (player) {
          // Decide whether to trade
          const tradeDecision = decideTradeAfterPeek(
            bot.difficulty, bot.memory, botId, peekedCard,
            specialDecision.targetPlayer, specialDecision.targetSlot, player
          );

          if (tradeDecision.shouldTrade && tradeDecision.mySlot !== undefined) {
            const newState = executeTrade(
              gameState, botId, tradeDecision.mySlot,
              specialDecision.targetPlayer, specialDecision.targetSlot
            );

            bot.memory = rememberTrade(
              bot.memory, botId, tradeDecision.mySlot,
              specialDecision.targetPlayer, specialDecision.targetSlot
            );

            const queenTarget = gameState.players.find(p => p.id === specialDecision.targetPlayer);
            io.to(roomCode).emit('game:tradeComplete', {
              player1: botId,
              slot1: tradeDecision.mySlot,
              player2: specialDecision.targetPlayer,
              slot2: specialDecision.targetSlot,
            });
            io.to(roomCode).emit('game:actionAnnounce', {
              type: 'queenPeekTrade',
              playerId: botId,
              playerName: bot.displayName,
              targetPlayerName: queenTarget?.displayName,
            });

            const discardTop = newState.discardPile[newState.discardPile.length - 1];
            if (discardTop) {
              this.startMatchWindowWithBots(io, roomManager, roomCode, newState, discardTop, botId);
            } else {
              let finalState: GameState = { ...newState, phase: 'PLAYER_TURN' };
              finalState = advanceTurn(finalState);
              roomManager.updateGameState(roomCode, finalState);
              io.to(roomCode).emit('game:turnStart', { activePlayerId: finalState.activePlayerId! });
              this.broadcastState(io, roomCode, finalState);
              this.maybeScheduleNextBotTurn(io, roomManager, roomCode, finalState);
            }
            return;
          }
        }
      }

      // No trade — announce peek only
      io.to(roomCode).emit('game:actionAnnounce', {
        type: 'queenPeek',
        playerId: botId,
        playerName: bot.displayName,
      });

      const discardTop = gameState.discardPile[gameState.discardPile.length - 1];
      if (discardTop) {
        this.startMatchWindowWithBots(io, roomManager, roomCode, gameState, discardTop, botId);
      } else {
        this.advanceAndBroadcast(io, roomManager, roomCode, gameState);
      }
      return;
    }

    // Fallback: skip special
    const discardTop = gameState.discardPile[gameState.discardPile.length - 1];
    if (discardTop) {
      this.startMatchWindowWithBots(io, roomManager, roomCode, gameState, discardTop, botId);
    } else {
      let newState: GameState = { ...gameState, phase: 'PLAYER_TURN' };
      newState = advanceTurn(newState);
      roomManager.updateGameState(roomCode, newState);
      io.to(roomCode).emit('game:turnStart', { activePlayerId: newState.activePlayerId! });
      this.broadcastState(io, roomCode, newState);
      this.maybeScheduleNextBotTurn(io, roomManager, roomCode, newState);
    }
  }

  /** Start match window and schedule bot match attempts */
  private startMatchWindowWithBots(
    io: TypedServer,
    roomManager: RoomManager,
    roomCode: string,
    gameState: GameState,
    discardedCard: Card,
    discarderId: string
  ): void {
    const matchState = startMatchWindow(gameState, discardedCard);
    roomManager.updateGameState(roomCode, matchState);

    io.to(roomCode).emit('game:matchWindow', {
      discardedCard: matchState.matchWindow!.discardedCard,
      duration: matchState.matchWindow!.duration,
      startTime: matchState.matchWindow!.startTime,
    });
    this.broadcastState(io, roomCode, matchState);

    // Schedule bot match attempts
    this.scheduleBotMatches(io, roomManager, roomCode, discardedCard, discarderId);

    // Set the match window timer (auto-advance after server timeout)
    const timer = setTimeout(() => {
      const current = roomManager.getGameState(roomCode);
      if (!current || current.phase !== 'MATCH_WINDOW') return;

      let newState = endMatchWindow(current);
      newState = advanceTurn(newState);
      roomManager.updateGameState(roomCode, newState);

      io.to(roomCode).emit('game:matchWindowClosed');
      if (newState.activePlayerId) {
        io.to(roomCode).emit('game:turnStart', { activePlayerId: newState.activePlayerId });
      }
      this.broadcastState(io, roomCode, newState);

      // Check for reveal
      if (newState.phase === 'REVEAL') {
        this.handleReveal(io, roomManager, roomCode, newState);
      } else {
        this.maybeScheduleNextBotTurn(io, roomManager, roomCode, newState);
      }
    }, Number(process.env.MATCH_WINDOW_TIMER_MS) || 5000);

    roomManager.setMatchWindowTimer(roomCode, timer);
  }

  /** Public method for gameHandlers to trigger bot match attempts during human-initiated match windows */
  handleBotMatchWindow(
    io: TypedServer,
    roomManager: RoomManager,
    roomCode: string,
    discardedCard: Card,
    discarderId: string
  ): void {
    if (!this.hasBots(roomCode)) return;
    this.scheduleBotMatches(io, roomManager, roomCode, discardedCard, discarderId);
  }

  /** Schedule bot match attempts during match window */
  private scheduleBotMatches(
    io: TypedServer,
    roomManager: RoomManager,
    roomCode: string,
    discardedCard: Card,
    discarderId: string
  ): void {
    const botRoom = this.botRooms.get(roomCode);
    if (!botRoom) return;

    const gameState = roomManager.getGameState(roomCode);
    if (!gameState) return;

    // Clear any existing match timers
    for (const t of botRoom.matchTimers) clearTimeout(t);
    botRoom.matchTimers = [];

    for (const bot of botRoom.bots) {
      // Discarder cannot match their own card
      if (bot.id === discarderId) continue;

      const player = gameState.players.find((p) => p.id === bot.id);
      if (!player) continue;

      const matchDecision = decideMatch(bot.difficulty, bot.memory, bot.id, discardedCard, player);

      if (matchDecision.shouldAttempt && matchDecision.slotIndex !== undefined) {
        const slotIndex = matchDecision.slotIndex;
        const timer = setTimeout(() => {
          const current = roomManager.getGameState(roomCode);
          if (!current || current.phase !== 'MATCH_WINDOW') return;

          const result = resolveMatchAttempt(current, bot.id, slotIndex);

          if (result.success) {
            const newState = removePlayerCard(current, bot.id, slotIndex);
            roomManager.updateGameState(roomCode, newState);
            bot.memory = forgetSlot(bot.memory, bot.id, slotIndex);

            io.to(roomCode).emit('game:matchSuccess', {
              matcherId: bot.id,
              slotIndex,
            });
            this.broadcastState(io, roomCode, newState);
          } else {
            const { state: penaltyState } = addPenaltyCardToPlayer(current, bot.id);
            roomManager.updateGameState(roomCode, penaltyState);

            io.to(roomCode).emit('game:matchFail', {
              playerId: bot.id,
              penaltyCard: true,
            });
            this.broadcastState(io, roomCode, penaltyState);

            // Dania Mode: all dania bots in the room learn from this failed match
            for (const otherBot of botRoom.bots) {
              if (otherBot.difficulty === 'dania') {
                otherBot.memory = rememberFailedMatch(otherBot.memory, bot.id, slotIndex, discardedCard.rank);
              }
            }
          }
        }, matchDecision.delayMs);

        botRoom.matchTimers.push(timer);
      }
    }
  }

  /** Advance turn and handle REVEAL transition */
  private advanceAndBroadcast(
    io: TypedServer,
    roomManager: RoomManager,
    roomCode: string,
    currentState: GameState
  ): void {
    let newState: GameState = { ...currentState, phase: 'PLAYER_TURN' };
    newState = advanceTurn(newState);
    roomManager.updateGameState(roomCode, newState);

    if (newState.phase === 'REVEAL') {
      this.handleReveal(io, roomManager, roomCode, newState);
      return;
    }

    if (newState.activePlayerId) {
      io.to(roomCode).emit('game:turnStart', { activePlayerId: newState.activePlayerId });
    }
    this.broadcastState(io, roomCode, newState);
    this.maybeScheduleNextBotTurn(io, roomManager, roomCode, newState);
  }

  /** If next active player is a bot, schedule their turn */
  private maybeScheduleNextBotTurn(
    io: TypedServer,
    roomManager: RoomManager,
    roomCode: string,
    gameState: GameState
  ): void {
    if (gameState.activePlayerId && this.isBot(roomCode, gameState.activePlayerId)) {
      this.scheduleBotTurn(io, roomManager, roomCode, gameState.activePlayerId);
    }
  }

  /** Handle reveal and scoring */
  private handleReveal(
    io: TypedServer,
    roomManager: RoomManager,
    roomCode: string,
    gameState: GameState
  ): void {
    const revealState: GameState = { ...gameState, phase: 'REVEAL' };
    roomManager.updateGameState(roomCode, revealState);

    const scores = revealAndScore(revealState);
    const winnerIds = scores.filter((s) => s.isWinner).map((s) => s.playerId);

    io.to(roomCode).emit('game:reveal', { players: scores });
    io.to(roomCode).emit('game:winner', { winnerIds, players: scores });

    const finalState: GameState = { ...revealState, phase: 'GAME_OVER' };
    roomManager.updateGameState(roomCode, finalState);
    this.broadcastState(io, roomCode, finalState);

    // Clean up bot state
    this.cleanup(roomCode);
  }

  /** Emit card drawn event to human players only (bots don't need socket events) */
  private emitCardDrawnToHumans(
    io: TypedServer,
    roomCode: string,
    source: 'deck' | 'discard'
  ): void {
    // Humans see that a card was drawn from deck (card hidden)
    io.to(roomCode).emit('game:cardDrawn', { source, card: null });
  }

  /** Broadcast filtered game state to all human players */
  private broadcastState(io: TypedServer, roomCode: string, gameState: GameState): void {
    const sockets = io.sockets.adapter.rooms.get(roomCode);
    if (!sockets) return;
    for (const socketId of sockets) {
      const s = io.sockets.sockets.get(socketId);
      if (s) {
        const filtered = filterGameStateForPlayer(gameState, s.data.uid);
        s.emit('game:stateUpdate', { gameState: filtered });
      }
    }
  }
}

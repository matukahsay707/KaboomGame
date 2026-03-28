import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@kaboom/shared';
import { v4 as uuidv4 } from 'uuid';
import type { RoomManager } from '../game/RoomManager.js';
import type { BotManager } from '../game/BotManager.js';
import type { BotDifficulty } from '../game/BotBrain.js';
import { pickBotNames } from '../game/BotBrain.js';
import { filterGameStateForPlayer, getBottomTwoCards } from '../game/GameStateMachine.js';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerBotHandlers(
  io: TypedServer,
  socket: TypedSocket,
  roomManager: RoomManager,
  botManager: BotManager
): void {
  socket.on('bot:start', (payload) => {
    console.log('[bot:start] received from', socket.data.uid, payload);
    const { uid, displayName } = socket.data;
    const validDifficulties = ['easy', 'medium', 'hard', 'dania'] as const;
    const difficulty: BotDifficulty = validDifficulties.includes(payload.difficulty as BotDifficulty)
      ? (payload.difficulty as BotDifficulty)
      : 'medium';
    const botCount = Math.min(Math.max(payload.botCount ?? 3, 1), 5); // 1–5 bots

    // Check if player is already in a room
    if (roomManager.getRoomForPlayer(uid)) {
      socket.emit('game:error', { message: 'You are already in a room' });
      return;
    }

    // Create room for the human player
    const room = roomManager.createRoom(uid, displayName, botCount + 1);
    socket.join(room.roomState.roomCode);

    // Generate bot players
    const botNames = pickBotNames(botCount);
    const bots: { id: string; displayName: string; difficulty: BotDifficulty }[] = [];

    for (let i = 0; i < botCount; i++) {
      const botId = `bot-${uuidv4().slice(0, 8)}`;
      const botName = difficulty === 'dania' ? 'Dania' : botNames[i];

      const joined = roomManager.joinRoom(room.roomState.roomCode, botId, botName);
      if (!joined) {
        socket.emit('game:error', { message: 'Failed to add bots to room' });
        return;
      }

      bots.push({ id: botId, displayName: botName, difficulty });
    }

    // Register bots with the bot manager
    botManager.registerBots(room.roomState.roomCode, bots);

    // Emit room created with all players
    const updatedRoom = roomManager.getRoom(room.roomState.roomCode);
    if (!updatedRoom) return;

    socket.emit('room:created', {
      roomCode: updatedRoom.roomState.roomCode,
      roomState: updatedRoom.roomState,
    });

    // Auto-start the game immediately
    const gameState = roomManager.startGame(room.roomState.roomCode);
    if (!gameState) {
      socket.emit('game:error', { message: 'Failed to start bot game' });
      return;
    }

    // Send game started to the human player
    const filtered = filterGameStateForPlayer(gameState, uid);
    socket.emit('game:started', { gameState: filtered });

    // Send peek cards to the human player
    const bottomCards = getBottomTwoCards(gameState, uid);
    socket.emit('game:peekCards', { bottomCards });

    // Handle bot peeks (they auto-peek and remember their cards)
    botManager.handleBotPeeks(io, roomManager, room.roomState.roomCode);
  });
}

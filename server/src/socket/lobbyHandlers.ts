import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@kaboom/shared';
import { GAME_CONFIG } from '@kaboom/shared';
import type { RoomManager } from '../game/RoomManager.js';
import { filterGameStateForPlayer, getBottomTwoCards } from '../game/GameStateMachine.js';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerLobbyHandlers(
  io: TypedServer,
  socket: TypedSocket,
  roomManager: RoomManager
): void {
  socket.on('room:create', ({ maxPlayers }) => {
    const { uid, displayName } = socket.data;

    // Check if player is already in a room
    if (roomManager.getRoomForPlayer(uid)) {
      socket.emit('game:error', { message: 'You are already in a room' });
      return;
    }

    const room = roomManager.createRoom(uid, displayName, maxPlayers);
    socket.join(room.roomState.roomCode);
    socket.emit('room:created', {
      roomCode: room.roomState.roomCode,
      roomState: room.roomState,
    });
  });

  socket.on('room:join', ({ roomCode }) => {
    const { uid, displayName } = socket.data;
    const normalizedCode = roomCode.toUpperCase().trim();

    if (roomManager.getRoomForPlayer(uid)) {
      socket.emit('game:error', { message: 'You are already in a room' });
      return;
    }

    const room = roomManager.joinRoom(normalizedCode, uid, displayName);
    if (!room) {
      socket.emit('game:error', { message: 'Unable to join room. It may be full, in progress, or not exist.' });
      return;
    }

    socket.join(normalizedCode);
    io.to(normalizedCode).emit('room:playerJoined', {
      player: { id: uid, displayName, ready: false },
      roomState: room.roomState,
    });
  });

  // Rejoin an existing room after disconnect/refresh
  socket.on('room:rejoin', () => {
    const { uid } = socket.data;
    const room = roomManager.getRoomForPlayer(uid);
    if (!room) {
      // No room to rejoin — not an error, just nothing to do
      return;
    }

    // Rejoin the socket.io room
    socket.join(room.roomState.roomCode);

    // Mark player as connected again
    if (room.gameState) {
      room.gameState = {
        ...room.gameState,
        players: room.gameState.players.map((p) =>
          p.id === uid ? { ...p, connected: true } : p
        ),
      };

      const filtered = filterGameStateForPlayer(room.gameState, uid);
      socket.emit('room:rejoined', {
        roomState: room.roomState,
        gameState: filtered,
      });
    } else {
      socket.emit('room:rejoined', {
        roomState: room.roomState,
        gameState: null,
      });
    }
  });

  socket.on('room:leave', () => {
    const { uid } = socket.data;
    const roomCode = roomManager.getRoomCode(uid);
    if (!roomCode) return;

    const result = roomManager.leaveRoom(uid);
    if (result) {
      socket.leave(roomCode);
      io.to(roomCode).emit('room:playerLeft', {
        playerId: uid,
        roomState: result.room.roomState,
      });
    }
  });

  socket.on('game:start', () => {
    const { uid } = socket.data;
    const roomCode = roomManager.getRoomCode(uid);
    if (!roomCode) return;

    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    if (room.roomState.hostId !== uid) {
      socket.emit('game:error', { message: 'Only the host can start the game' });
      return;
    }

    if (room.roomState.players.length < GAME_CONFIG.MIN_PLAYERS) {
      socket.emit('game:error', { message: `Need at least ${GAME_CONFIG.MIN_PLAYERS} players` });
      return;
    }

    const gameState = roomManager.startGame(roomCode);
    if (!gameState) return;

    // Send filtered game state to each player
    for (const player of room.roomState.players) {
      const filtered = filterGameStateForPlayer(gameState, player.id);
      const sockets = io.sockets.adapter.rooms.get(roomCode);
      if (sockets) {
        for (const socketId of sockets) {
          const s = io.sockets.sockets.get(socketId);
          if (s?.data.uid === player.id) {
            s.emit('game:started', { gameState: filtered });
            // Send peek cards
            const bottomCards = getBottomTwoCards(gameState, player.id);
            s.emit('game:peekCards', { bottomCards });
          }
        }
      }
    }
  });

  // Restart game — reset to lobby with same room and players
  socket.on('game:restart', () => {
    const { uid } = socket.data;
    const roomCode = roomManager.getRoomCode(uid);
    if (!roomCode) return;

    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    // End the current game — resets gameState, clears timers
    roomManager.endGame(roomCode);

    // Broadcast back-to-lobby to all clients
    io.to(roomCode).emit('game:backToLobby', { roomState: room.roomState });
  });
}

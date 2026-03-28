import type { Server, Socket } from 'socket.io';
import type { RoomState, RoomPlayer, GameState, ClientToServerEvents, ServerToClientEvents } from '@kaboom/shared';
import { GAME_CONFIG } from '@kaboom/shared';
import { createInitialGameState, filterGameStateForPlayer, getBottomTwoCards } from './GameStateMachine.js';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < GAME_CONFIG.ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

interface Room {
  roomState: RoomState;
  gameState: GameState | null;
  matchWindowTimer: ReturnType<typeof setTimeout> | null;
}

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly playerRooms = new Map<string, string>(); // playerId -> roomCode

  createRoom(playerId: string, displayName: string, maxPlayers: number): Room {
    let roomCode = generateRoomCode();
    while (this.rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const room: Room = {
      roomState: {
        roomCode,
        hostId: playerId,
        players: [{ id: playerId, displayName, ready: false }],
        maxPlayers: Math.min(Math.max(maxPlayers, GAME_CONFIG.MIN_PLAYERS), GAME_CONFIG.MAX_PLAYERS),
        gameInProgress: false,
      },
      gameState: null,
      matchWindowTimer: null,
    };

    this.rooms.set(roomCode, room);
    this.playerRooms.set(playerId, roomCode);
    return room;
  }

  joinRoom(roomCode: string, playerId: string, displayName: string): Room | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    if (room.roomState.gameInProgress) return null;
    if (room.roomState.players.length >= room.roomState.maxPlayers) return null;
    if (room.roomState.players.some((p) => p.id === playerId)) return null;

    room.roomState = {
      ...room.roomState,
      players: [...room.roomState.players, { id: playerId, displayName, ready: false }],
    };
    this.playerRooms.set(playerId, roomCode);
    return room;
  }

  leaveRoom(playerId: string): { room: Room; wasHost: boolean } | null {
    const roomCode = this.playerRooms.get(playerId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const wasHost = room.roomState.hostId === playerId;
    this.playerRooms.delete(playerId);

    const remainingPlayers = room.roomState.players.filter((p) => p.id !== playerId);

    if (remainingPlayers.length === 0) {
      if (room.matchWindowTimer) clearTimeout(room.matchWindowTimer);
      this.rooms.delete(roomCode);
      return { room, wasHost };
    }

    const newHostId = wasHost ? remainingPlayers[0].id : room.roomState.hostId;

    room.roomState = {
      ...room.roomState,
      players: remainingPlayers,
      hostId: newHostId,
    };

    return { room, wasHost };
  }

  getRoom(roomCode: string): Room | null {
    return this.rooms.get(roomCode) ?? null;
  }

  getRoomForPlayer(playerId: string): Room | null {
    const roomCode = this.playerRooms.get(playerId);
    if (!roomCode) return null;
    return this.rooms.get(roomCode) ?? null;
  }

  getRoomCode(playerId: string): string | null {
    return this.playerRooms.get(playerId) ?? null;
  }

  startGame(roomCode: string): GameState | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    if (room.roomState.players.length < GAME_CONFIG.MIN_PLAYERS) return null;

    const playerIds = new Map<string, string>();
    for (const p of room.roomState.players) {
      playerIds.set(p.id, p.displayName);
    }

    const gameState = createInitialGameState(playerIds);
    room.gameState = gameState;
    room.roomState = { ...room.roomState, gameInProgress: true };
    return gameState;
  }

  updateGameState(roomCode: string, gameState: GameState): void {
    const room = this.rooms.get(roomCode);
    if (room) {
      room.gameState = gameState;
    }
  }

  getGameState(roomCode: string): GameState | null {
    return this.rooms.get(roomCode)?.gameState ?? null;
  }

  setMatchWindowTimer(roomCode: string, timer: ReturnType<typeof setTimeout>): void {
    const room = this.rooms.get(roomCode);
    if (room) {
      if (room.matchWindowTimer) clearTimeout(room.matchWindowTimer);
      room.matchWindowTimer = timer;
    }
  }

  clearMatchWindowTimer(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (room?.matchWindowTimer) {
      clearTimeout(room.matchWindowTimer);
      room.matchWindowTimer = null;
    }
  }

  handleDisconnect(playerId: string, io: TypedServer): void {
    const room = this.getRoomForPlayer(playerId);
    if (!room) return;

    if (room.gameState) {
      // Mark player as disconnected in game
      room.gameState = {
        ...room.gameState,
        players: room.gameState.players.map((p) =>
          p.id === playerId ? { ...p, connected: false } : p
        ),
      };
    }

    // Don't remove from room during game — they might reconnect
    if (!room.roomState.gameInProgress) {
      const result = this.leaveRoom(playerId);
      if (result) {
        io.to(room.roomState.roomCode).emit('room:playerLeft', {
          playerId,
          roomState: result.room.roomState,
        });
      }
    }
  }

  endGame(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    room.gameState = null;
    room.roomState = { ...room.roomState, gameInProgress: false };
    if (room.matchWindowTimer) {
      clearTimeout(room.matchWindowTimer);
      room.matchWindowTimer = null;
    }
  }
}

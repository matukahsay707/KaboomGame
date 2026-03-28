import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@kaboom/shared';
import type { RoomManager } from './RoomManager.js';
import { filterGameStateForPlayer, getBottomTwoCards } from './GameStateMachine.js';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

interface QueuedPlayer {
  readonly uid: string;
  readonly displayName: string;
  readonly socketId: string;
  readonly joinedAt: number;
}

export class MatchmakingManager {
  // Separate queues per player count: 2, 3, 4
  private readonly queues = new Map<number, QueuedPlayer[]>();

  constructor() {
    this.queues.set(2, []);
    this.queues.set(3, []);
    this.queues.set(4, []);
  }

  /** Add a player to the matchmaking queue */
  join(
    io: TypedServer,
    roomManager: RoomManager,
    uid: string,
    displayName: string,
    socketId: string,
    playerCount: number
  ): void {
    const targetCount = Math.max(2, Math.min(4, playerCount));
    const queue = this.queues.get(targetCount);
    if (!queue) return;

    // Don't allow joining if already in a room
    if (roomManager.getRoomForPlayer(uid)) return;

    // Don't allow duplicate entries
    if (queue.some((p) => p.uid === uid)) return;

    // Remove from any other queue first
    this.removeFromAllQueues(uid);

    queue.push({ uid, displayName, socketId, joinedAt: Date.now() });

    console.log(`[Matchmaking] ${displayName} joined ${targetCount}-player queue (${queue.length}/${targetCount})`);

    // Check if queue is full
    if (queue.length >= targetCount) {
      this.createMatch(io, roomManager, targetCount);
    } else {
      // Notify the joining player
      const socket = io.sockets.sockets.get(socketId);
      socket?.emit('matchmaking:waiting', { currentCount: queue.length, targetCount });

      // Notify all in queue
      this.broadcastQueueUpdate(io, targetCount);
    }
  }

  /** Remove a player from matchmaking */
  cancel(io: TypedServer, uid: string): void {
    for (const [targetCount, queue] of this.queues) {
      const idx = queue.findIndex((p) => p.uid === uid);
      if (idx >= 0) {
        queue.splice(idx, 1);
        console.log(`[Matchmaking] Player left ${targetCount}-player queue (${queue.length}/${targetCount})`);

        // Notify the player
        const socket = io.sockets.sockets.get(queue[idx]?.socketId ?? '');
        // Notify remaining
        this.broadcastQueueUpdate(io, targetCount);
        break;
      }
    }
  }

  /** Handle player disconnect — remove from queue */
  handleDisconnect(io: TypedServer, uid: string): void {
    this.removeFromAllQueues(uid);
  }

  private removeFromAllQueues(uid: string): void {
    for (const [, queue] of this.queues) {
      const idx = queue.findIndex((p) => p.uid === uid);
      if (idx >= 0) queue.splice(idx, 1);
    }
  }

  /** Check if a player is in any queue */
  isInQueue(uid: string): boolean {
    for (const [, queue] of this.queues) {
      if (queue.some((p) => p.uid === uid)) return true;
    }
    return false;
  }

  private createMatch(
    io: TypedServer,
    roomManager: RoomManager,
    targetCount: number
  ): void {
    const queue = this.queues.get(targetCount);
    if (!queue || queue.length < targetCount) return;

    // Take the first N players from the queue
    const matched = queue.splice(0, targetCount);

    console.log(`[Matchmaking] Match found! ${matched.map((p) => p.displayName).join(', ')}`);

    // Create room with first player as host
    const host = matched[0];
    const room = roomManager.createRoom(host.uid, host.displayName, targetCount);
    const roomCode = room.roomState.roomCode;

    // Join all players to the room
    const hostSocket = io.sockets.sockets.get(host.socketId);
    hostSocket?.join(roomCode);

    for (let i = 1; i < matched.length; i++) {
      const player = matched[i];
      roomManager.joinRoom(roomCode, player.uid, player.displayName);
      const socket = io.sockets.sockets.get(player.socketId);
      socket?.join(roomCode);
    }

    // Get updated room state
    const updatedRoom = roomManager.getRoom(roomCode);
    if (!updatedRoom) return;

    // Emit match found to all players
    for (const player of matched) {
      const socket = io.sockets.sockets.get(player.socketId);
      socket?.emit('matchmaking:found', {
        roomCode,
        roomState: updatedRoom.roomState,
      });
    }

    // Auto-start the game immediately for random matchmaking
    const gameState = roomManager.startGame(roomCode);
    if (!gameState) return;

    // Send game started + peek cards to each player
    for (const player of matched) {
      const socket = io.sockets.sockets.get(player.socketId);
      if (socket) {
        const filtered = filterGameStateForPlayer(gameState, player.uid);
        socket.emit('game:started', { gameState: filtered });
        const bottomCards = getBottomTwoCards(gameState, player.uid);
        socket.emit('game:peekCards', { bottomCards });
      }
    }
  }

  private broadcastQueueUpdate(io: TypedServer, targetCount: number): void {
    const queue = this.queues.get(targetCount);
    if (!queue) return;

    for (const player of queue) {
      const socket = io.sockets.sockets.get(player.socketId);
      socket?.emit('matchmaking:update', { currentCount: queue.length, targetCount });
    }
  }
}

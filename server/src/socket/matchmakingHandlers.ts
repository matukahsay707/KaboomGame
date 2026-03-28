import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@kaboom/shared';
import type { RoomManager } from '../game/RoomManager.js';
import type { MatchmakingManager } from '../game/MatchmakingManager.js';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerMatchmakingHandlers(
  io: TypedServer,
  socket: TypedSocket,
  roomManager: RoomManager,
  matchmakingManager: MatchmakingManager
): void {
  socket.on('matchmaking:join', ({ playerCount }) => {
    const { uid, displayName } = socket.data;

    if (roomManager.getRoomForPlayer(uid)) {
      socket.emit('game:error', { message: 'You are already in a room' });
      return;
    }

    if (matchmakingManager.isInQueue(uid)) {
      socket.emit('game:error', { message: 'You are already in the matchmaking queue' });
      return;
    }

    matchmakingManager.join(io, roomManager, uid, displayName, socket.id, playerCount);
  });

  socket.on('matchmaking:cancel', () => {
    const { uid } = socket.data;
    matchmakingManager.cancel(io, uid);
    socket.emit('matchmaking:cancelled');
  });
}

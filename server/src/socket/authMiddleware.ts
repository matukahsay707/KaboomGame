import type { Socket } from 'socket.io';
import { firebaseAdmin } from '../config/firebase.js';

export async function authMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  const token = socket.handshake.auth.token as string | undefined;

  // Dev mode: accept uid/displayName directly
  if (!token && socket.handshake.auth.uid) {
    socket.data.uid = socket.handshake.auth.uid as string;
    socket.data.displayName = (socket.handshake.auth.displayName as string) ?? 'Player';
    return next();
  }

  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    if (firebaseAdmin.apps.length === 0) {
      // Dev mode fallback
      socket.data.uid = token;
      socket.data.displayName = (socket.handshake.auth.displayName as string) ?? 'Player';
      return next();
    }

    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    socket.data.uid = decoded.uid;
    socket.data.displayName = decoded.name ?? decoded.email ?? 'Player';
    next();
  } catch {
    next(new Error('Invalid authentication token'));
  }
}

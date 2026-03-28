import { firestore } from '../config/firebase.js';
import type { PlayerScore } from '@kaboom/shared';

export async function saveGameHistory(
  roomCode: string,
  players: readonly PlayerScore[],
  kaboomCallerId: string | null,
  durationSeconds: number
): Promise<string | null> {
  if (!firestore) return null;

  const doc = await firestore.collection('gameHistory').add({
    roomCode,
    players: players.map((p) => ({
      uid: p.playerId,
      displayName: p.displayName,
      score: p.score,
      isWinner: p.isWinner,
    })),
    kaboomCaller: kaboomCallerId,
    createdAt: new Date(),
    duration: durationSeconds,
  });

  // Update user stats
  for (const player of players) {
    const userRef = firestore.collection('users').doc(player.playerId);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      await userRef.update({
        gamesPlayed: (userDoc.data()?.gamesPlayed ?? 0) + 1,
        gamesWon: (userDoc.data()?.gamesWon ?? 0) + (player.isWinner ? 1 : 0),
      });
    }
  }

  return doc.id;
}

export async function createUserProfile(
  uid: string,
  displayName: string,
  email: string
): Promise<void> {
  if (!firestore) return;

  const userRef = firestore.collection('users').doc(uid);
  const existing = await userRef.get();
  if (!existing.exists) {
    await userRef.set({
      displayName,
      email,
      gamesPlayed: 0,
      gamesWon: 0,
      createdAt: new Date(),
    });
  }
}

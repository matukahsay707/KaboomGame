import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface LeaderboardEntry {
  readonly displayName: string;
  readonly gamesPlayed: number;
  readonly gamesWon: number;
  readonly winRate: number;
}

function getLocalLeaderboard(): readonly LeaderboardEntry[] {
  const raw = localStorage.getItem('kaboom_leaderboard');
  if (!raw) return [];
  try {
    const entries: LeaderboardEntry[] = JSON.parse(raw);
    return entries
      .map((e) => ({ ...e, winRate: e.gamesPlayed > 0 ? (e.gamesWon / e.gamesPlayed) * 100 : 0 }))
      .sort((a, b) => b.gamesWon - a.gamesWon || b.winRate - a.winRate);
  } catch {
    return [];
  }
}

export function updateLocalLeaderboard(displayName: string, won: boolean): void {
  const raw = localStorage.getItem('kaboom_leaderboard');
  const entries: LeaderboardEntry[] = raw ? JSON.parse(raw) : [];

  const existing = entries.find((e) => e.displayName === displayName);
  if (existing) {
    const updated = entries.map((e) =>
      e.displayName === displayName
        ? {
            ...e,
            gamesPlayed: e.gamesPlayed + 1,
            gamesWon: e.gamesWon + (won ? 1 : 0),
            winRate: 0,
          }
        : e
    );
    localStorage.setItem('kaboom_leaderboard', JSON.stringify(updated));
  } else {
    entries.push({
      displayName,
      gamesPlayed: 1,
      gamesWon: won ? 1 : 0,
      winRate: 0,
    });
    localStorage.setItem('kaboom_leaderboard', JSON.stringify(entries));
  }
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<readonly LeaderboardEntry[]>([]);

  useEffect(() => {
    setEntries(getLocalLeaderboard());
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-3 sm:px-4 py-6">
      <div className="max-w-lg w-full">
        <h1 className="text-3xl sm:text-4xl font-black text-center mb-6">
          <span className="text-kaboom-gold">Leaderboard</span>
        </h1>

        {entries.length === 0 ? (
          <div className="bg-kaboom-mid rounded-2xl p-8 text-center">
            <p className="text-gray-400">No games played yet!</p>
            <p className="text-gray-500 text-sm mt-2">Play a game to see stats here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-4 gap-2 px-4 text-xs text-gray-500 font-medium">
              <span>Rank</span>
              <span>Player</span>
              <span className="text-center">W/L</span>
              <span className="text-right">Win %</span>
            </div>

            {entries.map((entry, idx) => (
              <div
                key={entry.displayName}
                className={`bg-kaboom-mid rounded-lg p-3 sm:p-4 grid grid-cols-4 gap-2 items-center animate-score-reveal ${
                  idx === 0 ? 'ring-1 ring-kaboom-gold' : ''
                }`}
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                <span className={`font-black text-lg ${
                  idx === 0 ? 'text-kaboom-gold' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-amber-600' : 'text-gray-500'
                }`}>
                  #{idx + 1}
                </span>
                <span className="font-medium text-sm truncate">{entry.displayName}</span>
                <span className="text-center text-sm">
                  <span className="text-green-400">{entry.gamesWon}</span>
                  <span className="text-gray-600"> / </span>
                  <span className="text-gray-400">{entry.gamesPlayed}</span>
                </span>
                <span className={`text-right font-bold text-sm ${
                  entry.winRate >= 50 ? 'text-green-400' : 'text-gray-400'
                }`}>
                  {entry.winRate.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => navigate('/lobby')}
          className="btn-secondary w-full mt-6"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  );
}

import { useState } from 'react';

interface PlayOnlinePanelProps {
  readonly onFindGame: (playerCount: number) => void;
  readonly onBack: () => void;
}

export default function PlayOnlinePanel({ onFindGame, onBack }: PlayOnlinePanelProps) {
  const [playerCount, setPlayerCount] = useState(4);

  return (
    <div className="animate-fade-in w-full max-w-lg mx-auto px-4">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 group"
      >
        <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h2 className="text-3xl font-black text-kaboom-gold mb-2">Play Online</h2>
      <p className="text-gray-400 text-sm mb-6">Get matched with real players instantly</p>

      <div className="mb-6">
        <label className="block text-sm text-gray-400 mb-2 font-medium">How many players?</label>
        <div className="flex gap-2">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setPlayerCount(n)}
              className={`flex-1 py-3 rounded-xl font-bold text-lg transition-all duration-150 ${
                playerCount === n
                  ? 'bg-kaboom-gold text-black shadow-lg shadow-kaboom-gold/30'
                  : 'bg-kaboom-mid/60 text-gray-400 hover:text-white hover:bg-kaboom-mid'
              }`}
            >
              {n}
              <span className="block text-[10px] font-normal opacity-70">
                {n === 2 ? '1v1' : `${n} players`}
              </span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onFindGame(playerCount)}
        className="w-full py-4 bg-kaboom-gold hover:bg-yellow-400 text-black font-bold text-lg rounded-xl transition-all duration-200 active:scale-[0.98] shadow-lg"
      >
        Find Game
      </button>
    </div>
  );
}

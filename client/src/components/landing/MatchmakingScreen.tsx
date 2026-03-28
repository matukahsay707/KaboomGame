import { useState, useEffect } from 'react';
import { B2 } from '@letele/playing-cards';

interface MatchmakingScreenProps {
  readonly currentCount: number;
  readonly targetCount: number;
  readonly onCancel: () => void;
  readonly onFillWithBots: () => void;
}

export default function MatchmakingScreen({ currentCount, targetCount, onCancel, onFillWithBots }: MatchmakingScreenProps) {
  const [dots, setDots] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [showBotPrompt, setShowBotPrompt] = useState(false);

  // Dot animation
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((e) => {
        if (e >= 60) {
          setShowBotPrompt(true);
          clearInterval(interval);
        }
        return e + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at 50% 50%, #1a3a2a 0%, #0d1117 70%)' }}>
      {/* Shuffling card animation */}
      <div className="flex flex-col items-center">
        <div className="flex gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-12 h-[67px] rounded-lg overflow-hidden shadow-lg"
              style={{
                animation: `cardShuffle 1.5s ease-in-out ${i * 0.2}s infinite`,
              }}
            >
              <B2 className="w-full h-full" />
            </div>
          ))}
        </div>

        {!showBotPrompt ? (
          <>
            <h2 className="text-xl font-bold text-white mb-2">
              Finding players{dots}
            </h2>
            <p className="text-kaboom-gold text-lg font-black mb-1">
              {currentCount} of {targetCount} players found
            </p>
            <p className="text-gray-500 text-xs mb-6">
              Searching for {elapsed}s
            </p>

            {/* Player count dots */}
            <div className="flex gap-2 mb-8">
              {Array.from({ length: targetCount }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    i < currentCount ? 'bg-kaboom-gold scale-110' : 'bg-gray-700 animate-pulse'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={onCancel}
              className="px-6 py-2.5 bg-transparent border border-gray-600 hover:border-gray-400 text-gray-300 hover:text-white font-medium rounded-xl transition-all"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-white mb-2">
              Not enough players found
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              Fill remaining spots with bots?
            </p>
            <div className="flex gap-3">
              <button
                onClick={onFillWithBots}
                className="px-6 py-2.5 bg-kaboom-gold hover:bg-yellow-400 text-black font-bold rounded-xl transition-all"
              >
                Yes, add bots
              </button>
              <button
                onClick={onCancel}
                className="px-6 py-2.5 bg-transparent border border-gray-600 hover:border-gray-400 text-gray-300 font-medium rounded-xl transition-all"
              >
                No, cancel
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes cardShuffle {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-12px) rotate(-8deg); }
          50% { transform: translateY(-4px) rotate(4deg); }
          75% { transform: translateY(-8px) rotate(-4deg); }
        }
      `}</style>
    </div>
  );
}

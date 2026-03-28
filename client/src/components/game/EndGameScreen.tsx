import { useState, useEffect } from 'react';
import type { PlayerScore } from '@kaboom/shared';
import AvatarIcon from './AvatarIcon.tsx';
import { useSound } from '../../hooks/useSound.tsx';

interface EndGameScreenProps {
  readonly scores: readonly PlayerScore[];
  readonly winnerIds: readonly string[];
  readonly currentUserId: string;
  readonly onPlayAgain: () => void;
}

// Crown SVG for 1st place
function CrownIcon() {
  return (
    <svg viewBox="0 0 32 24" className="w-8 h-6" style={{ animation: 'crownDrop 400ms ease-out 1.6s both' }}>
      <path d="M2,20 L2,8 L8,14 L16,4 L24,14 L30,8 L30,20Z" fill="#f5c518" />
      <circle cx="2" cy="8" r="2" fill="#f5c518" />
      <circle cx="16" cy="4" r="2" fill="#f5c518" />
      <circle cx="30" cy="8" r="2" fill="#f5c518" />
    </svg>
  );
}

export default function EndGameScreen({ scores, winnerIds, currentUserId, onPlayAgain }: EndGameScreenProps) {
  const { play } = useSound();
  const [visible, setVisible] = useState(false);
  const sorted = [...scores].sort((a, b) => a.score - b.score);
  const top3 = sorted.slice(0, 3);
  const rest = sorted.slice(3);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    // Play win sound when 1st place podium lands
    const timer = setTimeout(() => play('win'), 1600);
    return () => clearTimeout(timer);
  }, [play]);

  const podiumHeights = [140, 100, 70]; // 1st, 2nd, 3rd
  const podiumOrder = [1, 0, 2]; // display order: 2nd, 1st, 3rd

  return (
    <div
      className={`fixed inset-0 z-50 transition-transform duration-500 ${visible ? 'translate-y-0' : 'translate-y-full'}`}
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #1a3a2a 0%, #0d1117 70%)' }}
    >
      {/* Gold particles floating up */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-kaboom-gold/40"
            style={{
              left: `${10 + Math.random() * 80}%`,
              bottom: '-10px',
              animation: `particleFloat ${6 + Math.random() * 4}s linear ${i * 0.5}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="h-full flex flex-col items-center justify-center px-4">
        <h1 className="text-3xl sm:text-4xl font-black text-kaboom-gold mb-8 animate-fade-in">
          Game Over
        </h1>

        {/* Podium */}
        <div className="flex items-end justify-center gap-2 sm:gap-4 mb-8">
          {podiumOrder.map((rank, displayIdx) => {
            const player = top3[rank];
            if (!player) return null;
            const height = podiumHeights[rank];
            const isWinner = rank === 0;
            const delay = rank === 2 ? 0 : rank === 1 ? 0.4 : 0.8; // 3rd, 2nd, 1st

            return (
              <div key={rank} className="flex flex-col items-center">
                {/* Crown for 1st */}
                {isWinner && <CrownIcon />}

                {/* Avatar drops in */}
                <div style={{ animation: `avatarDrop 400ms ease-out ${delay + 0.4}s both` }}>
                  <AvatarIcon
                    shape="circle"
                    color={isWinner ? '#f5c518' : rank === 1 ? '#c0c0c0' : '#cd7f32'}
                    size={isWinner ? 48 : 40}
                  />
                </div>
                <span className="text-xs text-gray-300 font-medium mt-1 truncate max-w-[80px]">
                  {player.displayName}
                </span>
                <span className={`text-lg font-black ${isWinner ? 'text-kaboom-gold' : 'text-white'}`}>
                  {player.score}
                </span>

                {/* Platform */}
                <div
                  className={`w-20 sm:w-24 rounded-t-lg ${
                    isWinner ? 'bg-kaboom-gold/20 border-t-2 border-x-2 border-kaboom-gold/40' :
                    'bg-gray-700/30 border-t-2 border-x-2 border-gray-600/30'
                  }`}
                  style={{
                    height: 0,
                    animation: `platformRise 400ms ease-out ${delay}s both`,
                    ['--target-height' as string]: `${height}px`,
                  }}
                />

                {/* Stats */}
                <div className="text-[10px] text-gray-500 mt-1 text-center">
                  {player.calledKaboom && <span className="text-kaboom-accent">Called Kaboom</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rest of players */}
        {rest.length > 0 && (
          <div className="w-full max-w-sm space-y-2 mb-6">
            {rest.map((player, idx) => (
              <div key={player.playerId} className="flex items-center gap-3 bg-kaboom-mid/50 rounded-lg px-3 py-2 animate-score-reveal" style={{ animationDelay: `${1.5 + idx * 0.15}s` }}>
                <span className="text-gray-500 font-bold text-sm">#{idx + 4}</span>
                <span className="text-sm text-gray-300 flex-1">{player.displayName}</span>
                <span className="text-sm font-bold text-gray-400">{player.score}</span>
              </div>
            ))}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 animate-slide-up" style={{ animationDelay: '2s' }}>
          <button onClick={onPlayAgain} className="btn-primary px-8 py-3">
            Play Again
          </button>
        </div>
      </div>

      <style>{`
        @keyframes platformRise {
          0% { height: 0; }
          100% { height: var(--target-height); }
        }
        @keyframes avatarDrop {
          0% { transform: translateY(-40px); opacity: 0; }
          60% { transform: translateY(4px); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes crownDrop {
          0% { transform: translateY(-20px); opacity: 0; }
          60% { transform: translateY(2px); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes particleFloat {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 0.4; }
          90% { opacity: 0.4; }
          100% { transform: translateY(-100vh); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

import { useState, useEffect } from 'react';
import type { PlayerScore, Card as CardType } from '@kaboom/shared';
import { CARD_VALUES } from '@kaboom/shared';
import Card from './Card.tsx';
import AvatarIcon from './AvatarIcon.tsx';
import { loadAvatarChoice } from './AvatarPicker.tsx';
import { useSound } from '../../hooks/useSound.tsx';
import { useMusic } from '../../contexts/MusicContext.tsx';

interface ScoreBoardProps {
  readonly scores: readonly PlayerScore[];
  readonly winnerIds: readonly string[];
  readonly currentUserId: string;
  readonly onBackToLobby: () => void;
  readonly onPlayAgain?: () => void;
}

function getCardValue(card: CardType): number {
  if (card.rank === 'K' && card.suit) return CARD_VALUES[`K-${card.suit}`] ?? 0;
  return CARD_VALUES[card.rank] ?? 0;
}

function scoreColor(score: number): string {
  if (score <= 0) return 'text-blue-400';
  if (score <= 10) return 'text-green-400';
  if (score <= 20) return 'text-yellow-400';
  return 'text-red-400';
}

function cardValueColor(card: CardType): string {
  const v = getCardValue(card);
  if (v < 0) return 'text-blue-400';
  if (v === 0) return 'text-gray-500';
  if (v >= 25) return 'text-red-500';
  if (v >= 10) return 'text-yellow-400';
  return 'text-green-400';
}

// Crown SVG
function CrownIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 24" width={size} height={size * 0.75} className="drop-shadow-lg">
      <path d="M2,20 L2,8 L8,14 L16,4 L24,14 L30,8 L30,20Z" fill="#f5c518" />
      <circle cx="2" cy="8" r="2" fill="#f5c518" /><circle cx="16" cy="4" r="2" fill="#f5c518" /><circle cx="30" cy="8" r="2" fill="#f5c518" />
    </svg>
  );
}

export default function ScoreBoard({ scores, winnerIds, currentUserId, onBackToLobby, onPlayAgain }: ScoreBoardProps) {
  const { play } = useSound();
  const music = useMusic();
  const avatar = loadAvatarChoice();

  const ranked = [...scores].sort((a, b) => a.score - b.score);
  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const caller = scores.find((s) => s.calledKaboom);
  const callerWon = caller?.isWinner ?? false;

  const [showOverlay, setShowOverlay] = useState(false);
  const [podiumPhase, setPodiumPhase] = useState(0); // 0=none, 1=3rd, 2=2nd, 3=1st
  const [showRest, setShowRest] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [cardsRevealed, setCardsRevealed] = useState(false);

  useEffect(() => {
    music.duck();

    // Timeline
    const t0 = setTimeout(() => setShowOverlay(true), 50);
    const t1 = setTimeout(() => { setPodiumPhase(1); setCardsRevealed(true); }, 400);  // 3rd
    const t2 = setTimeout(() => setPodiumPhase(2), 800);  // 2nd
    const t3 = setTimeout(() => {
      setPodiumPhase(3); // 1st
      play('win');
    }, 1200);
    const t4 = setTimeout(() => setShowRest(true), 1600);
    const t5 = setTimeout(() => setShowButtons(true), 2000);

    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, [play, music]);

  // Podium display order: [2nd, 1st, 3rd]
  const podiumOrder = [1, 0, 2];
  const podiumHeights = [160, 120, 90]; // 1st, 2nd, 3rd
  const podiumColors = ['border-kaboom-gold', 'border-gray-400', 'border-amber-600'];
  const glowColors = ['shadow-[0_0_20px_rgba(245,197,24,0.4)]', 'shadow-[0_0_12px_rgba(192,192,192,0.3)]', 'shadow-[0_0_12px_rgba(205,127,50,0.3)]'];
  // Map display index to podium phase trigger: display[0]=2nd→phase2, display[1]=1st→phase3, display[2]=3rd→phase1
  const phaseForDisplay = [2, 3, 1];

  return (
    <div
      className={`fixed inset-0 z-[70] transition-opacity duration-400 ${showOverlay ? 'opacity-100' : 'opacity-0'}`}
      style={{ background: '#0a0f1a' }}
    >
      {/* Background texture — faint card suits */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.04]">
        {['♠', '♥', '♣', '♦'].map((suit, i) => (
          Array.from({ length: 8 }).map((_, j) => (
            <span
              key={`${i}-${j}`}
              className="absolute text-white text-2xl"
              style={{ left: `${10 + (i * 25) + (j % 2) * 12}%`, top: `${5 + j * 12}%`, transform: `rotate(${(i + j) * 15}deg)` }}
            >
              {suit}
            </span>
          ))
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center animate-fade-in z-10">
        {top3[0]?.displayName === 'Dania' && top3[0]?.isWinner ? (
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-black text-kaboom-gold">Dania Wins</h1>
            <div className="h-[2px] w-24 mx-auto mt-1 bg-red-500 rounded-full" />
          </div>
        ) : (
          <h1 className="text-[28px] sm:text-[32px] font-black text-kaboom-gold">Round Over</h1>
        )}
        {caller && (
          <div className="flex items-center justify-center gap-2 mt-1">
            <AvatarIcon shape="circle" color={callerWon ? '#f5c518' : '#e94560'} size={20} />
            <span className="text-xs text-gray-400">
              <span className="text-white font-medium">{caller.displayName}</span> called Kaboom
            </span>
          </div>
        )}
      </div>

      {/* Podium */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-[28%] sm:bottom-[32%] flex items-end justify-center gap-2 sm:gap-4">
        {podiumOrder.map((rank, displayIdx) => {
          const player = top3[rank];
          if (!player) return <div key={rank} className="w-24" />;

          const height = podiumHeights[rank];
          const isVisible = podiumPhase >= phaseForDisplay[displayIdx];
          const is1st = rank === 0;
          const callerLost = player.calledKaboom && !player.isWinner;
          const isMe = player.playerId === currentUserId;

          return (
            <div key={rank} className="flex flex-col items-center" style={{ width: is1st ? 110 : 90 }}>
              {/* Crown for 1st */}
              {is1st && podiumPhase >= 3 && (
                <div className="mb-1" style={{ animation: 'crownDrop 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both', animationDelay: '200ms' }}>
                  <CrownIcon size={is1st ? 28 : 20} />
                </div>
              )}

              {/* Avatar */}
              {isVisible && (
                <div style={{ animation: 'avatarBounce 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both', animationDelay: '100ms' }}>
                  <AvatarIcon
                    shape={isMe ? avatar.shape : 'circle'}
                    color={is1st ? '#f5c518' : rank === 1 ? '#c0c0c0' : '#cd7f32'}
                    size={is1st ? 40 : 32}
                    showKaboom={is1st}
                  />
                </div>
              )}

              {/* Name + Score */}
              {isVisible && (
                <div className="text-center mt-1 mb-1">
                  <div className="text-[11px] text-gray-300 font-medium truncate max-w-[90px]">{player.displayName}</div>
                  <div className={`text-lg font-black tabular-nums ${is1st ? 'text-kaboom-gold' : scoreColor(player.score)}`}>
                    {player.score}
                  </div>
                  {callerLost && <div className="text-[8px] text-red-400 font-bold">Called Kaboom</div>}
                </div>
              )}

              {/* Cards row */}
              {isVisible && cardsRevealed && (
                <div className="flex gap-0.5 mb-1">
                  {player.cards.map((card, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <Card card={card} width={32} height={45} />
                      {card && <span className={`text-[7px] font-bold ${cardValueColor(card)}`}>{getCardValue(card)}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Platform */}
              <div
                className={`w-full rounded-t-lg border-t-2 border-x transition-all duration-400 ${podiumColors[rank]} ${isVisible ? glowColors[rank] : ''} ${callerLost ? 'bg-red-950/30' : 'bg-[#0f1524]'}`}
                style={{
                  height: isVisible ? height : 0,
                  transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Players 4+ ranked list */}
      {showRest && rest.length > 0 && (
        <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 w-full max-w-md px-4">
          {rest.map((player, idx) => (
            <div
              key={player.playerId}
              className="flex items-center gap-2 bg-[#0f1524]/80 rounded-lg px-3 py-1.5 mb-1 animate-slide-up"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <span className="text-gray-500 font-bold text-xs w-5">#{idx + 4}</span>
              <AvatarIcon
                shape={player.playerId === currentUserId ? avatar.shape : 'circle'}
                color="#3b82f6" size={18}
              />
              <span className="text-[11px] text-gray-300 flex-1 truncate">{player.displayName}</span>
              <div className="flex gap-0.5">
                {player.cards.map((card, ci) => (
                  <Card key={ci} card={card} width={24} height={34} />
                ))}
              </div>
              <span className={`text-sm font-black tabular-nums ${scoreColor(player.score)}`}>{player.score}</span>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      {showButtons && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 w-full max-w-sm px-4 animate-slide-up">
          {onPlayAgain && (
            <button
              onClick={onPlayAgain}
              className="flex-1 py-3 bg-kaboom-gold hover:bg-yellow-400 text-black font-bold rounded-xl transition-all active:scale-[0.98] shadow-lg"
            >
              Play Again
            </button>
          )}
          <button
            onClick={onBackToLobby}
            className={`${onPlayAgain ? 'flex-1' : 'w-full'} py-3 bg-transparent border border-gray-600 hover:border-gray-400 text-white font-medium rounded-xl transition-all active:scale-[0.98]`}
          >
            Leave Game
          </button>
        </div>
      )}

      <style>{`
        @keyframes crownDrop {
          0% { transform: translateY(-20px) scale(0); opacity: 0; }
          60% { transform: translateY(3px) scale(1.1); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes avatarBounce {
          0% { transform: translateY(-30px); opacity: 0; }
          60% { transform: translateY(4px); opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

import { useState } from 'react';
import type { RoomState } from '@kaboom/shared';
import AvatarIcon from '../game/AvatarIcon.tsx';
import { loadAvatarChoice } from '../game/AvatarPicker.tsx';
import { useSound } from '../../hooks/useSound.tsx';

interface WaitingRoomProps {
  readonly roomState: RoomState;
  readonly currentUserId: string;
  readonly onStartGame: () => void;
  readonly onLeaveRoom: () => void;
}

const QUICK_MESSAGES = ['GG', "Let's go", 'Ready?', 'Good luck', 'Hurry up'];

// Distribute seats around the top of an oval
function getSeatPositions(count: number, maxSeats: number) {
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < maxSeats; i++) {
    const t = maxSeats === 1 ? 0.5 : i / (maxSeats - 1);
    const angle = Math.PI + t * (0 - Math.PI); // 9 o'clock to 3 o'clock
    positions.push({
      x: 50 + 38 * Math.cos(angle),
      y: 50 - 34 * Math.sin(angle),
    });
  }
  return positions;
}

export default function WaitingRoom({ roomState, currentUserId, onStartGame, onLeaveRoom }: WaitingRoomProps) {
  const isHost = roomState.hostId === currentUserId;
  const [copied, setCopied] = useState(false);
  const [floatingMsg, setFloatingMsg] = useState<{ text: string; id: number } | null>(null);
  const { play } = useSound();
  const avatar = loadAvatarChoice();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomState.roomCode);
      setCopied(true);
      play('buttonClick');
      setTimeout(() => setCopied(false), 1500);
    } catch { /* fallback */ }
  };

  const handleQuickMessage = (msg: string) => {
    play('buttonClick');
    setFloatingMsg({ text: msg, id: Date.now() });
    setTimeout(() => setFloatingMsg(null), 2000);
  };

  const seatPositions = getSeatPositions(roomState.players.length - 1, roomState.maxPlayers - 1);
  const otherPlayers = roomState.players.filter((p) => p.id !== currentUserId);

  return (
    <div className="h-[100dvh] w-screen overflow-hidden relative" style={{ background: 'radial-gradient(ellipse at 50% 50%, #1a3a2a 0%, #0d1117 70%)' }}>
      {/* Room code — top center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 text-center">
        <button onClick={handleCopy} className="inline-flex items-center gap-2 group">
          <span className="text-3xl sm:text-4xl font-mono tracking-[0.3em] text-kaboom-gold group-hover:text-yellow-300 transition-colors font-black">
            {roomState.roomCode}
          </span>
          <svg className="w-5 h-5 text-gray-500 group-hover:text-kaboom-gold transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        <p className="text-gray-400 text-xs mt-0.5">
          {copied ? <span className="text-green-400">Copied!</span> : `${roomState.players.length}/${roomState.maxPlayers} players`}
        </p>
      </div>

      {/* Leave button — top left */}
      <button
        onClick={onLeaveRoom}
        className="absolute top-4 left-4 z-20 text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>

      {/* Oval table */}
      <div className="absolute inset-0 mx-auto" style={{ maxWidth: 1200 }}>
        <div
          className="absolute rounded-[50%] border border-white/5"
          style={{
            left: '10%', right: '10%', top: '8%', bottom: '8%',
            background: 'radial-gradient(ellipse, rgba(26,58,42,0.3) 0%, transparent 70%)',
          }}
        />

        {/* Other players' seats on the oval */}
        {seatPositions.map((pos, idx) => {
          const player = otherPlayers[idx];

          return (
            <div
              key={idx}
              className="absolute transition-all duration-500"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {player ? (
                <div className="flex flex-col items-center gap-1 animate-slide-in">
                  <AvatarIcon shape="circle" color="#3b82f6" size={40} />
                  <span className="text-xs text-gray-300 font-medium truncate max-w-[80px]">
                    {player.displayName}
                  </span>
                  {player.id === roomState.hostId && (
                    <span className="text-[9px] bg-kaboom-gold text-black px-1.5 rounded font-bold">HOST</span>
                  )}
                </div>
              ) : (
                /* Empty seat placeholder — pulsing outline */
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-10 h-10 rounded-full border-2 border-dashed border-gray-600"
                    style={{ animation: 'seatPulse 2s ease-in-out infinite' }}
                  />
                  <span className="text-[10px] text-gray-600">Empty</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Local player — bottom center */}
        <div
          className="absolute left-1/2 transition-all duration-200"
          style={{ bottom: '12%', transform: 'translateX(-50%)' }}
        >
          <div className="flex flex-col items-center gap-1 relative">
            <AvatarIcon shape={avatar.shape} color={avatar.color} size={48} isActive />
            <span className="text-sm text-kaboom-gold font-bold">
              {roomState.players.find((p) => p.id === currentUserId)?.displayName ?? 'You'}
            </span>
            {isHost && (
              <span className="text-[9px] bg-kaboom-gold text-black px-1.5 rounded font-bold">HOST</span>
            )}

            {/* Floating message bubble */}
            {floatingMsg && (
              <div
                key={floatingMsg.id}
                className="absolute -top-10 text-sm bg-kaboom-gold text-black px-3 py-1 rounded-full font-bold"
                style={{ animation: 'floatUp 2s ease-out forwards' }}
              >
                {floatingMsg.text}
              </div>
            )}
          </div>
        </div>

        {/* Center area — Start button or waiting message */}
        <div className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 text-center">
          {isHost ? (
            <button
              onClick={() => { play('buttonClick'); onStartGame(); }}
              disabled={roomState.players.length < 2}
              className="px-8 py-3 bg-kaboom-accent hover:bg-red-500 text-white font-bold text-lg rounded-xl transition-all active:scale-95 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {roomState.players.length < 2 ? 'Waiting for players...' : 'Start Game'}
            </button>
          ) : (
            <p className="text-gray-400 text-sm">Waiting for host to start...</p>
          )}
        </div>
      </div>

      {/* Quick message bar — bottom */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 flex-wrap justify-center max-w-md">
        {QUICK_MESSAGES.map((msg) => (
          <button
            key={msg}
            onClick={() => handleQuickMessage(msg)}
            className="px-3 py-1.5 bg-kaboom-mid/80 border border-gray-700/50 rounded-full text-xs text-gray-300 hover:text-white hover:border-gray-500 transition-all active:scale-95"
          >
            {msg}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes seatPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
        @keyframes floatUp {
          0% { transform: translateY(0); opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translateY(-40px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

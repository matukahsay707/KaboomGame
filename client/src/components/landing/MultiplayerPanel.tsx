import { useState } from 'react';

interface MultiplayerPanelProps {
  readonly username: string;
  readonly onCreateRoom: (maxPlayers: number) => void;
  readonly onJoinRoom: (code: string) => void;
  readonly onBack: () => void;
  readonly error: string | null;
  readonly onClearError: () => void;
}

export default function MultiplayerPanel({
  username,
  onCreateRoom,
  onJoinRoom,
  onBack,
  error,
  onClearError,
}: MultiplayerPanelProps) {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [roomCode, setRoomCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);

  return (
    <div className="animate-fade-in w-full max-w-lg mx-auto px-4">
      {/* Back button */}
      <button
        onClick={mode === 'choose' ? onBack : () => setMode('choose')}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 group"
      >
        <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h2 className="text-3xl font-black text-kaboom-gold mb-2">Multiplayer</h2>
      <p className="text-gray-400 text-sm mb-6">Playing as <span className="text-kaboom-gold font-medium">{username}</span></p>

      {error && (
        <div className="bg-red-900/30 border border-red-600/50 rounded-xl p-3 mb-6 text-sm text-red-200 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={onClearError} className="text-red-400 hover:text-red-200 ml-2 text-lg leading-none">&times;</button>
        </div>
      )}

      {mode === 'choose' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setMode('create')}
            className="group p-6 bg-kaboom-mid/80 border border-gray-700 hover:border-kaboom-accent rounded-2xl transition-all duration-200 text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-kaboom-accent/10 flex items-center justify-center mb-3 group-hover:bg-kaboom-accent/20 transition-colors">
              <svg className="w-6 h-6 text-kaboom-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Create Room</h3>
            <p className="text-sm text-gray-400">Start a new game and invite friends with a code</p>
          </button>

          <button
            onClick={() => setMode('join')}
            className="group p-6 bg-kaboom-mid/80 border border-gray-700 hover:border-kaboom-gold rounded-2xl transition-all duration-200 text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-kaboom-gold/10 flex items-center justify-center mb-3 group-hover:bg-kaboom-gold/20 transition-colors">
              <svg className="w-6 h-6 text-kaboom-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Join Room</h3>
            <p className="text-sm text-gray-400">Enter a room code to join an existing game</p>
          </button>
        </div>
      )}

      {mode === 'create' && (
        <div className="bg-kaboom-mid/80 border border-gray-700 rounded-2xl p-6 animate-fade-in">
          <h3 className="text-lg font-bold text-white mb-4">Create a New Room</h3>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1.5 font-medium">Max Players</label>
            <div className="flex gap-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => setMaxPlayers(n)}
                  className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all duration-150 ${
                    maxPlayers === n
                      ? 'bg-kaboom-accent text-white shadow-lg shadow-kaboom-accent/30'
                      : 'bg-kaboom-dark/60 text-gray-400 hover:text-white hover:bg-kaboom-dark'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => onCreateRoom(maxPlayers)}
            className="w-full py-3 bg-kaboom-accent hover:bg-red-500 text-white font-bold rounded-xl transition-all duration-200 active:scale-[0.98] shadow-lg"
          >
            Create Room
          </button>
        </div>
      )}

      {mode === 'join' && (
        <div className="bg-kaboom-mid/80 border border-gray-700 rounded-2xl p-6 animate-fade-in">
          <h3 className="text-lg font-bold text-white mb-4">Join a Room</h3>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1.5 font-medium">Room Code</label>
            <input
              type="text"
              placeholder="ABCDEF"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full px-4 py-3 bg-kaboom-dark/80 rounded-xl border border-gray-700 focus:border-kaboom-gold focus:ring-1 focus:ring-kaboom-gold/30 focus:outline-none uppercase tracking-[0.3em] text-center font-mono text-xl text-white placeholder-gray-600 transition-all"
            />
          </div>
          <button
            onClick={() => roomCode.length >= 4 && onJoinRoom(roomCode)}
            disabled={roomCode.length < 4}
            className="w-full py-3 bg-kaboom-gold hover:bg-yellow-400 text-black font-bold rounded-xl transition-all duration-200 active:scale-[0.98] shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Join Room
          </button>
        </div>
      )}
    </div>
  );
}

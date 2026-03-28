import { useState } from 'react';

interface BotsPanelProps {
  readonly onStartBotGame: (difficulty: string) => void;
  readonly onBack: () => void;
}

const DIFFICULTIES = [
  {
    id: 'easy',
    label: 'Easy',
    color: 'text-green-400',
    borderColor: 'border-green-500/40 hover:border-green-400',
    bgColor: 'bg-green-500/10',
    description: 'Bots make random moves, rarely peek, and never call Kaboom early. Great for learning the game.',
  },
  {
    id: 'medium',
    label: 'Medium',
    color: 'text-kaboom-gold',
    borderColor: 'border-kaboom-gold/40 hover:border-kaboom-gold',
    bgColor: 'bg-kaboom-gold/10',
    description: 'Bots remember their cards, make smart swaps, and use special abilities. A fair challenge.',
  },
  {
    id: 'hard',
    label: 'Hard',
    color: 'text-kaboom-accent',
    borderColor: 'border-kaboom-accent/40 hover:border-kaboom-accent',
    bgColor: 'bg-kaboom-accent/10',
    description: 'Bots track discards, counter your matches, and call Kaboom at the perfect moment. Good luck.',
  },
] as const;

function FlameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="inline-block">
      <path
        d="M12 2C12 2 7 8 7 13C7 16.866 9.134 19 12 20C14.866 19 17 16.866 17 13C17 8 12 2 12 2Z"
        fill="#e94560"
        opacity={0.8}
      />
      <path
        d="M12 6C12 6 9.5 10 9.5 13C9.5 15.209 10.567 16.5 12 17C13.433 16.5 14.5 15.209 14.5 13C14.5 10 12 6 12 6Z"
        fill="#ff6b6b"
      />
      <path
        d="M12 10C12 10 11 12 11 13.5C11 14.88 11.5 15.5 12 15.5C12.5 15.5 13 14.88 13 13.5C13 12 12 10 12 10Z"
        fill="#ffa500"
      />
    </svg>
  );
}

export default function BotsPanel({ onStartBotGame, onBack }: BotsPanelProps) {
  const [selected, setSelected] = useState<string>('medium');

  return (
    <div className="animate-fade-in w-full max-w-lg mx-auto px-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 group"
      >
        <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h2 className="text-3xl font-black text-kaboom-gold mb-6">Play vs Bots</h2>

      {/* Difficulty selector */}
      <div className="space-y-3 mb-4">
        <label className="block text-sm text-gray-400 font-medium">Difficulty</label>
        {DIFFICULTIES.map((diff) => (
          <button
            key={diff.id}
            onClick={() => setSelected(diff.id)}
            className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 ${
              selected === diff.id
                ? `${diff.borderColor} ${diff.bgColor} ring-1 ring-current/20`
                : 'border-gray-700/50 bg-kaboom-mid/60 hover:bg-kaboom-mid/80'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${
                selected === diff.id ? `${diff.color} border-current` : 'border-gray-600'
              }`}>
                {selected === diff.id && <div className="w-2.5 h-2.5 rounded-full bg-current" />}
              </div>
              <div>
                <span className={`font-bold text-base ${selected === diff.id ? diff.color : 'text-gray-300'}`}>
                  {diff.label}
                </span>
                <p className="text-sm text-gray-400 mt-0.5">{diff.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Dania Mode — visually separated */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 mt-4">
          <div className="flex-1 h-px bg-red-900/40" />
          <span className="text-[10px] text-red-500/60 uppercase tracking-widest font-bold">Nightmare</span>
          <div className="flex-1 h-px bg-red-900/40" />
        </div>
        <button
          onClick={() => setSelected('dania')}
          className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 ${
            selected === 'dania'
              ? 'border-red-500/60 bg-red-950/30 ring-1 ring-red-500/30 shadow-[0_0_20px_rgba(233,69,96,0.15)]'
              : 'border-red-900/30 bg-red-950/10 hover:bg-red-950/20 hover:border-red-800/40'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${
              selected === 'dania' ? 'text-red-400 border-red-400' : 'border-red-900/60'
            }`}>
              {selected === 'dania' && <div className="w-2.5 h-2.5 rounded-full bg-red-400" />}
            </div>
            <div>
              <span className={`font-bold text-base flex items-center gap-1.5 ${
                selected === 'dania' ? 'text-red-400' : 'text-red-400/60'
              }`}>
                <FlameIcon /> Dania Mode <FlameIcon />
              </span>
              <p className={`text-sm mt-0.5 ${selected === 'dania' ? 'text-red-300/70' : 'text-red-400/40'}`}>
                Unmerciful. You have been warned.
              </p>
            </div>
          </div>
        </button>
      </div>

      <button
        onClick={() => onStartBotGame(selected)}
        className={`w-full py-4 font-bold text-lg rounded-xl transition-all duration-200 active:scale-[0.98] shadow-lg ${
          selected === 'dania'
            ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
            : 'bg-kaboom-gold hover:bg-yellow-400 text-black shadow-kaboom-gold/20'
        }`}
      >
        {selected === 'dania' ? 'Enter Dania Mode' : 'Start Game'}
      </button>
    </div>
  );
}

import SVGCard from './SVGCard.tsx';

interface HeroSectionProps {
  readonly onPlayOnline: () => void;
  readonly onPlayFriends: () => void;
  readonly onPlayBots: () => void;
}

export default function HeroSection({ onPlayOnline, onPlayFriends, onPlayBots }: HeroSectionProps) {
  return (
    <section className="relative min-h-[80vh] flex flex-col items-center justify-center px-4 py-12 overflow-hidden">
      {/* Decorative cards */}
      <div className="hidden md:block absolute top-16 left-8 -rotate-12 opacity-30">
        <SVGCard faceDown size="lg" />
      </div>
      <div className="hidden md:block absolute top-24 right-12 rotate-6 opacity-30">
        <SVGCard faceDown size="lg" />
      </div>
      <div className="hidden lg:block absolute bottom-20 left-16 rotate-[15deg] opacity-20">
        <SVGCard faceDown size="md" />
      </div>
      <div className="hidden lg:block absolute bottom-16 right-20 -rotate-[20deg] opacity-20">
        <SVGCard faceDown size="md" />
      </div>

      {/* Logo */}
      <div className="text-center mb-8 animate-fade-in">
        <h1 className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tight mb-2">
          <span className="text-kaboom-accent">K</span>
          <span className="text-kaboom-gold">A</span>
          <span className="text-white">B</span>
          <span className="text-kaboom-accent">O</span>
          <span className="text-kaboom-gold">O</span>
          <span className="text-white">M</span>
        </h1>
        <div className="h-1 w-24 mx-auto bg-gradient-to-r from-kaboom-accent via-kaboom-gold to-kaboom-accent rounded-full mb-4" />
        <p className="text-gray-400 text-lg sm:text-xl max-w-md mx-auto">
          The explosive card game of memory, strategy & quick reflexes
        </p>
      </div>

      {/* Featured cards fan */}
      <div className="flex items-end justify-center gap-1 sm:gap-2 mb-10">
        <div className="-rotate-[15deg] translate-y-2">
          <SVGCard rank="K" suit="spades" size="md" />
        </div>
        <div className="-rotate-[7deg] translate-y-0.5">
          <SVGCard rank="Q" suit="hearts" size="md" />
        </div>
        <div className="translate-y-0 z-10">
          <SVGCard joker="red" size="md" className="ring-2 ring-kaboom-gold/50 rounded-lg" />
        </div>
        <div className="rotate-[7deg] translate-y-0.5">
          <SVGCard rank="10" suit="diamonds" size="md" />
        </div>
        <div className="rotate-[15deg] translate-y-2">
          <SVGCard rank="J" suit="clubs" size="md" />
        </div>
      </div>

      {/* CTA Buttons — 3 modes */}
      <div className="flex flex-col gap-3 w-full max-w-md">
        {/* Play Online — primary, most prominent */}
        <button
          onClick={onPlayOnline}
          className="w-full py-4 px-8 bg-kaboom-gold hover:bg-yellow-400 text-black font-bold text-lg rounded-xl transition-all duration-200 active:scale-[0.98] shadow-lg shadow-kaboom-gold/20 hover:shadow-kaboom-gold/40"
        >
          Play Online
          <span className="block text-xs font-normal opacity-70 mt-0.5">Get matched with real players instantly</span>
        </button>

        <div className="flex gap-3">
          {/* Play with Friends — secondary */}
          <button
            onClick={onPlayFriends}
            className="flex-1 py-3.5 px-6 bg-transparent border border-gray-600 hover:border-gray-400 text-white font-bold rounded-xl transition-all duration-200 active:scale-[0.98]"
          >
            Play with Friends
            <span className="block text-[10px] font-normal text-gray-400 mt-0.5">Private room with a code</span>
          </button>

          {/* Play vs Bots — tertiary */}
          <button
            onClick={onPlayBots}
            className="flex-1 py-3.5 px-6 bg-transparent border border-gray-600 hover:border-gray-400 text-white font-bold rounded-xl transition-all duration-200 active:scale-[0.98] min-h-[48px]"
          >
            Play vs Bots
            <span className="block text-[10px] font-normal text-gray-400 mt-0.5">Practice against AI</span>
          </button>
        </div>

      </div>
    </section>
  );
}

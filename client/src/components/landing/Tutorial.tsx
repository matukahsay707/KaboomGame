import { useState, useEffect, useRef, useCallback } from 'react';
import { B2 } from '@letele/playing-cards';
import SVGCard from './SVGCard.tsx';

interface TutorialProps {
  readonly onClose: () => void;
}

function CardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="inline-block">
      <rect x="3" y="2" width="14" height="20" rx="2" />
      <rect x="7" y="4" width="14" height="20" rx="2" fill="rgba(245,197,24,0.15)" />
    </svg>
  );
}

const slides = [
  {
    title: 'The Goal',
    content: 'Get the lowest score at the table. All your cards are face down \u2014 you have to remember what you have.',
    visual: 'goal',
  },
  {
    title: 'Your 4 Cards',
    content: 'At the start you get to peek at your bottom 2 cards. Remember them \u2014 you cannot look again unless you use a special card.',
    visual: 'grid',
  },
  {
    title: 'Card Values',
    content: 'Low points win. The Black King and Joker are your best friends.',
    visual: 'values',
  },
  {
    title: 'Your Turn',
    content: 'Draw from the deck or take the top discard. Then swap it with one of your cards or throw it away. You are always trying to lower your total.',
    visual: 'turn',
  },
  {
    title: 'Special Cards',
    content: 'These only activate when you draw them from the deck. If you are dealt them at the start they are just worth 10 points.',
    visual: 'specials',
  },
  {
    title: 'Matching',
    content: 'When anyone discards a card \u2014 react fast. If you have the same rank tap your card immediately. First one wins. Wrong guess earns a penalty card.',
    visual: 'matching',
  },
  {
    title: 'Calling Kaboom',
    content: 'Think you have the lowest score? Call KABOOM at the start of your turn before drawing. Everyone else gets one more turn. Then all cards are revealed.',
    visual: 'kaboom',
  },
  {
    title: 'Winning',
    content: 'Lowest score wins. If anyone ties or beats the player who called Kaboom \u2014 the caller loses. Even on a tie.',
    visual: 'winning',
  },
  {
    title: "You're Ready",
    content: 'Memory. Strategy. Quick reflexes. Good luck.',
    visual: 'ready',
  },
];


export default function Tutorial({ onClose }: TutorialProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right'>('right');
  const [animating, setAnimating] = useState(false);
  const touchStartRef = useRef(0);

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= slides.length || animating) return;
    setDirection(idx > current ? 'right' : 'left');
    setAnimating(true);
    setTimeout(() => {
      setCurrent(idx);
      setAnimating(false);
    }, 250);
  }, [current, animating]);

  const next = useCallback(() => goTo(current + 1), [goTo, current]);
  const prev = useCallback(() => goTo(current - 1), [goTo, current]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Touch swipe
  const onTouchStart = (e: React.TouchEvent) => { touchStartRef.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next(); else prev();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, handleClose]);

  const slide = slides[current];
  const isLast = current === slides.length - 1;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{
        background: '#0a0f1a',
        animation: 'tutorialSlideUp 400ms ease-out',
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 z-10 text-gray-500 hover:text-white transition-colors p-2"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center px-6 overflow-hidden">
        <div
          className="w-full max-w-md text-center"
          style={{
            animation: animating
              ? `tutorialSlide${direction === 'right' ? 'OutLeft' : 'OutRight'} 250ms ease-out`
              : `tutorialSlide${direction === 'right' ? 'InRight' : 'InLeft'} 250ms ease-out`,
          }}
        >
          {/* Step indicator */}
          <div className="text-[11px] text-gray-500 uppercase tracking-widest mb-4">
            Step {current + 1} of {slides.length}
          </div>

          {/* Title */}
          <h2 className="text-2xl sm:text-3xl font-black text-kaboom-gold mb-6">{slide.title}</h2>

          {/* Visual */}
          <div className="mb-6 flex justify-center">
            <SlideVisual type={slide.visual} />
          </div>

          {/* Text */}
          <p className="text-gray-300 text-base sm:text-lg leading-relaxed max-w-sm mx-auto">
            {slide.content}
          </p>

          {/* Final slide button */}
          {isLast && (
            <button
              onClick={handleClose}
              className="mt-8 px-8 py-3 bg-kaboom-gold hover:bg-yellow-400 text-black font-bold text-lg rounded-xl transition-all active:scale-95"
            >
              Start Playing
            </button>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="pb-8 px-6 flex items-center justify-between max-w-md mx-auto w-full">
        {/* Left arrow */}
        <button
          onClick={prev}
          disabled={current === 0}
          className={`p-2 rounded-lg transition-colors ${current === 0 ? 'text-gray-700' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Dots */}
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all ${i === current ? 'w-6 h-2 bg-kaboom-gold' : 'w-2 h-2 bg-gray-600 hover:bg-gray-500'}`}
            />
          ))}
        </div>

        {/* Right arrow */}
        <button
          onClick={isLast ? handleClose : next}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes tutorialSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes tutorialSlideOutLeft { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(-30%); } }
        @keyframes tutorialSlideOutRight { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(30%); } }
        @keyframes tutorialSlideInRight { from { opacity: 0; transform: translateX(30%); } to { opacity: 1; transform: translateX(0); } }
        @keyframes tutorialSlideInLeft { from { opacity: 0; transform: translateX(-30%); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
}

function SlideVisual({ type }: { readonly type: string }) {
  switch (type) {
    case 'goal':
      return (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ width: 56, height: 78 }} className="rounded-lg overflow-hidden shadow-lg">
              <B2 className="w-full h-full" />
            </div>
          ))}
        </div>
      );
    case 'grid':
      return (
        <div className="grid grid-cols-2 gap-2">
          <div style={{ width: 56, height: 78 }} className="rounded-lg overflow-hidden shadow-lg">
            <B2 className="w-full h-full" />
          </div>
          <div style={{ width: 56, height: 78 }} className="rounded-lg overflow-hidden shadow-lg">
            <B2 className="w-full h-full" />
          </div>
          <div className="ring-1 ring-kaboom-gold/50 rounded-lg" style={{ transform: 'translateY(-6px)' }}>
            <SVGCard rank="A" suit="hearts" size="sm" />
          </div>
          <div className="ring-1 ring-kaboom-gold/50 rounded-lg" style={{ transform: 'translateY(-6px)' }}>
            <SVGCard rank="3" suit="clubs" size="sm" />
          </div>
        </div>
      );
    case 'values':
      return (
        <div className="space-y-2 text-left">
          <ValueLine cards={[{ r: '7', s: 'hearts' }]} label="7" pts="7 pts" />
          <ValueLine cards={[{ r: 'A', s: 'spades' }]} label="Ace" pts="1 pt" />
          <ValueLine cards={[{ r: 'J', s: 'clubs' }]} label="J / Q" pts="10 pts" />
          <ValueLine cards={[{ r: 'K', s: 'hearts' }]} label="Red K" pts="25 pts" color="text-red-400" />
          <ValueLine cards={[{ r: 'K', s: 'spades' }]} label="Black K" pts="0 pts" color="text-green-400" />
          <div className="flex items-center gap-3 py-1">
            <SVGCard joker="red" size="xs" />
            <span className="text-white text-sm font-medium">Joker</span>
            <span className="text-kaboom-gold font-bold text-sm ml-auto">-1 pt</span>
          </div>
        </div>
      );
    case 'turn':
      return (
        <div className="flex items-center gap-4">
          <div style={{ width: 56, height: 78 }} className="rounded-lg overflow-hidden shadow-lg">
            <B2 className="w-full h-full" />
          </div>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f5c518" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <div className="grid grid-cols-2 gap-1">
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ width: 36, height: 50 }} className="rounded overflow-hidden shadow">
                <B2 className="w-full h-full" />
              </div>
            ))}
          </div>
        </div>
      );
    case 'specials':
      return (
        <div className="flex gap-3">
          <div className="text-center">
            <SVGCard rank="10" suit="diamonds" size="sm" />
            <div className="text-[10px] text-teal-400 mt-1 font-medium">Peek</div>
          </div>
          <div className="text-center">
            <SVGCard rank="J" suit="clubs" size="sm" />
            <div className="text-[10px] text-blue-400 mt-1 font-medium">Blind Trade</div>
          </div>
          <div className="text-center">
            <SVGCard rank="Q" suit="hearts" size="sm" />
            <div className="text-[10px] text-purple-400 mt-1 font-medium">Peek + Trade</div>
          </div>
        </div>
      );
    case 'matching':
      return (
        <div className="flex items-center gap-3">
          <SVGCard rank="5" suit="diamonds" size="sm" className="ring-2 ring-kaboom-gold/60 rounded-lg" />
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f5c518" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <SVGCard rank="5" suit="clubs" size="sm" className="ring-2 ring-green-400/60 rounded-lg" />
        </div>
      );
    case 'kaboom':
      return (
        <div className="text-center">
          <div className="inline-block px-8 py-3 bg-kaboom-gold text-black font-black text-2xl rounded-xl shadow-lg shadow-kaboom-gold/30">
            KABOOM!
          </div>
        </div>
      );
    case 'winning':
      return (
        <div className="flex items-end justify-center gap-2">
          <div className="flex flex-col items-center">
            <div className="w-12 h-16 bg-gray-600 rounded-t-lg" />
            <span className="text-[10px] text-gray-400 mt-1">3rd</span>
          </div>
          <div className="flex flex-col items-center">
            <svg width="20" height="16" viewBox="0 0 20 16" fill="#f5c518" className="mb-1">
              <path d="M10 0L13 6L20 7L15 12L16 19L10 16L4 19L5 12L0 7L7 6Z" transform="scale(1, 0.8)" />
            </svg>
            <div className="w-14 h-24 bg-kaboom-gold/30 border border-kaboom-gold/50 rounded-t-lg" />
            <span className="text-[10px] text-kaboom-gold mt-1 font-bold">1st</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-12 h-20 bg-gray-500 rounded-t-lg" />
            <span className="text-[10px] text-gray-400 mt-1">2nd</span>
          </div>
        </div>
      );
    case 'ready':
      return (
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight">
          <span className="text-kaboom-accent">K</span>
          <span className="text-kaboom-gold">A</span>
          <span className="text-white">B</span>
          <span className="text-kaboom-accent">O</span>
          <span className="text-kaboom-gold">O</span>
          <span className="text-white">M</span>
        </h1>
      );
    default:
      return null;
  }
}

function ValueLine({ cards, label, pts, color = 'text-kaboom-gold' }: {
  readonly cards: readonly { r: string; s: string }[];
  readonly label: string;
  readonly pts: string;
  readonly color?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      {cards.map((c, i) => (
        <SVGCard key={i} rank={c.r as 'A'} suit={c.s as 'hearts'} size="xs" />
      ))}
      <span className="text-white text-sm font-medium">{label}</span>
      <span className={`${color} font-bold text-sm ml-auto`}>{pts}</span>
    </div>
  );
}

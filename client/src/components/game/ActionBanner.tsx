import { useState, useEffect, useCallback, useRef } from 'react';

export interface BannerEvent {
  readonly playerName: string;
  readonly actionText: string;
  readonly detailText?: string;
  readonly accentColor: string;
  readonly secondaryPulse?: string;
}

type Phase = 'idle' | 'entering' | 'holding' | 'exiting';

interface ActionBannerProps {
  readonly bannerQueue: readonly BannerEvent[];
  readonly onDequeue: () => void;
}

export default function ActionBanner({ bannerQueue, onDequeue }: ActionBannerProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [current, setCurrent] = useState<BannerEvent | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  const showNext = useCallback(() => {
    if (bannerQueue.length === 0) {
      setCurrent(null);
      setPhase('idle');
      return;
    }

    const next = bannerQueue[0];
    setCurrent(next);
    setPhase('entering');

    // Enter → hold → exit → dequeue
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setPhase('holding');
      timeoutRef.current = setTimeout(() => {
        setPhase('exiting');
        timeoutRef.current = setTimeout(() => {
          onDequeue();
          setPhase('idle');
          setCurrent(null);
        }, 250);
      }, 1800);
    }, 300);
  }, [bannerQueue, onDequeue]);

  // When queue changes and we're idle, show next
  useEffect(() => {
    if (phase === 'idle' && bannerQueue.length > 0) {
      // Small gap between banners
      const t = setTimeout(showNext, 100);
      return () => clearTimeout(t);
    }
    // If a new banner arrives while holding, cut short and show it
    if (phase === 'holding' && bannerQueue.length > 1) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setPhase('exiting');
      timeoutRef.current = setTimeout(() => {
        onDequeue();
        setPhase('idle');
        setCurrent(null);
      }, 250);
    }
  }, [bannerQueue.length, phase, showNext, onDequeue]);

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  if (!current) return null;

  const height = isMobile ? 56 : 72;

  let transform: string;
  let opacity = 1;
  switch (phase) {
    case 'entering':
      transform = 'translate(-110%, -50%)';
      // CSS transition will animate to center
      break;
    case 'holding':
      transform = 'translate(0, -50%)';
      break;
    case 'exiting':
      transform = 'translate(110%, -50%)';
      break;
    default:
      transform = 'translate(-110%, -50%)';
      opacity = 0;
  }

  return (
    <div
      className="fixed left-0 right-0 z-[100] pointer-events-none"
      style={{
        top: '50%',
        height,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height,
          transform: phase === 'entering' ? 'translate(0, -50%)' : transform,
          opacity,
          transition: phase === 'entering'
            ? 'transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            : phase === 'exiting'
              ? 'transform 250ms cubic-bezier(0.55, 0, 1, 0.45)'
              : 'none',
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(8, 12, 20, 0.92)',
          backdropFilter: 'blur(8px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Accent stripe */}
        <div
          style={{
            width: 6,
            height: '100%',
            background: current.accentColor,
            flexShrink: 0,
            boxShadow: `0 0 12px ${current.accentColor}60`,
          }}
        />
        {current.secondaryPulse && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              width: 6,
              height: '100%',
              background: current.secondaryPulse,
              animation: 'bannerPulse 0.6s ease-in-out infinite alternate',
            }}
          />
        )}

        {/* Content */}
        <div className="flex items-center justify-between flex-1 px-4 sm:px-8">
          {/* Left: player name */}
          <span className="text-white text-[13px] font-medium truncate max-w-[100px] sm:max-w-[160px]">
            {current.playerName}
          </span>

          {/* Center: action text */}
          <span
            className="text-[20px] sm:text-[22px] font-black tracking-wider uppercase"
            style={{
              color: current.accentColor,
              textShadow: `0 0 20px ${current.accentColor}40`,
            }}
          >
            {current.actionText}
          </span>

          {/* Right: detail text */}
          <span className="text-gray-400 text-[13px] truncate max-w-[100px] sm:max-w-[160px] text-right">
            {current.detailText ?? ''}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes bannerPulse {
          0% { opacity: 0; }
          100% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}

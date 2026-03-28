import { useEffect, useState } from 'react';

interface MagnifyingGlassProps {
  readonly variant: 'peek10' | 'queen';
  readonly onComplete?: () => void;
}

export default function MagnifyingGlass({ variant, onComplete }: MagnifyingGlassProps) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in');

  const holdDuration = variant === 'queen' ? 600 : 400;
  const color = variant === 'queen' ? '#f5c518' : '#00c8c8';

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 200);
    const t2 = setTimeout(() => setPhase('out'), 200 + holdDuration);
    const t3 = setTimeout(() => onComplete?.(), 200 + holdDuration + 200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [holdDuration, onComplete]);

  const scale = phase === 'in' ? 'scale-0' : phase === 'hold' ? 'scale-100' : 'scale-0';

  return (
    <div className={`absolute inset-0 z-20 flex items-center justify-center pointer-events-none transition-transform duration-200 ease-out ${scale}`}>
      <svg
        width="48" height="48" viewBox="0 0 48 48" fill="none"
        className="drop-shadow-lg"
      >
        {/* Glass circle */}
        <circle cx="20" cy="20" r="14" stroke={color} strokeWidth="3" fill="none" opacity="0.8" />
        {/* Handle */}
        <line x1="30" y1="30" x2="42" y2="42" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
        {/* Shine */}
        <path d="M12 14 Q14 10 18 12" stroke="white" strokeWidth="1.5" fill="none" opacity="0.5" />
      </svg>
    </div>
  );
}

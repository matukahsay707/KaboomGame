import { useEffect, useState } from 'react';

interface SpecialCardGlowProps {
  readonly type: 'peek' | 'blindTrade' | 'peekAndTrade';
}

const COLORS: Record<string, string> = {
  peek: 'rgba(0, 200, 200, 0.6)',       // teal for 10
  blindTrade: 'rgba(60, 120, 255, 0.6)', // blue for Jack
  peekAndTrade: 'rgba(245, 197, 24, 0.6)', // gold for Queen
};

export default function SpecialCardGlow({ type }: SpecialCardGlowProps) {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setActive(false), 400);
    return () => clearTimeout(timer);
  }, []);

  if (!active) return null;

  const color = COLORS[type] ?? COLORS.peek;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-10"
      style={{
        animation: 'specialGlow 400ms ease-out forwards',
      }}
    >
      <div
        className="absolute rounded-full"
        style={{
          top: '50%',
          left: '50%',
          width: '200%',
          height: '200%',
          transform: 'translate(-50%, -50%) scale(0)',
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          animation: 'glowExpand 400ms ease-out forwards',
        }}
      />
      <style>{`
        @keyframes glowExpand {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0.6; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

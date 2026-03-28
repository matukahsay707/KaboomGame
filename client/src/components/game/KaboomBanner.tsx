import { useEffect, useState } from 'react';

interface KaboomBannerProps {
  readonly callerName: string;
}

export default function KaboomBanner({ callerName }: KaboomBannerProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      {/* Background flash */}
      <div className="absolute inset-0 bg-kaboom-accent/20 animate-fade-in" />

      {/* Explosion particles */}
      <div className="absolute">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 rounded-full bg-kaboom-gold"
            style={{
              animation: `particle${i % 3} 1s ease-out forwards`,
              transform: `rotate(${i * 30}deg) translateY(-20px)`,
            }}
          />
        ))}
      </div>

      {/* Main text */}
      <div className="text-center animate-kaboom-explode">
        <h1
          className="text-7xl sm:text-8xl font-black drop-shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, #e94560, #f5c518, #e94560)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: 'none',
            filter: 'drop-shadow(0 0 30px rgba(233, 69, 96, 0.5))',
          }}
        >
          KABOOM!
        </h1>
        <p className="text-2xl text-kaboom-gold mt-4 animate-slide-up font-bold">
          {callerName} called it!
        </p>
      </div>
    </div>
  );
}

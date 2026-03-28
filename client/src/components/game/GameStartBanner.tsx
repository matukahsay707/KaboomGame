import { useEffect, useState } from 'react';

interface GameStartBannerProps {
  readonly onComplete: () => void;
}

export default function GameStartBanner({ onComplete }: GameStartBannerProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 400);
    }, 1800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-45 flex items-center justify-center pointer-events-none transition-opacity duration-400 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`text-4xl sm:text-5xl font-black tracking-wider transition-transform duration-500 ${
          visible ? 'translate-x-0 scale-100' : 'translate-x-[100vw] scale-75'
        }`}
        style={{
          background: 'linear-gradient(90deg, #e94560, #f5c518, #e94560)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 0 40px rgba(245, 197, 24, 0.3)',
        }}
      >
        GAME START
      </div>
    </div>
  );
}

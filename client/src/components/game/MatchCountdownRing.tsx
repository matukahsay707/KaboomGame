import { useState, useEffect } from 'react';

interface MatchCountdownRingProps {
  readonly duration: number;
  readonly startTime: number;
  readonly size: number;
}

export default function MatchCountdownRing({ duration, startTime, size }: MatchCountdownRingProps) {
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const p = Math.max(0, 1 - elapsed / duration);
      setProgress(p);
      if (p <= 0) clearInterval(interval);
    }, 30);
    return () => clearInterval(interval);
  }, [duration, startTime]);

  const strokeWidth = 3;
  const radius = size / 2 + strokeWidth + 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);
  const isWarning = progress <= 0.25;
  const color = isWarning ? '#e94560' : '#f5c518';

  return (
    <svg
      className="absolute pointer-events-none"
      style={{
        width: radius * 2 + strokeWidth,
        height: radius * 2 + strokeWidth,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Background ring */}
      <circle
        cx={radius + strokeWidth / 2}
        cy={radius + strokeWidth / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={strokeWidth}
      />
      {/* Countdown ring — depletes clockwise from top */}
      <circle
        cx={radius + strokeWidth / 2}
        cy={radius + strokeWidth / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        style={{
          transform: 'rotate(-90deg)',
          transformOrigin: '50% 50%',
          transition: 'stroke 300ms ease, stroke-dashoffset 30ms linear',
          filter: `drop-shadow(0 0 3px ${color}80)`,
        }}
      />
    </svg>
  );
}

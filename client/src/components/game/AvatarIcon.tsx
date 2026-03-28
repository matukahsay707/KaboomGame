interface AvatarIconProps {
  readonly shape: string;
  readonly color: string;
  readonly size?: number;
  readonly isActive?: boolean;
  readonly isDisconnected?: boolean;
  readonly showKaboom?: boolean;
  readonly animClass?: string;
}

const SHAPES: Record<string, (color: string) => JSX.Element> = {
  circle: (c) => <circle cx="16" cy="16" r="10" fill={c} />,
  diamond: (c) => <polygon points="16,4 28,16 16,28 4,16" fill={c} />,
  star: (c) => <polygon points="16,4 19,12 28,12 21,18 23,27 16,22 9,27 11,18 4,12 13,12" fill={c} />,
  triangle: (c) => <polygon points="16,4 28,28 4,28" fill={c} />,
  hexagon: (c) => <polygon points="16,4 26,10 26,22 16,28 6,22 6,10" fill={c} />,
  cross: (c) => <path d="M12,4 h8 v8 h8 v8 h-8 v8 h-8 v-8 h-8 v-8 h8z" fill={c} />,
  shield: (c) => <path d="M16,4 L26,10 L26,20 L16,28 L6,20 L6,10Z" fill={c} />,
  crown: (c) => <path d="M4,24 L4,12 L10,18 L16,8 L22,18 L28,12 L28,24Z" fill={c} />,
};

const AVATAR_SHAPES = Object.keys(SHAPES);
const AVATAR_COLORS = ['#f5c518', '#e94560', '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#14b8a6', '#ec4899'];
const AVATAR_COLOR_NAMES = ['gold', 'red', 'blue', 'green', 'purple', 'orange', 'teal', 'pink'];

export { AVATAR_SHAPES, AVATAR_COLORS, AVATAR_COLOR_NAMES };

export default function AvatarIcon({
  shape, color, size = 32, isActive, isDisconnected, showKaboom, animClass = '',
}: AvatarIconProps) {
  const shapeRenderer = SHAPES[shape] ?? SHAPES.circle;

  return (
    <div
      className={`relative flex-shrink-0 ${animClass}`}
      style={{
        width: size,
        height: size,
        filter: isDisconnected ? 'grayscale(1) opacity(0.5)' : undefined,
      }}
    >
      {/* Glow ring for active turn */}
      {isActive && (
        <div
          className="absolute inset-[-4px] rounded-full animate-pulse"
          style={{ boxShadow: `0 0 8px ${color}, 0 0 16px ${color}40` }}
        />
      )}

      {/* Avatar circle background */}
      <svg viewBox="0 0 32 32" className="w-full h-full">
        <circle cx="16" cy="16" r="15" fill="#1a1a2e" stroke={color} strokeWidth="1.5" />
        {shapeRenderer(color)}
      </svg>

      {/* Kaboom particles */}
      {showKaboom && (
        <div className="absolute inset-0 pointer-events-none">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-kaboom-gold"
              style={{
                top: '50%',
                left: '50%',
                animation: `kaboomParticle 600ms ease-out ${i * 100}ms forwards`,
                transform: `rotate(${i * 90}deg)`,
              }}
            />
          ))}
        </div>
      )}

      {/* Disconnected indicator */}
      {isDisconnected && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border border-kaboom-dark flex items-center justify-center">
          <svg className="w-2 h-2 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 2L10 10M2 10L10 2" />
          </svg>
        </div>
      )}

      <style>{`
        @keyframes kaboomParticle {
          0% { transform: translate(-50%, -50%) rotate(var(--r, 0deg)) translateY(0) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -50%) rotate(var(--r, 0deg)) translateY(-16px) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

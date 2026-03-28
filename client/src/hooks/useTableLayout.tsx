import { useState, useEffect, useCallback, useRef } from 'react';

export type ScreenTier = 'phone-portrait' | 'phone-landscape' | 'tablet' | 'desktop' | 'widescreen';

export interface CardDimensions {
  readonly localW: number;
  readonly localH: number;
  readonly oppW: number;
  readonly oppH: number;
  readonly centerW: number;
  readonly centerH: number;
}

export interface OpponentPosition {
  readonly x: number; // % from left
  readonly y: number; // % from top
  readonly angle: number; // degrees, for CSS rotate
}

export interface TableLayout {
  readonly tier: ScreenTier;
  readonly vw: number;
  readonly vh: number;
  readonly cards: CardDimensions;
  readonly opponentPositions: readonly OpponentPosition[];
  readonly showOpponentCards: boolean;
  readonly showNames: boolean;
  readonly tableWidth: number;
  readonly tableHeight: number;
}

function clamp(min: number, preferred: number, max: number): number {
  return Math.min(max, Math.max(min, preferred));
}

function getTier(w: number, h: number): ScreenTier {
  if (w < 480 && h > w) return 'phone-portrait';
  if (h < 480 && w > h) return 'phone-landscape';
  if (w < 1024) return 'tablet';
  if (w < 1440) return 'desktop';
  return 'widescreen';
}

function calcCardDimensions(vw: number, vh: number, tier: ScreenTier): CardDimensions {
  let localW: number;
  let oppW: number;
  let centerW: number;

  switch (tier) {
    case 'phone-portrait':
      localW = clamp(40, vw * 0.10, 56);
      oppW = clamp(28, vw * 0.07, 40);
      centerW = clamp(36, vw * 0.09, 48);
      break;
    case 'phone-landscape':
      localW = clamp(36, vw * 0.06, 50);
      oppW = clamp(24, vw * 0.04, 36);
      centerW = clamp(30, vw * 0.05, 42);
      break;
    case 'tablet':
      localW = clamp(56, vw * 0.07, 72);
      oppW = clamp(40, vw * 0.05, 56);
      centerW = clamp(44, vw * 0.06, 56);
      break;
    case 'desktop':
      localW = clamp(64, vw * 0.05, 84);
      oppW = clamp(48, vw * 0.04, 64);
      centerW = clamp(52, vw * 0.04, 68);
      break;
    case 'widescreen':
      localW = clamp(72, vw * 0.045, 90);
      oppW = clamp(52, vw * 0.035, 68);
      centerW = clamp(56, vw * 0.04, 72);
      break;
  }

  // Enforce minimum
  localW = Math.max(36, localW);

  return {
    localW,
    localH: localW * 1.4,  // 5:7 ratio
    oppW,
    oppH: oppW * 1.4,
    centerW,
    centerH: centerW * 1.4,
  };
}

function calcOpponentPositions(count: number): readonly OpponentPosition[] {
  if (count === 0) return [];

  // Distribute opponents across the top 180° of the oval (9 o'clock to 3 o'clock)
  // We map angles from π (9 o'clock / left) to 0 (3 o'clock / right)
  const positions: OpponentPosition[] = [];
  const startAngle = Math.PI;     // 9 o'clock
  const endAngle = 0;             // 3 o'clock

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angle = startAngle + t * (endAngle - startAngle);

    // Ellipse: x = 50 + rx*cos(angle), y = 50 - ry*sin(angle)
    // Using 38% rx (reduced from 42%) and 36% ry to keep rotated grids in bounds
    const rawX = 50 + 38 * Math.cos(angle);
    const rawY = 50 - 36 * Math.sin(angle);

    // Clamp x to keep rotated grids away from viewport edges
    // Minimum 12% from each side so rotated diagonal doesn't clip
    const x = clamp(12, rawX, 88);
    const y = clamp(6, rawY, 50);

    // Rotation: cards tilt inward toward center — reduced to 0.2 factor
    // Extreme angles (near 9 and 3 o'clock) get less rotation to avoid clipping
    const rotDeg = -(angle - Math.PI / 2) * (180 / Math.PI) * 0.2;

    positions.push({ x, y, angle: rotDeg });
  }

  return positions;
}

export function useTableLayout(opponentCount: number): TableLayout {
  const [layout, setLayout] = useState<TableLayout>(() => compute(opponentCount));
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function compute(oppCount: number): TableLayout {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tier = getTier(vw, vh);
    const cards = calcCardDimensions(vw, vh, tier);
    const opponentPositions = calcOpponentPositions(oppCount);

    return {
      tier,
      vw,
      vh,
      cards,
      opponentPositions,
      showOpponentCards: vw >= 360,
      showNames: tier !== 'phone-landscape',
      tableWidth: Math.min(vw, 1200),
      tableHeight: vh,
    };
  }

  const handleResize = useCallback(() => {
    // Debounce to 50ms
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setLayout(compute(opponentCount));
      });
    }, 50);
  }, [opponentCount]);

  useEffect(() => {
    setLayout(compute(opponentCount));

    const observer = new ResizeObserver(handleResize);
    observer.observe(document.documentElement);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', handleResize);
      if (timerRef.current) clearTimeout(timerRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, [opponentCount, handleResize]);

  return layout;
}

import { useState, useEffect, type ComponentType, type SVGProps } from 'react';
import type { ClientCard, Card as CardType } from '@kaboom/shared';
import {
  B2,
  Ca, C2, C3, C4, C5, C6, C7, C8, C9, C10, Cj, Cq, Ck,
  Da, D2, D3, D4, D5, D6, D7, D8, D9, D10, Dj, Dq, Dk,
  Ha, H2, H3, H4, H5, H6, H7, H8, H9, H10, Hj, Hq, Hk,
  Sa, S2, S3, S4, S5, S6, S7, S8, S9, S10, Sj, Sq, Sk,
  J1,
} from '@letele/playing-cards';

interface CardProps {
  readonly card: ClientCard | CardType | null;
  readonly onClick?: () => void;
  readonly selected?: boolean;
  readonly highlighted?: boolean;
  readonly matchTappable?: boolean; // subtle brightness during match window
  readonly peekTarget?: boolean;    // teal glow pulse for peek targeting
  readonly width?: number;
  readonly height?: number;
  readonly dealDelay?: number;
  readonly animateClass?: string;
}

type SvgCardComponent = ComponentType<SVGProps<SVGSVGElement>>;

const SUIT_PREFIX: Record<string, string> = {
  hearts: 'H', diamonds: 'D', clubs: 'C', spades: 'S',
};

const CARD_MAP: Record<string, SvgCardComponent> = {
  CA: Ca, C2, C3, C4, C5, C6, C7, C8, C9, C10, CJ: Cj, CQ: Cq, CK: Ck,
  DA: Da, D2, D3, D4, D5, D6, D7, D8, D9, D10, DJ: Dj, DQ: Dq, DK: Dk,
  HA: Ha, H2, H3, H4, H5, H6, H7, H8, H9, H10, HJ: Hj, HQ: Hq, HK: Hk,
  SA: Sa, S2, S3, S4, S5, S6, S7, S8, S9, S10, SJ: Sj, SQ: Sq, SK: Sk,
  J1,
};

function getCardComponent(card: CardType): SvgCardComponent {
  if (card.rank === 'Joker') return J1;
  const key = `${card.suit ? SUIT_PREFIX[card.suit] : ''}${card.rank}`;
  return CARD_MAP[key] ?? B2;
}

export default function Card({
  card, onClick, selected, highlighted, matchTappable, peekTarget,
  width = 70, height = 98,
  dealDelay, animateClass,
}: CardProps) {
  const [, setDealt] = useState(dealDelay === undefined);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    if (dealDelay !== undefined) {
      const timer = setTimeout(() => setDealt(true), 10);
      return () => clearTimeout(timer);
    }
  }, [dealDelay]);

  if (!card) {
    return (
      <div
        style={{ width, height }}
        className="rounded-lg border-2 border-dashed border-gray-700/50 flex items-center justify-center opacity-30 transition-all duration-200"
      >
        <span className="text-gray-600 text-xs">-</span>
      </div>
    );
  }

  const isFaceDown = 'faceDown' in card && card.faceDown;
  const dealClass = dealDelay !== undefined ? `animate-deal deal-delay-${dealDelay}` : '';
  const extraAnim = animateClass ?? '';

  const ringClass = selected
    ? 'ring-2 ring-kaboom-gold'
    : peekTarget
      ? 'ring-2 ring-teal-400/60 animate-pulse cursor-pointer'
      : highlighted
        ? 'ring-2 ring-yellow-400 animate-pulse'
        : '';

  // Interactive states
  const isInteractive = matchTappable || peekTarget;
  const matchClass = isInteractive ? 'cursor-pointer' : '';
  const pressScale = pressed && isInteractive ? 'scale-105' : '';

  const CardSvg = isFaceDown ? B2 : getCardComponent(card as CardType);

  // Ensure minimum 44px tap target
  const tapW = Math.max(44, width);
  const tapH = Math.max(44, height);
  const padX = (tapW - width) / 2;
  const padY = (tapH - height) / 2;

  return (
    <button
      onClick={onClick}
      onTouchStart={isInteractive ? () => setPressed(true) : undefined}
      onTouchEnd={isInteractive ? () => setPressed(false) : undefined}
      onMouseDown={isInteractive ? () => setPressed(true) : undefined}
      onMouseUp={isInteractive ? () => setPressed(false) : undefined}
      onMouseLeave={isInteractive ? () => setPressed(false) : undefined}
      style={{
        width: tapW,
        height: tapH,
        padding: `${padY}px ${padX}px`,
      }}
      className={`rounded-lg flex-shrink-0 transition-all duration-150 ${ringClass} ${dealClass} ${extraAnim} ${matchClass} ${pressScale}`}
    >
      <div className="w-full h-full rounded-lg shadow-lg overflow-hidden">
        <CardSvg className="w-full h-full" />
      </div>
    </button>
  );
}

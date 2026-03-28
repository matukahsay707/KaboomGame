import { type ComponentType, type SVGProps } from 'react';
import {
  B2,
  Ca, C2, C3, C4, C5, C6, C7, C8, C9, C10, Cj, Cq, Ck,
  Da, D2, D3, D4, D5, D6, D7, D8, D9, D10, Dj, Dq, Dk,
  Ha, H2, H3, H4, H5, H6, H7, H8, H9, H10, Hj, Hq, Hk,
  Sa, S2, S3, S4, S5, S6, S7, S8, S9, S10, Sj, Sq, Sk,
  J1,
} from '@letele/playing-cards';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

interface SVGCardProps {
  readonly rank?: Rank;
  readonly suit?: Suit;
  readonly joker?: 'red' | 'black';
  readonly faceDown?: boolean;
  readonly size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  readonly className?: string;
}

type SvgCardComponent = ComponentType<SVGProps<SVGSVGElement>>;

const SUIT_PREFIX: Record<Suit, string> = {
  hearts: 'H',
  diamonds: 'D',
  clubs: 'C',
  spades: 'S',
};

const CARD_MAP: Record<string, SvgCardComponent> = {
  CA: Ca, C2, C3, C4, C5, C6, C7, C8, C9, C10, CJ: Cj, CQ: Cq, CK: Ck,
  DA: Da, D2, D3, D4, D5, D6, D7, D8, D9, D10, DJ: Dj, DQ: Dq, DK: Dk,
  HA: Ha, H2, H3, H4, H5, H6, H7, H8, H9, H10, HJ: Hj, HQ: Hq, HK: Hk,
  SA: Sa, S2, S3, S4, S5, S6, S7, S8, S9, S10, SJ: Sj, SQ: Sq, SK: Sk,
};

// 5:7 ratio
const SIZE_CLASSES: Record<string, string> = {
  xs: 'w-[36px] h-[50px]',
  sm: 'w-[50px] h-[70px]',
  md: 'w-[70px] h-[98px]',
  lg: 'w-[100px] h-[140px]',
  xl: 'w-[130px] h-[182px]',
};

function getComponent(props: SVGCardProps): SvgCardComponent {
  if (props.faceDown) return B2;
  if (props.joker) return J1;
  if (props.rank && props.suit) {
    const key = `${SUIT_PREFIX[props.suit]}${props.rank}`;
    return CARD_MAP[key] ?? B2;
  }
  return B2;
}

export default function SVGCard({ rank, suit, joker, faceDown = false, size = 'md', className = '' }: SVGCardProps) {
  const CardSvg = getComponent({ rank, suit, joker, faceDown });

  return (
    <div className={`${SIZE_CLASSES[size]} rounded-md shadow-lg overflow-hidden flex-shrink-0 ${className}`}>
      <CardSvg className="w-full h-full" />
    </div>
  );
}

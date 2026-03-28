import SVGCard from './SVGCard.tsx';

interface HowToPlayPanelProps {
  readonly onBack: () => void;
}

export default function HowToPlayPanel({ onBack }: HowToPlayPanelProps) {
  return (
    <div className="animate-fade-in w-full max-w-2xl mx-auto px-4 pb-16">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 group"
      >
        <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h2 className="text-3xl font-black text-kaboom-gold mb-8">How to Play</h2>

      {/* Setup */}
      <Section title="Setup" icon="setup">
        <p className="text-gray-300 mb-3">
          Each player gets <strong className="text-white">4 cards</strong> arranged in a <strong className="text-white">2&times;2 grid</strong>, face down.
          At the start, you <strong className="text-kaboom-gold">peek at your bottom 2 cards</strong> &mdash; then play from memory.
        </p>
        <div className="flex items-center justify-center gap-2 my-4">
          <div className="grid grid-cols-2 gap-1.5">
            <SVGCard faceDown size="sm" />
            <SVGCard faceDown size="sm" />
            <SVGCard rank="5" suit="hearts" size="sm" className="ring-1 ring-kaboom-gold/50 rounded-md" />
            <SVGCard rank="8" suit="clubs" size="sm" className="ring-1 ring-kaboom-gold/50 rounded-md" />
          </div>
          <span className="text-gray-500 text-xs ml-3">Peek these two!</span>
        </div>
      </Section>

      {/* Card Values */}
      <Section title="Card Values" icon="values">
        <div className="space-y-3">
          <ValueRow
            cards={[{ rank: 'A', suit: 'spades' as const }]}
            label="Ace"
            value="1 point"
          />
          <ValueRow
            cards={[
              { rank: '2', suit: 'hearts' as const },
              { rank: '5', suit: 'clubs' as const },
              { rank: '9', suit: 'diamonds' as const },
            ]}
            label="2 &ndash; 10"
            value="Face value"
          />
          <ValueRow
            cards={[
              { rank: 'J', suit: 'spades' as const },
              { rank: 'Q', suit: 'hearts' as const },
            ]}
            label="Jack, Queen"
            value="10 points"
          />
          <ValueRow
            cards={[{ rank: 'K', suit: 'hearts' as const }]}
            label="Red King"
            value="25 points"
            valueColor="text-kaboom-accent"
          />
          <ValueRow
            cards={[{ rank: 'K', suit: 'spades' as const }]}
            label="Black King"
            value="0 points"
            valueColor="text-green-400"
          />
          <div className="flex items-center gap-3 py-2">
            <SVGCard joker="red" size="xs" />
            <div className="flex-1">
              <span className="text-white font-medium">Joker</span>
              <span className="text-kaboom-gold font-bold ml-3">&minus;1 point</span>
            </div>
          </div>
        </div>
      </Section>

      {/* Special Cards */}
      <Section title="Special Abilities" icon="special">
        <div className="space-y-4">
          <SpecialRow
            card={{ rank: '10' as const, suit: 'diamonds' as const }}
            name="10 &mdash; Peek"
            description="Look at any one card on the table (yours or an opponent's)."
          />
          <SpecialRow
            card={{ rank: 'J' as const, suit: 'clubs' as const }}
            name="Jack &mdash; Blind Trade"
            description="Swap one of your cards with an opponent's card, sight unseen."
          />
          <SpecialRow
            card={{ rank: 'Q' as const, suit: 'hearts' as const }}
            name="Queen &mdash; Peek & Trade"
            description="Peek at an opponent's card, then decide whether to swap it with one of yours."
          />
        </div>
        <p className="text-gray-400 text-sm mt-4 border-t border-gray-700/40 pt-3">
          Special cards dealt to you at the start of the game have no abilities &mdash; they only count as points. Abilities only activate when you draw the card from the deck or discard pile on your turn.
        </p>
      </Section>

      {/* Turn Order */}
      <Section title="Turn Order" icon="turn">
        <p className="text-gray-300">
          The first player is chosen randomly. Play proceeds clockwise. On your turn you must draw one card from the deck or take the top card from the discard pile, then either swap it with one of your grid cards or discard it.
        </p>
      </Section>

      {/* Matching */}
      <Section title="Matching" icon="match">
        <p className="text-gray-300 mb-2">
          When a card is discarded, any <em className="text-white not-italic">other</em> player can instantly match it
          by slapping one of their own cards that has the <strong className="text-white">same rank</strong>.
        </p>
        <ul className="space-y-2 text-gray-300 text-sm mt-3">
          <li className="flex items-start gap-2">
            <span className="text-kaboom-gold mt-0.5">&#x25B8;</span>
            <span><strong className="text-white">First come, first served</strong> &mdash; only the fastest player gets the match.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-kaboom-gold mt-0.5">&#x25B8;</span>
            <span>The <strong className="text-white">discarder cannot</strong> match their own card.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-kaboom-accent mt-0.5">&#x25B8;</span>
            <span><strong className="text-kaboom-accent">Wrong match?</strong> You draw a penalty card from the deck.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5">&#x25B8;</span>
            <span><strong className="text-green-400">Correct match?</strong> Both the discarded card and your matching card are removed!</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-kaboom-gold mt-0.5">&#x25B8;</span>
            <span>Matching is <strong className="text-white">time limited</strong> &mdash; you have a few seconds after a card is discarded to react. The match window closes automatically if nobody matches in time.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-kaboom-gold mt-0.5">&#x25B8;</span>
            <span>Penalty cards fill your next open grid slot. If all four slots are full, the penalty card becomes a <strong className="text-white">fifth card</strong>.</span>
          </li>
        </ul>
      </Section>

      {/* Kaboom */}
      <Section title="Calling Kaboom" icon="kaboom">
        <p className="text-gray-300 mb-2">
          When you think you have the <strong className="text-kaboom-gold">lowest total</strong>, call
          <strong className="text-kaboom-accent"> KABOOM!</strong> at the start of your turn.
        </p>
        <ul className="space-y-2 text-gray-300 text-sm mt-3">
          <li className="flex items-start gap-2">
            <span className="text-kaboom-gold mt-0.5">&#x25B8;</span>
            <span>Every other player gets <strong className="text-white">one more turn</strong> after the call.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-kaboom-gold mt-0.5">&#x25B8;</span>
            <span>All cards are revealed and scores tallied.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-kaboom-accent mt-0.5">&#x25B8;</span>
            <span>If <strong className="text-white">anyone ties or beats</strong> the caller&rsquo;s score, the <strong className="text-kaboom-accent">caller loses</strong>. The caller only wins by having strictly the lowest score at the table.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-kaboom-gold mt-0.5">&#x25B8;</span>
            <span>Kaboom must be called at the <strong className="text-white">very start of your turn</strong>, before drawing any card.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-kaboom-gold mt-0.5">&#x25B8;</span>
            <span>Once Kaboom is called, that player is <strong className="text-white">locked</strong> &mdash; no special card abilities can target them for the rest of the round. Nobody can peek at their cards or trade with them.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-kaboom-gold mt-0.5">&#x25B8;</span>
            <span>If you have zero cards from matching, you can still call Kaboom &mdash; your score is zero.</span>
          </li>
        </ul>
      </Section>

      {/* Running Out of Cards */}
      <Section title="Running Out of Cards" icon="reshuffle">
        <p className="text-gray-300">
          If the draw deck runs out, the discard pile is reshuffled into a new draw deck. The top card of the discard pile stays as the new discard.
        </p>
      </Section>

      {/* Win Condition */}
      <Section title="Winning" icon="win">
        <p className="text-gray-300 mb-2">
          The player with the <strong className="text-kaboom-gold">lowest total points</strong> wins.
          Master your memory, bluff your opponents, and time your Kaboom call perfectly.
        </p>
        <p className="text-gray-400 text-sm border-t border-gray-700/40 pt-3">
          If any player ties the Kaboom caller&rsquo;s score or beats it, the caller loses &mdash; even on a tie. The caller only wins by having strictly the lowest score at the table.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { readonly title: string; readonly icon: string; readonly children: React.ReactNode }) {
  return (
    <div className="mb-8 bg-kaboom-mid/50 border border-gray-700/50 rounded-2xl p-5 sm:p-6">
      <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
        <span className="w-1.5 h-6 bg-kaboom-gold rounded-full" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function ValueRow({
  cards,
  label,
  value,
  valueColor = 'text-kaboom-gold',
}: {
  readonly cards: ReadonlyArray<{ readonly rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'; readonly suit: 'hearts' | 'diamonds' | 'clubs' | 'spades' }>;
  readonly label: string;
  readonly value: string;
  readonly valueColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex gap-1">
        {cards.map((c, i) => (
          <SVGCard key={i} rank={c.rank} suit={c.suit} size="xs" />
        ))}
      </div>
      <div className="flex-1">
        <span className="text-white font-medium" dangerouslySetInnerHTML={{ __html: label }} />
        <span className={`${valueColor} font-bold ml-3`}>{value}</span>
      </div>
    </div>
  );
}

function SpecialRow({
  card,
  name,
  description,
}: {
  readonly card: { readonly rank: 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'; readonly suit: 'hearts' | 'diamonds' | 'clubs' | 'spades' };
  readonly name: string;
  readonly description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <SVGCard rank={card.rank} suit={card.suit} size="sm" className="flex-shrink-0" />
      <div>
        <h4 className="text-white font-bold text-sm" dangerouslySetInnerHTML={{ __html: name }} />
        <p className="text-gray-400 text-sm mt-0.5">{description}</p>
      </div>
    </div>
  );
}

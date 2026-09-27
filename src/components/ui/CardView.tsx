import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { sfx } from '../../lib/sound';
import { parseCard, type Card, type Suit } from '../../engine';
import { useSettings } from '../../state/settingsStore';
import { SuitIcon } from './SuitIcon';
import { CardBackFace } from './CardBack';
import { useCosmetics } from '../../state/useCosmetics';

export type CardSize = 'sm' | 'md' | 'lg';

const SIZE: Record<CardSize, { box: string; rank: string; corner: string; pip: string }> = {
  sm: { box: 'w-10 h-14 rounded-lg border-2', rank: 'text-lg', corner: 'h-3 w-3', pip: 'h-6 w-6' },
  md: { box: 'w-16 h-[5.5rem] rounded-xl border-[3px]', rank: 'text-2xl', corner: 'h-4 w-4', pip: 'h-9 w-9' },
  lg: { box: 'w-20 h-28 rounded-2xl border-[3px]', rank: 'text-4xl', corner: 'h-5 w-5', pip: 'h-12 w-12' },
};

export function suitColorClass(suit: Suit, fourColor: boolean): string {
  if (suit === 'h') return 'text-suit-heart';
  if (suit === 's') return 'text-suit-spade';
  if (suit === 'd') return fourColor ? 'text-suit-diamond' : 'text-suit-heart';
  return fourColor ? 'text-suit-club' : 'text-suit-spade';
}

export interface CardViewProps {
  /** A Card object or a code like "As". Omit (or set faceDown) to show the back. */
  card?: Card | string;
  faceDown?: boolean;
  size?: CardSize;
  /** Override the saved four-colour preference. */
  fourColor?: boolean;
  /** Animate a flip-in when mounted. */
  dealt?: boolean;
  className?: string;
}

export function CardView({ card, faceDown, size = 'md', fourColor, dealt, className = '' }: CardViewProps) {
  const savedFourColor = useSettings((s) => s.fourColorDeck);
  const { cardBack } = useCosmetics();
  useEffect(() => {
    if (dealt) sfx('deal');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const four = fourColor ?? savedFourColor;
  const s = SIZE[size];
  const c = typeof card === 'string' ? parseCard(card) : card;
  const showBack = faceDown || !c;

  return (
    <motion.div
      initial={dealt ? { rotateY: 90, y: -20, opacity: 0 } : false}
      animate={{ rotateY: 0, y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={[
        'relative shrink-0 overflow-hidden border-ink shadow-chunky-sm',
        s.box,
        showBack ? 'bg-ink' : 'bg-gradient-to-b from-white to-cream',
        className,
      ].join(' ')}
      aria-label={showBack ? 'face-down card' : `${c.rank}${c.suit}`}
      role="img"
    >
      {showBack ? (
        <CardBackFace back={cardBack} />
      ) : (
        <div className={`absolute inset-0 ${suitColorClass(c.suit, four)}`}>
          <div className="absolute left-1 top-0.5 flex flex-col items-center leading-none">
            <span className={`font-display ${s.rank}`}>{c.rank === 'T' ? '10' : c.rank}</span>
            <SuitIcon suit={c.suit} className={s.corner} />
          </div>
          <SuitIcon suit={c.suit} className={`absolute bottom-1.5 right-1.5 ${s.pip}`} />
          <div className="pointer-events-none absolute inset-x-1 top-0.5 h-1/4 rounded-full bg-white/40" />
        </div>
      )}
    </motion.div>
  );
}

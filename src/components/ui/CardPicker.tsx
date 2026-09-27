import { motion } from 'framer-motion';
import { useState } from 'react';
import { RANKS, SUITS, cardToString, parseCard, type Suit } from '../../engine';
import { useSettings } from '../../state/settingsStore';
import { suitColorClass } from './CardView';
import { SuitIcon } from './SuitIcon';

export interface CardPickerProps {
  /** Selected card codes, in pick order. */
  value: string[];
  onChange: (cards: string[]) => void;
  /** Maximum cards to pick. */
  max: number;
  /** Cards used elsewhere (shown disabled). */
  disabled?: string[];
  className?: string;
}

/**
 * Tap-to-pick cards with thumb-sized targets: choose a suit tab, then tap ranks (7 per row, every
 * button at least 44px). Tap a picked card again to remove it.
 */
export function CardPicker({ value, onChange, max, disabled = [], className = '' }: CardPickerProps) {
  const four = useSettings((s) => s.fourColorDeck);
  const [suit, setSuit] = useState<Suit>(() => (value.length ? parseCard(value[value.length - 1]!).suit : 's'));
  const toggle = (code: string) => {
    if (value.includes(code)) onChange(value.filter((c) => c !== code));
    else if (value.length < max) onChange([...value, code]);
    else if (max === 1) onChange([code]);
  };
  return (
    <div className={`space-y-1.5 rounded-xl border-[3px] border-ink bg-ink p-1.5 ${className}`}>
      <div className="grid grid-cols-4 gap-1.5" role="tablist" aria-label="Suit">
        {(SUITS as readonly Suit[]).map((s) => {
          const picked = value.filter((c) => c.endsWith(s)).length;
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={s === suit}
              aria-label={`${{ s: 'Spades', h: 'Hearts', d: 'Diamonds', c: 'Clubs' }[s]}${picked ? `, ${picked} picked` : ''}`}
              onClick={() => setSuit(s)}
              className={`relative grid h-11 place-items-center rounded-lg border-2 ${s === suit ? 'border-gold-300 bg-cream' : 'border-ink bg-white/80'} ${suitColorClass(s, four)}`}
            >
              <SuitIcon suit={s} className="h-6 w-6" />
              {picked > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink bg-gold-500 px-1 font-display text-[11px] text-ink">
                  {picked}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {[...RANKS].reverse().map((rank) => {
          const code = cardToString({ rank, suit });
          const on = value.includes(code);
          const off = !on && disabled.includes(code);
          return (
            <motion.button
              key={code}
              type="button"
              disabled={off}
              whileTap={{ scale: 0.85 }}
              onClick={() => toggle(code)}
              aria-label={code}
              aria-pressed={on}
              className={`flex h-12 min-w-11 flex-col items-center justify-center rounded-lg border-2 font-display text-lg leading-none ${
                on ? 'border-gold-300 bg-gold-500 text-ink' : off ? 'border-transparent bg-white/10 text-white/20' : `border-ink bg-white ${suitColorClass(suit, four)}`
              }`}
            >
              {rank === 'T' ? '10' : rank}
              <SuitIcon suit={suit} className="mt-0.5 h-3.5 w-3.5" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

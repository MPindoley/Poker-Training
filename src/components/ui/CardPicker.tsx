import { motion } from 'framer-motion';
import { RANKS, SUITS, cardToString, type Suit } from '../../engine';
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

/** Fast tap-to-pick card grid: 4 suit rows × 13 ranks. Tap again to remove. */
export function CardPicker({ value, onChange, max, disabled = [], className = '' }: CardPickerProps) {
  const four = useSettings((s) => s.fourColorDeck);
  const toggle = (code: string) => {
    if (value.includes(code)) onChange(value.filter((c) => c !== code));
    else if (value.length < max) onChange([...value, code]);
    else if (max === 1) onChange([code]);
  };
  return (
    <div className={`grid grid-rows-4 gap-1 rounded-xl border-[3px] border-ink bg-ink p-1 ${className}`}>
      {(SUITS as readonly Suit[]).map((suit) => (
        <div key={suit} className="grid grid-cols-13 gap-[3px]">
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
                className={`flex h-11 flex-col items-center justify-center rounded-md border-2 font-display text-[13px] leading-none ${
                  on ? 'border-gold-300 bg-gold-500 text-ink' : off ? 'border-transparent bg-white/10 text-white/20' : `border-ink bg-white ${suitColorClass(suit, four)}`
                }`}
              >
                {rank === 'T' ? '10' : rank}
                <SuitIcon suit={suit} className="mt-0.5 h-3 w-3" />
              </motion.button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

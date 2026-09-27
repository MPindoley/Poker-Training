import { motion } from 'framer-motion';
import { DEFAULT_DENOMS, breakdownChips } from '../../engine';

const CHIP_COLORS: Record<number, { base: string; stripe: string }> = {
  1: { base: '#f4f1ea', stripe: '#2f7fe8' },
  5: { base: '#e5383b', stripe: '#fff6e0' },
  25: { base: '#22b35e', stripe: '#fff6e0' },
  100: { base: '#2a2440', stripe: '#f5b820' },
  500: { base: '#8b4ae8', stripe: '#fff6e0' },
  1000: { base: '#f5b820', stripe: '#6b3a1e' },
};
const FALLBACK = { base: '#2f7fe8', stripe: '#fff6e0' };
const MAX_PER_COLUMN = 8;

function Chip({ denom, index }: { denom: number; index: number }) {
  const { base, stripe } = CHIP_COLORS[denom] ?? FALLBACK;
  return (
    <motion.div
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22, delay: index * 0.04 }}
      className="relative -mt-[0.6rem] h-4 w-9 rounded-[50%] border-2 border-ink first:mt-0"
      style={{
        background: `repeating-linear-gradient(90deg, ${base} 0 5px, ${stripe} 5px 8px)`,
        boxShadow: `inset 0 -3px 0 rgb(0 0 0 / 0.25)`,
      }}
    >
      <div className="absolute inset-x-1.5 top-0.5 h-1.5 rounded-[50%]" style={{ background: base }} />
    </motion.div>
  );
}

export interface ChipStackProps {
  amount: number;
  /** Shown after/before the number, e.g. "bb" or "$". */
  unit?: 'bb' | '$' | '';
  denoms?: readonly number[];
  showLabel?: boolean;
  className?: string;
}

export function formatAmount(amount: number, unit: ChipStackProps['unit'] = ''): string {
  const n = Number.isInteger(amount) ? amount.toLocaleString() : amount.toFixed(1);
  if (unit === '$') return `$${n}`;
  if (unit === 'bb') return `${n} bb`;
  return n;
}

/** Stacks of casino chips; the label is the exact amount, the chips are a greedy breakdown. */
export function ChipStack({ amount, unit = '', denoms = DEFAULT_DENOMS, showLabel = true, className = '' }: ChipStackProps) {
  const columns = breakdownChips(amount, denoms);
  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <div className="flex min-h-8 items-end gap-0.5">
        {columns.map(({ denom, count }) => (
          <div key={denom} className="flex flex-col-reverse items-center">
            {Array.from({ length: Math.min(count, MAX_PER_COLUMN) }, (_, i) => (
              <Chip key={i} denom={denom} index={i} />
            ))}
          </div>
        ))}
        {columns.length === 0 && <div className="h-4 w-9 rounded-[50%] border-2 border-dashed border-cream/40" />}
      </div>
      {showLabel && (
        <div className="rounded-full border-2 border-ink bg-ink/80 px-2.5 py-0.5 font-display text-sm text-gold-300">
          {formatAmount(amount, unit)}
        </div>
      )}
    </div>
  );
}

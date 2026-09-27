import { motion } from 'framer-motion';
import { haptic } from '../../lib/haptics';

/** Chunky on/off switch (44px tall tap target). */
export function Toggle({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (on: boolean) => void; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => {
        haptic('light');
        onChange(!on);
      }}
      className="flex min-h-11 w-full items-center justify-between gap-3 py-1 text-left"
    >
      <span>
        <span className="block font-display text-lg">{label}</span>
        {hint && <span className="block text-xs font-bold opacity-75">{hint}</span>}
      </span>
      <span className={`relative h-8 w-14 shrink-0 rounded-full border-[3px] border-ink transition-colors ${on ? 'bg-felt-300' : 'bg-ink/40'}`}>
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 30 }}
          className={`absolute top-0.5 h-5 w-5 rounded-full border-2 border-ink bg-cream ${on ? 'right-0.5' : 'left-0.5'}`}
        />
      </span>
    </button>
  );
}

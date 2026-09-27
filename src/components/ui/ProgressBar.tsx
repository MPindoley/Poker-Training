import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

export type BarColor = 'green' | 'gold' | 'blue' | 'red' | 'purple';

const FILL: Record<BarColor, string> = {
  green: 'from-felt-300 to-emerald-dark',
  gold: 'from-gold-300 to-gold-700',
  blue: 'from-[#6fb2ff] to-sapphire-dark',
  red: 'from-[#ff7a6e] to-ruby-dark',
  purple: 'from-[#b88bff] to-grape-dark',
};

export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  color?: BarColor;
  /** Text centred in the bar, e.g. "120 / 200 XP". */
  label?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

export function ProgressBar({ value, color = 'green', label, size = 'md', className = '' }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={`relative overflow-hidden rounded-full border-[3px] border-ink bg-ink/70 shadow-chunky-sm ${size === 'sm' ? 'h-4' : 'h-7'} ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <motion.div
        className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-b ${FILL[color]}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      >
        <div className="absolute inset-x-2 top-0.5 h-1/3 rounded-full bg-white/45" />
        <div className="absolute inset-0 animate-[shine_2.4s_linear_infinite] bg-[linear-gradient(110deg,transparent_30%,rgb(255_255_255/0.35)_50%,transparent_70%)] bg-[length:200%_100%]" />
      </motion.div>
      {label && size === 'md' && (
        <div className="text-outline-sm absolute inset-0 grid place-items-center font-display text-sm text-white">{label}</div>
      )}
    </div>
  );
}

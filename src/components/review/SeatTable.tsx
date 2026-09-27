import { motion } from 'framer-motion';

/** Seats clockwise around a 9-handed table, starting with the small blind. */
export const TABLE_SEATS = ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN'] as const;

export interface SeatInfo {
  label: string;
  hero?: boolean;
  folded?: boolean;
  /** Small badge (e.g. profile initials or stack). */
  badge?: string;
}

/** Small oval table: tap seats to add players. Every seat button is at least 48px. */
export function SeatTable({
  seats,
  onTap,
  active,
  caption,
}: {
  seats: Partial<Record<string, SeatInfo>>;
  onTap?: (seat: string) => void;
  /** Seat whose turn it is (pulses). */
  active?: string | null;
  caption?: string;
}) {
  return (
    <div className="relative mx-auto aspect-[1.35] w-full max-w-[360px]">
      <div className="wood-grain absolute inset-[10%] rounded-[50%] border-[3px] border-ink shadow-chunky" />
      <div className="felt-surface absolute inset-[15%] grid place-items-center rounded-[50%] border-[3px] border-ink">
        {caption && <span className="px-6 text-center font-display text-xs text-cream/85">{caption}</span>}
      </div>
      {TABLE_SEATS.map((seat, i) => {
        // Evenly around the ellipse, starting bottom-left (SB) and going clockwise.
        const angle = Math.PI / 2 + ((i + 0.5) / TABLE_SEATS.length) * 2 * Math.PI;
        const x = 50 + 44 * Math.cos(angle);
        const y = 50 + 42 * Math.sin(angle);
        const info = seats[seat];
        const isActive = active === seat;
        return (
          <motion.button
            key={seat}
            type="button"
            aria-label={`${seat}${info ? `: ${info.label}` : ' (empty)'}`}
            onClick={() => onTap?.(seat)}
            whileTap={{ scale: 0.9 }}
            animate={isActive ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={isActive ? { repeat: Infinity, duration: 1.1 } : undefined}
            className={`absolute flex h-12 min-w-12 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl border-[3px] px-1 leading-none ${
              info?.hero
                ? 'border-ink bg-gold-500 text-ink'
                : info
                  ? info.folded
                    ? 'border-ink bg-ink/60 text-cream/50'
                    : 'border-ink bg-sapphire text-white'
                  : 'border-dashed border-cream/50 bg-ink/30 text-cream/70'
            } ${isActive ? 'ring-4 ring-gold-300' : ''}`}
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <span className="font-display text-[11px]">{seat}</span>
            <span className="max-w-16 truncate text-[10px] font-bold">{info ? info.label : '+'}</span>
            {info?.badge && <span className="text-[9px] font-bold opacity-80">{info.badge}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}

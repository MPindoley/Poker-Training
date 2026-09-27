import { motion } from 'framer-motion';
import { useMemo } from 'react';

const CONFETTI_COLORS = ['#f5b820', '#e5383b', '#2f7fe8', '#22b35e', '#8b4ae8', '#fff6e0'];

interface Particle {
  id: number;
  x: number;
  y: number;
  rotate: number;
  color: string;
  coin: boolean;
  delay: number;
}

/** One-shot burst of confetti and gold coins from the centre of its parent. Remount (change key) to replay. */
export function Celebration({ count = 28, coins = true }: { count?: number; coins?: boolean }) {
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: count }, (_, id) => {
        const angle = (id / count) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 70 + Math.random() * 90;
        return {
          id,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 40,
          rotate: Math.random() * 720 - 360,
          color: CONFETTI_COLORS[id % CONFETTI_COLORS.length]!,
          coin: coins && id % 4 === 0,
          delay: Math.random() * 0.08,
        };
      }),
    [count, coins],
  );

  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20" aria-hidden>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={
            p.coin
              ? 'absolute -ml-2.5 -mt-2.5 h-5 w-5 rounded-full border-2 border-ink bg-gradient-to-b from-gold-300 to-gold-700'
              : 'absolute -ml-1 -mt-1.5 h-3 w-2 rounded-[2px]'
          }
          style={p.coin ? undefined : { background: p.color }}
          initial={{ x: 0, y: 0, scale: 0.3, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 120], scale: 1, opacity: [1, 1, 0], rotate: p.rotate }}
          transition={{
            default: { duration: 1.1, ease: 'easeOut', delay: p.delay },
            y: { duration: 1.1, ease: 'easeOut', delay: p.delay, times: [0, 0.45, 1] },
            opacity: { duration: 1.1, delay: p.delay, times: [0, 0.7, 1] },
          }}
        />
      ))}
    </div>
  );
}

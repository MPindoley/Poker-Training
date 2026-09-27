import { AnimatePresence, motion } from 'framer-motion';
import { bbText, type Point } from './layout';

/** A seat's bet for this street; slides into the pot (centre) when the street ends. */
export function BetChips({ id, amount, at, center }: { id: string; amount: number; at: Point; center: Point }) {
  return (
    <AnimatePresence>
      {amount > 0 && (
        <motion.div
          key={id}
          className="pointer-events-none absolute left-0 top-0 z-10"
          initial={{ x: at.x, y: at.y, scale: 0.4, opacity: 0 }}
          animate={{ x: at.x, y: at.y, scale: 1, opacity: 1 }}
          exit={{ x: center.x, y: center.y, scale: 0.6, opacity: 0, transition: { duration: 0.35, ease: 'easeIn' } }}
          transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        >
          <div className="-translate-x-1/2 -translate-y-1/2">
            <div className="flex items-center gap-1 rounded-full border-2 border-ink bg-ink/80 py-0.5 pl-0.5 pr-2">
              <span className="h-4 w-4 rounded-full border-2 border-ink bg-[repeating-conic-gradient(#e5383b_0_30deg,#fff6e0_30deg_60deg)]" />
              <span className="font-display text-xs text-gold-300">{bbText(amount)}</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Chips flying from the pot to a winner. */
export function PotPush({ id, from, to, amount }: { id: string; from: Point; to: Point; amount: number }) {
  return (
    <motion.div
      key={id}
      className="pointer-events-none absolute left-0 top-0 z-20"
      initial={{ x: from.x, y: from.y, scale: 1.2, opacity: 1 }}
      animate={{ x: to.x, y: to.y, scale: 0.9, opacity: [1, 1, 0] }}
      transition={{ duration: 0.9, ease: 'easeInOut', delay: 0.35, opacity: { times: [0, 0.8, 1], duration: 0.9, delay: 0.35 } }}
    >
      <div className="-translate-x-1/2 -translate-y-1/2">
        <div className="flex items-center gap-1 rounded-full border-2 border-ink bg-gold-500 py-0.5 pl-0.5 pr-2 shadow-chunky-sm">
          <span className="h-5 w-5 rounded-full border-2 border-ink bg-[repeating-conic-gradient(#f5b820_0_30deg,#fff6e0_30deg_60deg)]" />
          <span className="font-display text-sm text-ink">+{bbText(amount)}</span>
        </div>
      </div>
    </motion.div>
  );
}

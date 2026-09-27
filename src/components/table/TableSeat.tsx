import { AnimatePresence, motion } from 'framer-motion';
import { memo } from 'react';
import { indexToString, type ArchetypeId, type TableSeat as Seat } from '../../engine';
import { CardView } from '../ui';
import { ArchetypeBadge } from '../icons/ArchetypeBadge';
import { bbText, type Point } from './layout';

interface Props {
  seat: Seat;
  pos: Point;
  position: string | undefined;
  archetype?: ArchetypeId;
  showBadge: boolean;
  toAct: boolean;
  isButton: boolean;
  lastAction: string | null;
  showCards: boolean;
  winner: boolean;
}

function Avatar({ name, archetype, showBadge }: { name: string; archetype?: ArchetypeId; showBadge: boolean }) {
  if (archetype && showBadge) return <ArchetypeBadge id={archetype} className="h-11 w-11" />;
  return (
    <div className="grid h-11 w-11 place-items-center rounded-full border-[2.5px] border-ink bg-gradient-to-b from-cream to-cream-dark font-display text-lg text-ink shadow-chunky-sm">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export const TableSeatView = memo(function TableSeatView({ seat, pos, position, archetype, showBadge, toAct, isButton, lastAction, showCards, winner }: Props) {
  const out = seat.out;
  return (
    <div className="absolute w-[76px] -translate-x-1/2 -translate-y-1/2" style={{ left: pos.x, top: pos.y }}>
      <div className={`relative flex flex-col items-center transition-opacity duration-300 ${seat.folded || out ? 'opacity-45' : ''}`}>
        {!seat.hero && !out && !seat.folded && (
          <div className="absolute -top-5 flex -space-x-3">
            {seat.hole.map((c, i) =>
              showCards ? (
                <CardView key={c} card={indexToString(c)} size="sm" dealt className={i ? 'rotate-6' : '-rotate-6'} />
              ) : (
                <CardView key={i} faceDown size="sm" className={`!h-9 !w-6 ${i ? 'rotate-6' : '-rotate-6'}`} />
              ),
            )}
          </div>
        )}
        <motion.div
          animate={toAct ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={toAct ? { repeat: Infinity, duration: 1.1 } : { duration: 0.2 }}
          className={`relative rounded-full ${toAct ? 'ring-4 ring-gold-300' : ''} ${winner ? 'ring-4 ring-felt-300' : ''}`}
        >
          <Avatar name={seat.name} archetype={archetype} showBadge={showBadge} />
          {isButton && (
            <span className="absolute -right-2 -top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-ink bg-white font-display text-[10px] text-ink">
              D
            </span>
          )}
        </motion.div>
        <div className="mt-0.5 w-full rounded-lg border-2 border-ink bg-ink/85 px-1 py-0.5 text-center leading-tight">
          <div className="truncate text-[10px] font-bold text-cream/90">
            {seat.name}
            {position ? <span className="text-gold-300"> · {position}</span> : null}
          </div>
          <div className="font-display text-xs text-gold-300">{out ? 'out' : seat.allIn ? 'ALL-IN' : `${bbText(seat.stack)}bb`}</div>
        </div>
        <AnimatePresence>
          {lastAction && (
            <motion.div
              key={lastAction}
              initial={{ y: 6, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -bottom-5 whitespace-nowrap rounded-full border-2 border-ink bg-cream px-2 font-display text-[11px] text-ink"
            >
              {lastAction}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

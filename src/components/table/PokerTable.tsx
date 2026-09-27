import { useLayoutEffect, useRef, useState } from 'react';
import { indexToString, potSize, type ActionEvent, type BotProfile, type HandState } from '../../engine';
import { CardView } from '../ui';
import { BetChips, PotPush } from './BetChips';
import { TableSeatView } from './TableSeat';
import { bbText, betPoint, seatPoint } from './layout';
import { useCosmetics } from '../../state/useCosmetics';

function lastActionText(e: ActionEvent | undefined): string | null {
  if (!e) return null;
  switch (e.type) {
    case 'fold':
      return 'Fold';
    case 'check':
      return 'Check';
    case 'call':
      return e.allIn ? 'Call all-in' : 'Call';
    case 'bet':
      return e.allIn ? 'All-in' : `Bet ${bbText(e.to)}`;
    case 'raise':
      return e.allIn ? 'All-in' : `Raise ${bbText(e.to)}`;
    case 'post-sb':
      return 'SB';
    case 'post-straddle':
      return 'Straddle';
    case 'post-bb':
      return 'BB';
  }
}

export function PokerTable({
  hand,
  bots,
  positions,
  showBadges,
}: {
  hand: HandState;
  bots: Record<number, BotProfile | undefined>;
  positions: Record<number, string>;
  showBadges: boolean;
}) {
  const { theme, felt } = useCosmetics();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 358, h: 440 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const n = hand.seats.length;
  const center = { x: size.w / 2, y: size.h / 2 - 8 };
  const last = new Map<number, ActionEvent>();
  for (const e of hand.log) if (e.street === hand.street || hand.finished) last.set(e.seat, e);
  const shown = new Set(hand.result?.shown ?? []);
  const winners = new Set(Object.keys(hand.result?.collected ?? {}).map(Number));

  return (
    <div ref={ref} className="relative h-[min(460px,56dvh)] w-full select-none" data-theme={theme.id}>
      <div className="pointer-events-none absolute inset-0 rounded-[50%] opacity-40 blur-2xl" style={{ background: `radial-gradient(closest-side, ${theme.glow}, transparent)` }} />
      {/* Wood rail and felt */}
      <div className="wood-grain absolute inset-x-1 inset-y-6 rounded-[48%] border-[3px] border-ink shadow-chunky" style={{ backgroundImage: `repeating-linear-gradient(100deg, rgb(255 255 255 / 0.06) 0 2px, transparent 2px 9px, rgb(0 0 0 / 0.07) 9px 11px, transparent 11px 19px), linear-gradient(to bottom, ${theme.railLight}, ${theme.railDark})` }} />
      <div
        className="felt-surface absolute inset-x-4 inset-y-9 rounded-[48%] border-[3px] border-ink"
        style={{ backgroundColor: felt.dark, backgroundImage: `radial-gradient(ellipse at 50% 30%, ${felt.light}, ${felt.dark} 80%), radial-gradient(rgb(0 0 0 / 0.1) 1px, transparent 1px)`, backgroundSize: '100% 100%, 3px 3px', boxShadow: 'inset 0 6px 18px rgba(0,0,0,0.45)' }}
      />
      <div className="pointer-events-none absolute inset-x-10 inset-y-16 rounded-[48%] border-2 border-gold-300/25" />

      {/* Pot and board */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-[62%] flex-col items-center gap-1.5">
        <div className="rounded-full border-2 border-ink bg-ink/75 px-3 py-0.5 font-display text-sm text-gold-300">Pot {bbText(potSize(hand))}bb</div>
        <div className="flex gap-1">
          {hand.board.map((c) => (
            <CardView key={`${hand.handNo}-${c}`} card={indexToString(c)} size="sm" dealt />
          ))}
          {Array.from({ length: 5 - hand.board.length }, (_, i) => (
            <div key={i} className="h-14 w-10 rounded-lg border-2 border-dashed border-white/15" />
          ))}
        </div>
        {hand.finished && hand.result && hand.result.showdown && (
          <div className="max-w-56 text-center text-[11px] font-bold text-cream">
            {Object.keys(hand.result.collected)
              .map((w) => `${hand.seats[Number(w)]!.name}: ${hand.result!.handNames[Number(w)] ?? ''}`)
              .join(' · ')}
          </div>
        )}
      </div>

      {hand.seats.map((seat, i) => (
        <BetChips key={`${i}`} id={`${hand.handNo}-${hand.street}-${i}`} amount={hand.finished ? 0 : seat.bet} at={betPoint(i, n, size.w, size.h)} center={center} />
      ))}

      {hand.seats.map((seat, i) => (
        <TableSeatView
          key={i}
          seat={seat}
          pos={seatPoint(i, n, size.w, size.h)}
          position={positions[i]}
          archetype={bots[i]?.archetype}
          showBadge={showBadges}
          toAct={hand.toAct === i}
          isButton={hand.button === i}
          lastAction={lastActionText(last.get(i))}
          showCards={shown.has(i)}
          winner={hand.finished && winners.has(i)}
        />
      ))}

      {hand.finished &&
        Object.entries(hand.result?.collected ?? {}).map(([w, amt]) => (
          <PotPush key={`${hand.handNo}-${w}`} id={`${hand.handNo}-${w}`} from={center} to={seatPoint(Number(w), n, size.w, size.h)} amount={amt} />
        ))}
    </div>
  );
}

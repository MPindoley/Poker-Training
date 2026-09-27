import { useEffect, useState } from 'react';
import { legalActions, potSize, type HandState, type PlayerAction } from '../../engine';
import { GameButton } from '../ui';
import { bbText, dollars } from './layout';

const QUICK: { label: string; f: number | 'all' }[] = [
  { label: '1/3', f: 1 / 3 },
  { label: '1/2', f: 1 / 2 },
  { label: '2/3', f: 2 / 3 },
  { label: 'Pot', f: 1 },
  { label: 'All-in', f: 'all' },
];

export function ActionBar({ hand, onAct, bbDollars }: { hand: HandState; onAct: (a: PlayerAction) => void; bbDollars: number }) {
  const la = legalActions(hand);
  const [to, setTo] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (la) setTo(la.minTo);
    setOpen(false);
  }, [hand.log.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!la) return null;
  const pot = potSize(hand);
  const quickTo = (f: number | 'all') => {
    if (f === 'all') return la.maxTo;
    // Pot-sized raise: call first, then raise by f × the pot after calling.
    const target = hand.currentBet + f * (pot + la.toCall);
    return Math.max(la.minTo, Math.min(la.maxTo, Math.round(target * 2) / 2));
  };
  const verb = la.isBet ? 'Bet' : 'Raise to';
  const $ = (x: number) => (bbDollars > 0 ? ` · ${dollars(x, bbDollars)}` : '');

  return (
    <div className="space-y-2">
      {open && la.canRaise && (
        <div className="rounded-2xl border-[3px] border-ink bg-ink/85 p-2">
          <div className="mb-1 flex gap-1.5">
            {QUICK.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setTo(quickTo(q.f))}
                className="min-h-11 flex-1 rounded-xl border-2 border-ink bg-cream font-display text-sm text-ink active:scale-95"
              >
                {q.label}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={la.minTo}
            max={la.maxTo}
            step={0.5}
            value={to}
            onChange={(e) => setTo(Number(e.target.value))}
            className="h-11 w-full accent-[#f5b820]"
            aria-label="Bet size"
          />
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <GameButton color="red" size="md" className="!px-2" onClick={() => onAct({ type: 'fold' })} disabled={la.canCheck}>
          Fold
        </GameButton>
        <GameButton color="blue" size="md" className="!px-2" onClick={() => onAct({ type: la.canCheck ? 'check' : 'call' })}>
          {la.canCheck ? 'Check' : `Call ${bbText(la.call)}`}
        </GameButton>
        {la.canRaise ? (
          open ? (
            <GameButton color="gold" size="md" className="!px-1 text-base" onClick={() => onAct({ type: la.isBet ? 'bet' : 'raise', to })}>
              {to >= la.maxTo ? 'All-in' : `${verb.split(' ')[0]} ${bbText(to)}`}
            </GameButton>
          ) : (
            <GameButton color="gold" size="md" className="!px-2" onClick={() => setOpen(true)}>
              {la.isBet ? 'Bet' : 'Raise'}
            </GameButton>
          )
        ) : (
          <GameButton color="gold" size="md" disabled>
            Raise
          </GameButton>
        )}
      </div>
      {open && (
        <div className="text-center text-xs font-bold text-cream/80">
          {verb} {bbText(to)}bb{$(to)} · pot {bbText(pot)}bb
        </div>
      )}
    </div>
  );
}

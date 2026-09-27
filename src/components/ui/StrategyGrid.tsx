import { HAND_GRID, type StrategyVisual } from '../../engine';

const FOLD = '#3b3550';

function cellBackground(freq: Partial<Record<string, number>>, actions: StrategyVisual['actions']): string {
  let at = 0;
  const stops: string[] = [];
  for (const a of actions) {
    const f = Math.max(0, Math.min(1, freq[a.id] ?? 0));
    if (f <= 0) continue;
    const end = Math.min(100, at + f * 100);
    stops.push(`${a.color} ${at}% ${end}%`);
    at = end;
  }
  if (at < 100) stops.push(`${FOLD} ${at}% 100%`);
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/** Read-only 13x13 grid coloured by action frequency, with an optional highlighted hand. */
export function StrategyGrid({ visual, className = '' }: { visual: StrategyVisual; className?: string }) {
  return (
    <div className={className}>
      <div className="grid grid-cols-13 gap-[1.5px] rounded-lg border-2 border-ink bg-ink p-[1.5px]">
        {HAND_GRID.flat().map((h) => {
          const hl = visual.highlight === h.label;
          return (
            <div
              key={h.label}
              className={`relative grid aspect-square place-items-center rounded-[2px] font-display text-[8px] leading-none text-white ${
                hl ? 'z-10 scale-125 outline outline-2 outline-gold-300' : ''
              }`}
              style={{ background: cellBackground(visual.cells[h.label] ?? {}, visual.actions) }}
            >
              <span className="drop-shadow-[0_1px_0_rgba(0,0,0,0.8)]">{h.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold">
        {visual.actions.map((a) => (
          <span key={a.id} className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm border border-ink" style={{ background: a.color }} /> {a.label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-ink" style={{ background: FOLD }} /> Fold
        </span>
        {visual.caption && <span className="w-full text-[10px] font-semibold opacity-70">{visual.caption}</span>}
      </div>
    </div>
  );
}

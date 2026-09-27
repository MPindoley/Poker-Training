import { useRef, type PointerEvent } from 'react';
import { HAND_GRID, formatPercent, rangeStats, type HandKind } from '../../engine';

const BASE: Record<HandKind, string> = {
  pair: 'bg-[#4a3f6b] text-cream',
  suited: 'bg-[#2c5a74] text-cream',
  offsuit: 'bg-[#3b3550] text-cream/85',
};

export interface RangeGridProps {
  /** Hand-class labels in the range, e.g. new Set(["AA", "AKs"]). */
  selected: ReadonlySet<string>;
  /** Called with the new set when the user taps or drags. Omit for a read-only grid. */
  onChange?: (next: Set<string>) => void;
  /** Optional per-hand highlight class (e.g. colour by action). Overrides the selected style. */
  highlight?: (label: string) => string | undefined;
  showStats?: boolean;
  className?: string;
}

/** 13x13 starting-hand matrix. Tap to toggle, drag to paint. */
export function RangeGrid({ selected, onChange, highlight, showStats = true, className = '' }: RangeGridProps) {
  const paint = useRef<{ adding: boolean; next: Set<string>; touched: Set<string> } | null>(null);
  const stats = rangeStats(selected);

  const labelAt = (x: number, y: number) =>
    (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-hand]')?.dataset.hand;

  const apply = (label: string) => {
    const p = paint.current;
    if (!p || p.touched.has(label)) return;
    p.touched.add(label);
    if (p.adding) p.next.add(label);
    else p.next.delete(label);
    onChange?.(new Set(p.next));
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!onChange) return;
    const label = labelAt(e.clientX, e.clientY);
    if (!label) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    paint.current = { adding: !selected.has(label), next: new Set(selected), touched: new Set() };
    apply(label);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!paint.current) return;
    const label = labelAt(e.clientX, e.clientY);
    if (label) apply(label);
  };
  const end = () => {
    paint.current = null;
  };

  return (
    <div className={className}>
      <div
        className="grid touch-none grid-cols-13 gap-[2px] rounded-xl border-[3px] border-ink bg-ink p-[2px] shadow-chunky-sm"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        role="grid"
        aria-label="Starting hand range"
      >
        {HAND_GRID.flat().map((h) => {
          const custom = highlight?.(h.label);
          const on = selected.has(h.label);
          const style = custom ?? (on ? 'bg-gradient-to-b from-gold-300 to-gold-500 text-ink' : BASE[h.kind]);
          return (
            <div
              key={h.label}
              data-hand={h.label}
              role="gridcell"
              aria-selected={on}
              className={`grid aspect-square place-items-center rounded-[3px] font-display text-[9px] leading-none transition-colors duration-100 ${style}`}
            >
              {h.label}
            </div>
          );
        })}
      </div>
      {showStats && (
        <div className="mt-2 flex justify-between px-1 font-display text-sm">
          <span>{stats.hands} hands</span>
          <span>{stats.combos} combos</span>
          <span className="text-gold-300">{formatPercent(stats.fraction)} of hands</span>
        </div>
      )}
    </div>
  );
}

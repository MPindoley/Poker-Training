import { useRef, type PointerEvent } from 'react';
import { HAND_GRID } from '../../engine';

export interface WeightGridProps {
  /** Hand class -> weight (0..1). */
  weights: ReadonlyMap<string, number>;
  /** Weight to paint (0 erases). Omit for read-only. */
  brush?: number;
  onChange?: (next: Map<string, number>) => void;
  color?: string;
  className?: string;
}

/** 13x13 grid for weighted ranges: tap or drag to paint with the brush weight. */
export function WeightGrid({ weights, brush, onChange, color = '#f5b820', className = '' }: WeightGridProps) {
  const paint = useRef<{ next: Map<string, number>; value: number } | null>(null);
  const labelAt = (x: number, y: number) =>
    (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-hand]')?.dataset.hand;

  const apply = (label: string) => {
    const p = paint.current;
    if (!p || p.next.get(label) === p.value) return;
    if (p.value <= 0) p.next.delete(label);
    else p.next.set(label, p.value);
    onChange?.(new Map(p.next));
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (!onChange || brush === undefined) return;
    const label = labelAt(e.clientX, e.clientY);
    if (!label) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    // Tapping a hand that already has the brush weight erases it.
    const value = (weights.get(label) ?? 0) === brush ? 0 : brush;
    paint.current = { next: new Map(weights), value };
    apply(label);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!paint.current) return;
    const label = labelAt(e.clientX, e.clientY);
    if (label) apply(label);
  };
  const up = () => (paint.current = null);

  return (
    <div
      className={`grid touch-none grid-cols-13 gap-[2px] rounded-xl border-[3px] border-ink bg-ink p-[2px] ${className}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {HAND_GRID.flat().map((h) => {
        const w = weights.get(h.label) ?? 0;
        return (
          <div
            key={h.label}
            data-hand={h.label}
            className="relative grid aspect-square place-items-center overflow-hidden rounded-[3px] bg-[#3b3550] font-display text-[9px] leading-none text-cream"
          >
            {w > 0 && <div className="absolute inset-x-0 bottom-0" style={{ height: `${w * 100}%`, background: color }} />}
            <span className="relative drop-shadow-[0_1px_0_rgba(0,0,0,0.7)]">{h.label}</span>
          </div>
        );
      })}
    </div>
  );
}

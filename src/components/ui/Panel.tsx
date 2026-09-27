import type { ReactNode } from 'react';

export type PanelTone = 'cream' | 'wood' | 'felt' | 'night';

const TONES: Record<PanelTone, string> = {
  cream: 'bg-gradient-to-b from-cream to-cream-dark text-ink',
  wood: 'wood-grain text-cream',
  felt: 'felt-surface text-cream',
  night: 'bg-gradient-to-b from-[#3a2d5c] to-[#241a3d] text-cream',
};

export interface PanelProps {
  tone?: PanelTone;
  title?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** Rounded, outlined container with a soft top highlight and an optional ribbon title. */
export function Panel({ tone = 'cream', title, className = '', children }: PanelProps) {
  return (
    <section
      className={[
        'relative rounded-3xl border-[3px] border-ink shadow-chunky',
        title ? 'mt-5 pt-7' : 'pt-4',
        'px-4 pb-4',
        TONES[tone],
        className,
      ].join(' ')}
    >
      <div className="pointer-events-none absolute inset-x-3 top-1.5 h-3 rounded-full bg-white/25" />
      {title && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <div className="gloss rounded-xl border-[3px] border-ink bg-gradient-to-b from-gold-300 to-gold-700 px-5 py-1 font-display text-lg text-ink shadow-chunky-sm">
            {title}
          </div>
        </div>
      )}
      <div className="relative">{children}</div>
    </section>
  );
}

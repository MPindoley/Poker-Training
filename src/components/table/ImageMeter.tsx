import { useState } from 'react';
import { IMAGE_BLURBS, IMAGE_LABELS, IMAGE_NAMES, type ImageLabel } from '../../engine';

const TONE: Record<ImageLabel, string> = {
  'tight-feared': 'bg-sapphire text-white',
  solid: 'bg-felt-300 text-ink',
  loose: 'bg-gold-500 text-ink',
  wild: 'bg-ruby text-white',
  'card-dead': 'bg-cream text-ink',
};

/** How the table sees you. Tap for what it means. */
export function ImageMeter({ label }: { label: ImageLabel }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-cream">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 rounded-2xl border-2 border-ink bg-ink/50 px-2 text-left"
      >
        <span className="font-display text-xs text-cream/80">Your image</span>
        <span className="flex gap-0.5" aria-hidden>
          {IMAGE_LABELS.map((l) => (
            <span key={l} className={`h-3 w-3 rounded-full border-2 border-ink ${l === label ? TONE[l] : 'bg-ink/40'}`} />
          ))}
        </span>
        <span className={`ml-auto rounded-lg border-2 border-ink px-1.5 font-display text-sm ${TONE[label]}`}>{IMAGE_NAMES[label]}</span>
      </button>
      {open && <p className="mt-1 rounded-xl bg-ink/50 px-2 py-1 text-xs font-semibold">{IMAGE_BLURBS[label]}</p>}
    </div>
  );
}

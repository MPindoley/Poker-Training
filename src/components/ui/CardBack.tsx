import type { CardBackCosmetic } from '../../engine';

/** CSS background for a card-back pattern (original geometric designs). */
export function cardBackStyle(b: CardBackCosmetic): React.CSSProperties {
  const a = b.accent;
  switch (b.pattern) {
    case 'lattice':
      return {
        backgroundColor: b.base,
        backgroundImage: `repeating-linear-gradient(45deg, transparent 0 6px, ${a}40 6px 8px), repeating-linear-gradient(-45deg, transparent 0 6px, ${a}40 6px 8px)`,
      };
    case 'stripes':
      return { backgroundColor: b.base, backgroundImage: `repeating-linear-gradient(90deg, transparent 0 5px, ${a}55 5px 8px)` };
    case 'dots':
      return { backgroundColor: b.base, backgroundImage: `radial-gradient(${a}88 1.6px, transparent 2px)`, backgroundSize: '8px 8px' };
    case 'waves':
      return {
        backgroundColor: b.base,
        backgroundImage: `radial-gradient(circle at 50% 100%, transparent 5px, ${a}55 6px 7px, transparent 8px)`,
        backgroundSize: '14px 8px',
      };
    case 'sunburst':
      return { backgroundColor: b.base, backgroundImage: `repeating-conic-gradient(from 0deg at 50% 50%, ${a}50 0 10deg, transparent 10deg 20deg)` };
  }
}

/** Inner design of a face-down card. */
export function CardBackFace({ back }: { back: CardBackCosmetic }) {
  return (
    <div className="absolute inset-1 rounded-[0.4rem] border-2" style={{ ...cardBackStyle(back), borderColor: `${back.accent}cc` }}>
      <div
        className="absolute left-1/2 top-1/2 h-1/3 w-1/3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-sm border-2 border-ink"
        style={{ background: back.accent }}
      />
    </div>
  );
}

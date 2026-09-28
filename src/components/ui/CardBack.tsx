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
    case 'scales':
      // Overlapping half-circles, offset every other row, like dragon or fish scales.
      return {
        backgroundColor: b.base,
        backgroundImage: `radial-gradient(circle at 50% 0%, transparent 5px, ${a}66 5.5px 6.5px, transparent 7px), radial-gradient(circle at 50% 0%, transparent 5px, ${a}66 5.5px 6.5px, transparent 7px)`,
        backgroundSize: '12px 8px',
        backgroundPosition: '0 0, 6px 4px',
      };
    case 'stars':
      // Two layers of twinkling dots of different sizes.
      return {
        backgroundColor: b.base,
        backgroundImage: `radial-gradient(${a} 1px, transparent 1.6px), radial-gradient(${a}99 0.7px, transparent 1.2px), radial-gradient(circle at 50% 40%, ${a}22, transparent 70%)`,
        backgroundSize: '17px 13px, 9px 11px, 100% 100%',
        backgroundPosition: '2px 3px, 6px 0, 0 0',
      };
    case 'diamonds':
      return {
        backgroundColor: b.base,
        backgroundImage: `linear-gradient(45deg, ${a}40 25%, transparent 25% 75%, ${a}40 75%), linear-gradient(-45deg, ${a}40 25%, transparent 25% 75%, ${a}40 75%)`,
        backgroundSize: '10px 10px',
      };
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

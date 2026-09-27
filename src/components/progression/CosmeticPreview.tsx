import { COSMETIC_BY_ID, type Cosmetic, type FeltCosmetic } from '../../engine';
import { CardBackFace } from '../ui/CardBack';

/** Small visual swatch of any cosmetic. */
export function CosmeticPreview({ item, className = 'h-16 w-16' }: { item: Cosmetic; className?: string }) {
  switch (item.slot) {
    case 'cardBack':
      return (
        <div className={`relative grid place-items-center ${className}`}>
          <div className="relative h-full w-[70%] overflow-hidden rounded-lg border-[3px] border-ink bg-ink shadow-chunky-sm">
            <CardBackFace back={item} />
          </div>
        </div>
      );
    case 'felt':
      return (
        <div
          className={`rounded-[40%] border-[3px] border-ink shadow-chunky-sm ${className}`}
          style={{ background: `radial-gradient(ellipse at 50% 30%, ${item.light}, ${item.dark} 85%)` }}
        />
      );
    case 'chips':
      return (
        <div className={`flex flex-wrap content-center items-center justify-center gap-0.5 ${className}`}>
          {item.colors.map((c, i) => (
            <span
              key={i}
              className="h-5 w-5 rounded-full border-2 border-ink"
              style={{ background: `repeating-conic-gradient(${c.base} 0 30deg, ${c.stripe} 30deg 60deg)` }}
            />
          ))}
        </div>
      );
    case 'theme': {
      const felt = COSMETIC_BY_ID.get(item.felt) as FeltCosmetic | undefined;
      return (
        <div
          className={`grid place-items-center rounded-[45%] border-[3px] border-ink ${className}`}
          style={{ background: `linear-gradient(${item.railLight}, ${item.railDark})`, boxShadow: `0 0 16px ${item.glow}88, 0 3px 0 #1b1230` }}
        >
          <div
            className="h-[62%] w-[74%] rounded-[45%] border-2 border-ink"
            style={{ background: felt ? `radial-gradient(ellipse at 50% 30%, ${felt.light}, ${felt.dark} 85%)` : undefined }}
          />
        </div>
      );
    }
  }
}

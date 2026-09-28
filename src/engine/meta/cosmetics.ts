/**
 * Cosmetic rewards (card backs, felt colours, chip sets, table themes) and reward chests.
 * Chests only ever hold cosmetics: nothing here changes any number in a drill.
 */
import type { Rng } from '../rng';
import { ARENAS } from './arenas';

export type CosmeticSlot = 'cardBack' | 'felt' | 'chips' | 'theme';
export type Rarity = 'common' | 'rare' | 'epic' | 'mythic';

export const SLOT_NAMES: Record<CosmeticSlot, string> = { cardBack: 'Card backs', felt: 'Felt colours', chips: 'Chip sets', theme: 'Table themes' };
export const RARITY_NAMES: Record<Rarity, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', mythic: 'Mythic' };
/** Lowest to highest. */
export const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic', 'mythic'];

export type CardBackPattern = 'lattice' | 'stripes' | 'dots' | 'sunburst' | 'waves' | 'scales' | 'stars' | 'diamonds';

interface Base {
  id: string;
  name: string;
  rarity: Rarity;
  /** How you get it: owned from the start, found in chests, or unlocked by reaching an arena. */
  source: 'default' | 'chest' | 'arena';
}
export interface CardBackCosmetic extends Base {
  slot: 'cardBack';
  base: string;
  accent: string;
  pattern: CardBackPattern;
}
export interface FeltCosmetic extends Base {
  slot: 'felt';
  light: string;
  dark: string;
}
/** Colours for chips by denomination rank (smallest to largest). */
export interface ChipsCosmetic extends Base {
  slot: 'chips';
  colors: readonly { base: string; stripe: string }[];
}
export interface ThemeCosmetic extends Base {
  slot: 'theme';
  railLight: string;
  railDark: string;
  /** Felt used with this theme when the player hasn't picked one. */
  felt: string;
  /** Soft glow painted behind the table. */
  glow: string;
  arena?: string;
}
export type Cosmetic = CardBackCosmetic | FeltCosmetic | ChipsCosmetic | ThemeCosmetic;

const back = (id: string, name: string, rarity: Rarity, base: string, accent: string, pattern: CardBackPattern, source: Base['source'] = 'chest'): CardBackCosmetic => ({
  id: `back.${id}`,
  slot: 'cardBack',
  name,
  rarity,
  source,
  base,
  accent,
  pattern,
});
const felt = (id: string, name: string, rarity: Rarity, light: string, dark: string, source: Base['source'] = 'chest'): FeltCosmetic => ({
  id: `felt.${id}`,
  slot: 'felt',
  name,
  rarity,
  source,
  light,
  dark,
});
const chips = (id: string, name: string, rarity: Rarity, colors: [string, string][], source: Base['source'] = 'chest'): ChipsCosmetic => ({
  id: `chips.${id}`,
  slot: 'chips',
  name,
  rarity,
  source,
  colors: colors.map(([base, stripe]) => ({ base, stripe })),
});
const theme = (id: string, name: string, rarity: Rarity, railLight: string, railDark: string, feltId: string, glow: string, arena?: string): ThemeCosmetic => ({
  id: `theme.${id}`,
  slot: 'theme',
  name,
  rarity,
  source: arena ? 'arena' : 'chest',
  railLight,
  railDark,
  felt: `felt.${feltId}`,
  glow,
  arena,
});

export const COSMETICS: readonly Cosmetic[] = [
  back('classic', 'Classic Green', 'common', '#0f5f37', '#ffe27a', 'lattice', 'default'),
  back('ruby', 'Ruby Stripes', 'common', '#a8161f', '#fff6e0', 'stripes'),
  back('ocean', 'Ocean Dots', 'common', '#164fa6', '#9fd0ff', 'dots'),
  back('grape', 'Grape Waves', 'rare', '#5623a6', '#e3c8ff', 'waves'),
  back('sunburst', 'Golden Sunburst', 'rare', '#b87908', '#fff6e0', 'sunburst'),
  back('midnight', 'Midnight Lattice', 'epic', '#1b1230', '#f5b820', 'lattice'),
  back('ember', 'Ember Sunburst', 'epic', '#6b1a0f', '#ff9c5a', 'sunburst'),
  // Mythical treasures (original designs).
  back('sprite', 'Forest Sprite', 'common', '#2e6b3f', '#c8f5a0', 'dots'),
  back('griffin', 'Griffin Feather', 'rare', '#7a4d18', '#ffe3a8', 'waves'),
  back('starlit', 'Starlit Sky', 'rare', '#101a3d', '#fff6c0', 'stars'),
  back('kraken', 'Kraken Deep', 'epic', '#0b2a3a', '#3fd4c0', 'scales'),
  back('moonstone', 'Moonstone', 'epic', '#2c2f4a', '#cfd8ff', 'diamonds'),
  back('dragon', 'Dragon Scale', 'mythic', '#5a0f14', '#ffb13f', 'scales'),
  back('phoenix', 'Phoenix Plume', 'mythic', '#7a1d05', '#ffd24a', 'sunburst'),
  back('celestial', 'Celestial Crown', 'mythic', '#140a2e', '#f5d77a', 'stars'),

  felt('green', 'Classic Green', 'common', '#1e8a4f', '#0b3d26', 'default'),
  felt('blue', 'Tournament Blue', 'common', '#2c7fd0', '#0f2f5c'),
  felt('red', 'Crimson', 'common', '#c23a3a', '#4f0f14'),
  felt('teal', 'Lagoon Teal', 'rare', '#1ea39a', '#0a3d3a'),
  felt('purple', 'Royal Purple', 'rare', '#7b48d6', '#2a1257'),
  felt('charcoal', 'Charcoal', 'rare', '#4a4f5c', '#15171d'),
  felt('gold', 'Champagne', 'epic', '#caa24a', '#4d3710'),
  felt('glade', 'Mossy Glade', 'common', '#4f8f3a', '#1d3a14'),
  felt('frost', 'Frost Giant', 'rare', '#7fb8d8', '#1f4a63'),
  felt('dune', 'Sunset Dune', 'rare', '#d98545', '#5c2a12'),
  felt('enchanted', 'Enchanted Grove', 'epic', '#2fae7e', '#0a2e1f'),
  felt('hoard', "Dragon's Hoard", 'mythic', '#d4a017', '#5a2d00'),
  felt('starfall', 'Starfall', 'mythic', '#4a3a9a', '#0a0624'),

  chips('classic', 'Classic', 'common', [['#f4f1ea', '#2f7fe8'], ['#e5383b', '#fff6e0'], ['#22b35e', '#fff6e0'], ['#2a2440', '#f5b820'], ['#8b4ae8', '#fff6e0'], ['#f5b820', '#6b3a1e']], 'default'),
  chips('pastel', 'Pastel', 'common', [['#fdf3ff', '#b58cf0'], ['#ffb3c1', '#fff'], ['#b9f3c8', '#2e7a4a'], ['#a8d4ff', '#1d4f8a'], ['#ffe0a3', '#8a5a0f'], ['#e0c3ff', '#4a2380']]),
  chips('neon', 'Neon', 'rare', [['#1b1230', '#39ff9c'], ['#1b1230', '#ff3fa4'], ['#1b1230', '#3fd4ff'], ['#1b1230', '#fff13f'], ['#1b1230', '#b36bff'], ['#1b1230', '#ff8a3f']]),
  chips('royal', 'Royal', 'epic', [['#fff6e0', '#b87908'], ['#5623a6', '#f5b820'], ['#0f2f5c', '#f5b820'], ['#1b1230', '#f5b820'], ['#a8161f', '#f5b820'], ['#f5b820', '#1b1230']]),
  chips('seaglass', 'Sea Glass', 'rare', [['#e6fbf6', '#2e9e8f'], ['#9fe3d6', '#0b4f47'], ['#6fc3e8', '#fff'], ['#3f8fbf', '#e6fbf6'], ['#2a5f8f', '#9fe3d6'], ['#0b2a3a', '#3fd4c0']]),
  chips('dragonegg', 'Dragon Eggs', 'epic', [['#f4e3c8', '#8a5a1e'], ['#6b8f3a', '#f4e3c8'], ['#3a6b8f', '#ffd24a'], ['#8f3a3a', '#ffd24a'], ['#4a2a6b', '#ffb13f'], ['#1b1230', '#ff6b3f']]),
  chips('phoenix', 'Phoenix Embers', 'mythic', [['#fff1c8', '#ff6b1f'], ['#ffd24a', '#7a1d05'], ['#ff9c3f', '#fff1c8'], ['#e5383b', '#ffd24a'], ['#7a1d05', '#ffb13f'], ['#2a0a02', '#ffd24a']]),
  chips('frostcrystal', 'Frost Crystals', 'mythic', [['#f4fbff', '#6fb2ff'], ['#cfe8ff', '#1f4a63'], ['#9fd0ff', '#f4fbff'], ['#5a8fd8', '#e6f4ff'], ['#2c4f8f', '#cfe8ff'], ['#0f1f3d', '#9fd0ff']]),

  theme('kitchen', 'Kitchen Table', 'common', '#e0b27a', '#9a6a3a', 'green', '#ffd79a', 'kitchen'),
  theme('home', 'Home Game', 'common', '#d59256', '#6b3a1e', 'green', '#ffe27a', 'home'),
  theme('cardroom', 'Card Room', 'rare', '#8a5a3a', '#3d1f0f', 'blue', '#9fd0ff', 'cardroom'),
  theme('casino', 'Casino Floor', 'rare', '#b8212e', '#4f0f14', 'red', '#ffb36b', 'casino'),
  theme('highroller', 'High Roller Room', 'epic', '#2a2440', '#0d0a18', 'purple', '#e3c8ff', 'highroller'),
  theme('marble', 'Marble Lounge', 'rare', '#e8e4dc', '#8f8a80', 'charcoal', '#ffffff'),
  theme('neon', 'Neon Night', 'epic', '#3fd4ff', '#1b1230', 'purple', '#ff3fa4'),
  theme('wizard', "Wizard's Tower", 'epic', '#6a4a9a', '#1f1033', 'purple', '#b88bff'),
  theme('lair', "Dragon's Lair", 'mythic', '#8a2a0a', '#2a0a02', 'hoard', '#ffb13f'),
  theme('skypalace', 'Sky Palace', 'mythic', '#eef4ff', '#8aa8d8', 'starfall', '#fff6c0'),
];

export const COSMETIC_BY_ID: ReadonlyMap<string, Cosmetic> = new Map(COSMETICS.map((c) => [c.id, c]));

export type Loadout = Record<CosmeticSlot, string>;

export const DEFAULT_LOADOUT: Loadout = { cardBack: 'back.classic', felt: 'felt.green', chips: 'chips.classic', theme: 'theme.kitchen' };

/** Cosmetics everyone owns from the start (defaults plus the first arena's theme). */
export function starterCosmetics(): string[] {
  return COSMETICS.filter((c) => c.source === 'default' || (c.slot === 'theme' && c.arena === ARENAS[0]!.id)).map((c) => c.id);
}

/** Arena themes owned at a level. */
export function arenaCosmetics(level: number): string[] {
  return ARENAS.filter((a) => level >= a.minLevel).map((a) => a.themeId);
}

/** Chance of each rarity when a chest is opened (sums to 1). */
export const CHEST_ODDS: Record<Rarity, number> = { common: 0.55, rare: 0.3, epic: 0.12, mythic: 0.03 };

export interface ChestResult {
  rolled: Rarity;
  item: Cosmetic | null;
}

/**
 * Open a chest: roll a rarity with CHEST_ODDS, then pick an unowned chest cosmetic of that rarity.
 * If that rarity is complete, fall back to the nearest rarity (lower first) that isn't. A complete
 * collection gives nothing (chests never convert into anything that affects play).
 */
export function openChest(owned: ReadonlySet<string>, rng: Rng): ChestResult {
  const r = rng();
  let acc = 0;
  let rolled: Rarity = 'mythic';
  for (const rarity of RARITIES) {
    acc += CHEST_ODDS[rarity];
    if (r < acc) {
      rolled = rarity;
      break;
    }
  }
  // Fall back to the nearest rarity that still has something to find: lower first, then higher.
  const i = RARITIES.indexOf(rolled);
  const order = [rolled, ...RARITIES.slice(0, i).reverse(), ...RARITIES.slice(i + 1)];
  for (const rarity of order) {
    const pool = COSMETICS.filter((c) => c.source === 'chest' && c.rarity === rarity && !owned.has(c.id));
    if (pool.length) return { rolled, item: pool[Math.floor(rng() * pool.length)]! };
  }
  return { rolled, item: null };
}

export function chestCosmeticsLeft(owned: ReadonlySet<string>): number {
  return COSMETICS.filter((c) => c.source === 'chest' && !owned.has(c.id)).length;
}

/** What the player picked; a missing slot means "automatic". */
export type LoadoutChoice = Partial<Loadout>;

export interface ResolvedLoadout {
  cardBack: CardBackCosmetic;
  felt: FeltCosmetic;
  chips: ChipsCosmetic;
  theme: ThemeCosmetic;
}

/**
 * Resolve the equipped cosmetics. Automatic theme = the current arena's; automatic felt = the theme's
 * felt. Unknown or unowned ids fall back to the automatic choice.
 */
export function resolveLoadout(choice: LoadoutChoice, level: number, owned: ReadonlySet<string>): ResolvedLoadout {
  const pick = <T extends Cosmetic>(slot: CosmeticSlot, fallback: string): T => {
    const id = choice[slot];
    const c = id && owned.has(id) ? COSMETIC_BY_ID.get(id) : undefined;
    return (c && c.slot === slot ? c : COSMETIC_BY_ID.get(fallback)) as T;
  };
  const arenaTheme = ARENAS.filter((a) => level >= a.minLevel).pop()!.themeId;
  const theme = pick<ThemeCosmetic>('theme', arenaTheme);
  return {
    theme,
    felt: pick<FeltCosmetic>('felt', theme.felt),
    cardBack: pick<CardBackCosmetic>('cardBack', DEFAULT_LOADOUT.cardBack),
    chips: pick<ChipsCosmetic>('chips', DEFAULT_LOADOUT.chips),
  };
}

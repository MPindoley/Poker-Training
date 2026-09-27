/** Arenas: the venue you "play in" grows with your level. Each has its own table theme. */

export interface Arena {
  id: string;
  name: string;
  minLevel: number;
  blurb: string;
  /** Table theme cosmetic unlocked by reaching this arena. */
  themeId: string;
}

export const ARENAS: readonly Arena[] = [
  { id: 'kitchen', name: 'Kitchen Table', minLevel: 1, blurb: 'Friends, snacks and a borrowed deck', themeId: 'theme.kitchen' },
  { id: 'home', name: 'Home Game', minLevel: 4, blurb: 'The weekly $20 game with the regulars', themeId: 'theme.home' },
  { id: 'cardroom', name: 'Card Room', minLevel: 8, blurb: 'Real dealers, real rake, real reads', themeId: 'theme.cardroom' },
  { id: 'casino', name: 'Casino Floor', minLevel: 13, blurb: 'Deep stacks under bright lights', themeId: 'theme.casino' },
  { id: 'highroller', name: 'High Roller Room', minLevel: 20, blurb: 'Velvet ropes and big decisions', themeId: 'theme.highroller' },
];

export function arenaForLevel(level: number): Arena {
  let current = ARENAS[0]!;
  for (const a of ARENAS) if (level >= a.minLevel) current = a;
  return current;
}

export function nextArena(level: number): Arena | null {
  return ARENAS.find((a) => a.minLevel > level) ?? null;
}

/** Arenas unlocked between two levels (for level-up celebrations). */
export function arenasUnlocked(fromLevel: number, toLevel: number): Arena[] {
  return ARENAS.filter((a) => a.minLevel > fromLevel && a.minLevel <= toLevel);
}

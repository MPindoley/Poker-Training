/** XP, levels and daily streaks. Pure functions; the store just persists the results. */

/** Total XP required to reach `level` (level 1 = 0 XP). Gently increasing curve. */
export function xpToReachLevel(level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return 50 * n * (n + 3);
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  /** 0..1 progress toward the next level. */
  progress: number;
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  while (xpToReachLevel(level + 1) <= xp) level++;
  const floor = xpToReachLevel(level);
  const span = xpToReachLevel(level + 1) - floor;
  const xpIntoLevel = xp - floor;
  return { level, xpIntoLevel, xpForNextLevel: span, progress: xpIntoLevel / span };
}

/** Local calendar date as YYYY-MM-DD. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = toKey.split('-').map(Number) as [number, number, number];
  const from = Date.UTC(fy, fm - 1, fd);
  const to = Date.UTC(ty, tm - 1, td);
  return Math.round((to - from) / 86_400_000);
}

/** New streak after practising on `today`, given the last practice day. */
export function nextStreak(lastDay: string | null, today: string, streak: number): number {
  if (lastDay === null) return 1;
  const gap = daysBetween(lastDay, today);
  if (gap <= 0) return Math.max(streak, 1);
  if (gap === 1) return streak + 1;
  return 1;
}

import { describe, expect, it } from 'vitest';
import { levelFromXp, nextStreak, xpToReachLevel } from './progression';

describe('levels', () => {
  it('starts at level 1 with 0 XP', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 200, progress: 0 });
  });

  it('levels up exactly at the threshold', () => {
    expect(levelFromXp(xpToReachLevel(2) - 1).level).toBe(1);
    expect(levelFromXp(xpToReachLevel(2)).level).toBe(2);
  });

  it('reports progress within a level', () => {
    const info = levelFromXp(350); // level 2 spans 200..500
    expect(info.level).toBe(2);
    expect(info.xpIntoLevel).toBe(150);
    expect(info.progress).toBeCloseTo(0.5);
  });
});

describe('streaks', () => {
  it('starts, continues, holds and resets', () => {
    expect(nextStreak(null, '2026-09-27', 0)).toBe(1);
    expect(nextStreak('2026-09-26', '2026-09-27', 4)).toBe(5);
    expect(nextStreak('2026-09-27', '2026-09-27', 4)).toBe(4);
    expect(nextStreak('2026-09-24', '2026-09-27', 4)).toBe(1);
  });

  it('crosses month boundaries', () => {
    expect(nextStreak('2026-09-30', '2026-10-01', 2)).toBe(3);
  });
});

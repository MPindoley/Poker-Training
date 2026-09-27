import { describe, expect, it } from 'vitest';
import six from '../../data/ranges/cash-6max-100bb.json';
import home from '../../data/ranges/home-40bb.json';
import { buildCharts, type ChartJson } from '../preflop/charts';
import { makePreflopDrills } from '../preflop/drills';
import { MATH_DRILLS } from '../drills/math';
import { THEME_NAMES } from '../postflop/scenario';
import { makeExploitDrills } from '../exploit/drills';
import { createRng } from '../rng';
import {
  ACHIEVEMENTS,
  ARENAS,
  CHEST_ODDS,
  COSMETICS,
  COSMETIC_BY_ID,
  DAILY_TASK_COUNT,
  DEFAULT_LOADOUT,
  PRIOR_ANSWERS,
  SKILL_AREAS,
  TRAINABLE_KINDS,
  VENUE_KINDS,
  WARMUP_SECONDS,
  answerXp,
  arenaForLevel,
  arenasUnlocked,
  dailyTasks,
  nextArena,
  openChest,
  paintCoverage,
  planLength,
  quickDrillPlan,
  roundBonusXp,
  segmentAt,
  skillRadar,
  smoothedAccuracy,
  starterCosmetics,
  taskProgress,
  unlockedAchievements,
  warmUpPlan,
  weakestAreas,
  type AchievementSnapshot,
} from './index';

const charts = buildCharts(Object.fromEntries([six, home].map((j) => [j.id, j as unknown as ChartJson])));

describe('xp', () => {
  it('weights answers by difficulty', () => {
    expect(answerXp('best', 'bronze')).toBe(20);
    expect(answerXp('best', 'silver')).toBe(30);
    expect(answerXp('acceptable', 'gold')).toBe(20);
    expect(answerXp('mistake', 'diamond')).toBe(6);
  });
  it('gives an accuracy bonus above 50%', () => {
    expect(roundBonusXp(10, 10, 'bronze').xp).toBe(50); // 5 × 10 × 1 × 1
    expect(roundBonusXp(5, 10, 'bronze').xp).toBe(0);
    expect(roundBonusXp(2, 10, 'gold').xp).toBe(0);
    expect(roundBonusXp(9, 10, 'gold').xp).toBe(80); // 5 × 10 × 2 × 0.8
    expect(roundBonusXp(0, 0, 'gold').xp).toBe(0);
    expect(roundBonusXp(9, 10, 'gold').working).toContain('= 80 XP');
  });
});

describe('skills', () => {
  it('maps every trainable kind to its area and titles match the real drills', () => {
    const titles = new Map<string, string>();
    for (const d of MATH_DRILLS) titles.set(d.kind, d.title);
    for (const d of makePreflopDrills({ chart: charts['cash-6max-100bb']!, skills: {} })) titles.set(d.kind, d.title);
    for (const d of makeExploitDrills({ chart: charts['cash-6max-100bb']! })) titles.set(d.kind, d.title);
    for (const [t, name] of Object.entries(THEME_NAMES)) titles.set(`postflop.${t}`, name);
    for (const k of TRAINABLE_KINDS) expect(titles.get(k.kind), k.kind).toBe(k.title);
  });
  it('shrinks accuracy toward 50%', () => {
    expect(smoothedAccuracy({ attempts: 0, correct: 0 })).toBe(0.5);
    expect(smoothedAccuracy({ attempts: 10, correct: 10 })).toBeCloseTo((10 + PRIOR_ANSWERS / 2) / (10 + PRIOR_ANSWERS));
    expect(smoothedAccuracy({ attempts: 1000, correct: 900 })).toBeCloseTo(0.9, 2);
  });
  it('aggregates kinds into areas', () => {
    const r = skillRadar({ 'math.outs': { attempts: 10, correct: 8 }, 'math.potodds': { attempts: 10, correct: 10 }, 'math.combos': { attempts: 4, correct: 1 }, 'preflop.paint': { attempts: 2, correct: 2 }, other: { attempts: 5, correct: 5 } });
    expect(r.math.attempts).toBe(20);
    expect(r.math.accuracy).toBe(0.9);
    expect(r.reading.attempts).toBe(4);
    expect(r.preflop.attempts).toBe(2);
    expect(r.postflop.accuracy).toBeNull();
    expect(weakestAreas(r)[0]).toBe('reading'); // 3/8 smoothed
  });
});

describe('arenas', () => {
  it('unlocks by level', () => {
    expect(arenaForLevel(1).name).toBe('Kitchen Table');
    expect(arenaForLevel(4).name).toBe('Home Game');
    expect(arenaForLevel(12).name).toBe('Card Room');
    expect(arenaForLevel(99).name).toBe('High Roller Room');
    expect(nextArena(99)).toBeNull();
    expect(nextArena(1)!.minLevel).toBe(4);
    expect(arenasUnlocked(3, 8).map((a) => a.id)).toEqual(['home', 'cardroom']);
  });
  it('every arena theme is a cosmetic', () => {
    for (const a of ARENAS) expect(COSMETIC_BY_ID.get(a.themeId)?.slot).toBe('theme');
  });
});

describe('cosmetics and chests', () => {
  it('has unique ids, a valid default loadout and odds summing to 1', () => {
    expect(new Set(COSMETICS.map((c) => c.id)).size).toBe(COSMETICS.length);
    for (const [slot, id] of Object.entries(DEFAULT_LOADOUT)) expect(COSMETIC_BY_ID.get(id)?.slot).toBe(slot);
    for (const id of Object.values(DEFAULT_LOADOUT)) expect(starterCosmetics()).toContain(id);
    expect(Object.values(CHEST_ODDS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it('never gives an owned or non-chest item and empties the collection exactly', () => {
    const owned = new Set(starterCosmetics());
    const rng = createRng(7);
    const chestItems = COSMETICS.filter((c) => c.source === 'chest').length;
    for (let i = 0; i < chestItems; i++) {
      const r = openChest(owned, rng);
      expect(r.item).not.toBeNull();
      expect(owned.has(r.item!.id)).toBe(false);
      expect(r.item!.source).toBe('chest');
      owned.add(r.item!.id);
    }
    expect(openChest(owned, rng).item).toBeNull();
  });
  it('rolls rarities close to the stated odds', () => {
    const rng = createRng(42);
    const n = 20000;
    const counts = { common: 0, rare: 0, epic: 0 };
    for (let i = 0; i < n; i++) counts[openChest(new Set(), rng).rolled]++;
    for (const k of ['common', 'rare', 'epic'] as const) expect(Math.abs(counts[k] / n - CHEST_ODDS[k])).toBeLessThan(0.015);
  });
});

describe('daily tasks', () => {
  const kinds = { 'math.potodds': { attempts: 40, correct: 38 }, 'preflop.flash': { attempts: 40, correct: 20 }, 'postflop.cbet': { attempts: 30, correct: 12 } };
  it('is deterministic per day and covers three distinct weak areas', () => {
    const radar = skillRadar(kinds);
    const a = dailyTasks('2026-09-27', radar, kinds);
    expect(a).toEqual(dailyTasks('2026-09-27', radar, kinds));
    expect(a).toHaveLength(DAILY_TASK_COUNT);
    expect(new Set(a.map((t) => t.area)).size).toBe(3);
    expect(a.map((t) => t.area)).not.toContain('math'); // strongest area
    expect(a[0]!.area).toBe('postflop'); // 12/30 is the weakest
  });
  it('picks the weakest kind inside an area', () => {
    const radar = skillRadar(kinds);
    const post = dailyTasks('2026-01-01', radar, kinds).find((t) => t.area === 'postflop')!;
    expect(post.kind).toBe('postflop.cbet'); // (12+2)/(30+4) ≈ 41% is below the 50% of unplayed kinds
  });
  it('tracks progress', () => {
    const t = dailyTasks('2026-09-27', skillRadar({}), {})[0]!;
    expect(taskProgress(t, {})).toBe(0);
    expect(taskProgress(t, { [t.kind]: t.target / 2 })).toBe(0.5);
    expect(taskProgress(t, { [t.kind]: 99 })).toBe(1);
  });
});

describe('sessions', () => {
  it('warm-up fills about ten minutes with every area, boosting the weakest', () => {
    for (const venue of ['home', 'casino'] as const) {
      const radar = skillRadar({ 'postflop.cbet': { attempts: 30, correct: 5 } });
      const plan = warmUpPlan(venue, radar);
      expect(Math.abs(plan.estimatedSeconds - WARMUP_SECONDS) / WARMUP_SECONDS).toBeLessThan(0.15);
      expect(plan.segments.map((s) => s.area).sort()).toEqual([...SKILL_AREAS].sort());
      expect(plan.segments.find((s) => s.area === 'postflop')!.label).toContain('weak spot');
      for (const s of plan.segments) for (const k of s.kinds) expect(TRAINABLE_KINDS.some((t) => t.kind === k)).toBe(true);
    }
  });
  it('venues differ (home uses the 40bb theme)', () => {
    expect(VENUE_KINDS.home.postflop).toContain('postflop.short');
    expect(VENUE_KINDS.casino.postflop).not.toContain('postflop.short');
  });
  it('quick drill is about two minutes on the weakest area', () => {
    const plan = quickDrillPlan(skillRadar({ 'preflop.flash': { attempts: 20, correct: 2 } }));
    expect(plan.segments[0]!.area).toBe('preflop');
    expect(plan.estimatedSeconds).toBeGreaterThanOrEqual(90);
    expect(plan.estimatedSeconds).toBeLessThanOrEqual(150);
  });
  it('segmentAt walks segments', () => {
    const plan = warmUpPlan('home', skillRadar({}));
    const n = planLength(plan);
    expect(segmentAt(plan, 0)).toBe(plan.segments[0]);
    expect(segmentAt(plan, plan.segments[0]!.count)).toBe(plan.segments[1]);
    expect(segmentAt(plan, n - 1)).toBe(plan.segments[plan.segments.length - 1]);
  });
});

describe('achievements', () => {
  const empty: AchievementSnapshot = {
    level: 1,
    bestDayStreak: 0,
    kinds: {},
    bestRuns: {},
    paintBest: {},
    paintSeats: { six: ['UTG', 'HJ', 'CO', 'BTN', 'SB'] },
    lessonsDone: 0,
    lessonsTotal: 38,
    perfectRounds: 0,
    diamondRounds: 0,
    tableHands: 0,
    loggedHands: 0,
    cosmeticsOwned: 0,
    dailyTasksDone: 0,
  };
  it('has unique ids and nothing unlocked at the start', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(unlockedAchievements(empty)).toEqual([]);
  });
  it('Pot Odds Pro needs a 50-answer run', () => {
    expect(unlockedAchievements({ ...empty, bestRuns: { 'math.potodds': 49 } })).not.toContain('pot-odds-pro');
    expect(unlockedAchievements({ ...empty, bestRuns: { 'math.potodds': 50 } })).toContain('pot-odds-pro');
  });
  it('Range Master needs 95% on every seat of one chart', () => {
    const almost = { six: { UTG: 1, HJ: 0.96, CO: 0.95, BTN: 0.97, SB: 0.9 } };
    expect(paintCoverage({ paintBest: almost, paintSeats: empty.paintSeats }, 0.95)).toBe(0.8);
    expect(unlockedAchievements({ ...empty, paintBest: almost })).not.toContain('range-master');
    expect(unlockedAchievements({ ...empty, paintBest: { six: { ...almost.six, SB: 0.95 } } })).toContain('range-master');
  });
  it('streak, level and lesson achievements', () => {
    const u = unlockedAchievements({ ...empty, bestDayStreak: 7, level: 10, lessonsDone: 38 });
    expect(u).toEqual(expect.arrayContaining(['streak-3', 'streak-7', 'level-10', 'scholar']));
    expect(u).not.toContain('streak-30');
  });
});

describe('resolveLoadout', () => {
  it('follows the arena automatically and ignores unowned picks', async () => {
    const { resolveLoadout } = await import('./cosmetics');
    const owned = new Set(starterCosmetics());
    expect(resolveLoadout({}, 1, owned).theme.id).toBe('theme.kitchen');
    expect(resolveLoadout({}, 13, owned).theme.id).toBe('theme.casino');
    expect(resolveLoadout({}, 13, owned).felt.id).toBe('felt.red');
    expect(resolveLoadout({ cardBack: 'back.ember' }, 1, owned).cardBack.id).toBe('back.classic');
    owned.add('back.ember');
    expect(resolveLoadout({ cardBack: 'back.ember' }, 1, owned).cardBack.id).toBe('back.ember');
  });
});

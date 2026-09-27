/**
 * Mixed training sessions built from existing drills: the 2-minute Quick Drill and the 10-minute
 * Pre-Game Warm-Up (tuned for a 40bb home game or a 100bb casino game).
 */
import type { Difficulty } from '../drills/types';
import { AREA_NAMES, weakestAreas, type AreaScore, type SkillArea } from './skills';

export type Venue = 'home' | 'casino';

export const VENUE_NAMES: Record<Venue, string> = { home: 'Home game (40bb)', casino: 'Casino (100bb)' };

/** Rough seconds a player spends per question (reading + answering + reading the why). */
export const SECONDS_PER_QUESTION: Record<SkillArea, number> = { math: 25, preflop: 12, postflop: 45, exploits: 45, reading: 40 };

export interface SessionSegment {
  area: SkillArea;
  label: string;
  kinds: readonly string[];
  count: number;
  difficulty: Difficulty;
}

export interface SessionPlan {
  id: string;
  title: string;
  subtitle: string;
  venue: Venue;
  segments: SessionSegment[];
  /** Estimated from SECONDS_PER_QUESTION. */
  estimatedSeconds: number;
}

/** Which drill kinds suit each venue. Home games: loose, multiway, 40bb. Casino: 100bb, tougher. */
export const VENUE_KINDS: Record<Venue, Record<SkillArea, readonly string[]>> = {
  home: {
    math: ['math.potodds', 'math.outs', 'math.rule24', 'math.callfold'],
    preflop: ['preflop.flash', 'preflop.defense'],
    postflop: ['postflop.short', 'postflop.value', 'postflop.facing'],
    exploits: ['exploit.efls', 'exploit.image'],
    reading: ['postflop.reading', 'math.combos'],
  },
  casino: {
    math: ['math.potodds', 'math.mdf', 'math.ev', 'math.bluff'],
    preflop: ['preflop.flash', 'preflop.defense', 'preflop.sizing', 'preflop.ladder'],
    postflop: ['postflop.cbet', 'postflop.facing', 'postflop.bluff', 'postflop.value'],
    exploits: ['exploit.efls', 'exploit.image'],
    reading: ['postflop.reading', 'math.combos'],
  },
};

/** Share of warm-up time per area before the weak-spot boost. */
export const WARMUP_SHARES: Record<Venue, Record<SkillArea, number>> = {
  home: { math: 0.3, preflop: 0.2, postflop: 0.25, exploits: 0.1, reading: 0.15 },
  casino: { math: 0.2, preflop: 0.25, postflop: 0.3, exploits: 0.1, reading: 0.15 },
};
export const WARMUP_SECONDS = 600;
/** Extra share of time given to the weakest area. */
export const WEAK_SPOT_BOOST = 0.1;

const WARMUP_ORDER: readonly SkillArea[] = ['math', 'preflop', 'postflop', 'reading', 'exploits'];

export function estimateSeconds(segments: readonly SessionSegment[]): number {
  return segments.reduce((s, g) => s + g.count * SECONDS_PER_QUESTION[g.area], 0);
}

/** 10-minute mixed session. Each area gets questions in proportion to its time share. */
export function warmUpPlan(venue: Venue, radar: Record<SkillArea, AreaScore>): SessionPlan {
  const weakest = weakestAreas(radar)[0]!;
  const shares = { ...WARMUP_SHARES[venue] };
  shares[weakest] += WEAK_SPOT_BOOST;
  const total = Object.values(shares).reduce((a, b) => a + b, 0);
  const segments = WARMUP_ORDER.map((area) => ({
    area,
    label: area === weakest ? `${AREA_NAMES[area]} (weak spot)` : AREA_NAMES[area],
    kinds: VENUE_KINDS[venue][area],
    count: Math.max(1, Math.round((WARMUP_SECONDS * shares[area]) / total / SECONDS_PER_QUESTION[area])),
    difficulty: (venue === 'casino' ? 'silver' : 'bronze') as Difficulty,
  }));
  return {
    id: `warmup-${venue}`,
    title: 'Pre-Game Warm-Up',
    subtitle: VENUE_NAMES[venue],
    venue,
    segments,
    estimatedSeconds: estimateSeconds(segments),
  };
}

export const QUICK_DRILL_SECONDS = 120;

/** About two minutes on the weakest area. */
export function quickDrillPlan(radar: Record<SkillArea, AreaScore>, venue: Venue = 'home'): SessionPlan {
  const area = weakestAreas(radar)[0]!;
  const count = Math.max(2, Math.round(QUICK_DRILL_SECONDS / SECONDS_PER_QUESTION[area]));
  const segments: SessionSegment[] = [{ area, label: AREA_NAMES[area], kinds: VENUE_KINDS[venue][area], count, difficulty: 'bronze' }];
  return { id: 'quick', title: 'Quick Drill', subtitle: `${AREA_NAMES[area]} · your weakest area`, venue, segments, estimatedSeconds: estimateSeconds(segments) };
}

export function planLength(plan: SessionPlan): number {
  return plan.segments.reduce((s, g) => s + g.count, 0);
}

/** Segment for the i-th question of a plan. */
export function segmentAt(plan: SessionPlan, index: number): SessionSegment {
  let i = index;
  for (const seg of plan.segments) {
    if (i < seg.count) return seg;
    i -= seg.count;
  }
  return plan.segments[plan.segments.length - 1]!;
}

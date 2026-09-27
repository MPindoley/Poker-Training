/** Daily Training: three tasks drawn from the player's three weakest skill areas. */
import { createRng, shuffle } from '../rng';
import { SKILL_AREAS, TRAINABLE_KINDS, smoothedAccuracy, weakestAreas, type AreaScore, type AttemptTally, type SkillArea } from './skills';

/** Answers needed to finish a daily task (about one round). */
export const DAILY_TASK_TARGET = 8;
export const DAILY_TASK_COUNT = 3;

export interface DailyTask {
  id: string;
  area: SkillArea;
  kind: string;
  title: string;
  target: number;
}

/** Stable seed from a YYYY-MM-DD day key. */
export function daySeed(day: string): number {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) h = Math.imul(h ^ day.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Pick today's tasks: the three weakest areas (ties shuffled by the day), and inside each area the
 * drill kind with the lowest smoothed accuracy (ties shuffled too). Same inputs, same day → same tasks.
 */
export function dailyTasks(day: string, radar: Record<SkillArea, AreaScore>, kinds: Readonly<Record<string, AttemptTally>>): DailyTask[] {
  const rng = createRng(daySeed(day));
  const order = weakestAreas(radar, shuffle([...SKILL_AREAS], rng));
  return order.slice(0, DAILY_TASK_COUNT).map((area) => {
    const options = shuffle(TRAINABLE_KINDS.filter((k) => k.area === area), rng);
    const tally = (kind: string) => kinds[kind] ?? { attempts: 0, correct: 0 };
    options.sort((a, b) => smoothedAccuracy(tally(a.kind)) - smoothedAccuracy(tally(b.kind)) || tally(a.kind).attempts - tally(b.kind).attempts);
    const pick = options[0]!;
    return { id: `${day}:${pick.kind}`, area, kind: pick.kind, title: pick.title, target: DAILY_TASK_TARGET };
  });
}

export function taskProgress(task: DailyTask, answeredToday: Readonly<Record<string, number>>): number {
  return Math.min(1, (answeredToday[task.kind] ?? 0) / task.target);
}

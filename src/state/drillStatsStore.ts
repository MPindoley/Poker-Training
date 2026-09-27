import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { emptySkill, recordAnswer, type Grade, type SkillRecord } from '../engine';
import { idbStateStorage } from '../storage/db';
import { useRewards } from './rewardsStore';

interface DrillStatsState {
  /** Per skill (e.g. "math.outs:flush"), used for spaced repetition. */
  skills: Record<string, SkillRecord>;
  /** Per drill kind (e.g. "math.outs"): accuracy and speed. */
  kinds: Record<string, SkillRecord>;
  /** Longest run of non-mistake answers per kind, across rounds. */
  bestStreaks: Record<string, number>;
  /** Current run of non-mistake answers per kind. */
  runs: Record<string, number>;
  /** Record an answer for a drill kind and one or more skill keys (the question's skill plus tags). */
  record: (kind: string, skill: string | string[], grade: Grade, ms: number) => void;
  reset: () => void;
}

export const useDrillStats = create<DrillStatsState>()(
  persist(
    (set, get) => ({
      skills: {},
      kinds: {},
      bestStreaks: {},
      runs: {},
      record: (kind, skill, grade, ms) => {
        const { skills, kinds } = get();
        const next = { ...skills };
        for (const k of Array.isArray(skill) ? skill : [skill]) next[k] = recordAnswer(next[k] ?? emptySkill(), grade, ms);
        const runs = get().runs ?? {};
        const run = grade === 'mistake' ? 0 : (runs[kind] ?? 0) + 1;
        const best = get().bestStreaks;
        set({
          skills: next,
          kinds: { ...kinds, [kind]: recordAnswer(kinds[kind] ?? emptySkill(), grade, ms) },
          runs: { ...runs, [kind]: run },
          bestStreaks: run > (best[kind] ?? 0) ? { ...best, [kind]: run } : best,
        });
        useRewards.getState().countAnswer(kind);
      },
      reset: () => set({ skills: {}, kinds: {}, bestStreaks: {}, runs: {} }),
    }),
    { name: 'drill-stats', storage: createJSONStorage(() => idbStateStorage) },
  ),
);

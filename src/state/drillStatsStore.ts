import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { emptySkill, recordAnswer, type Grade, type SkillRecord } from '../engine';
import { idbStateStorage } from '../storage/db';

interface DrillStatsState {
  /** Per skill (e.g. "math.outs:flush"), used for spaced repetition. */
  skills: Record<string, SkillRecord>;
  /** Per drill kind (e.g. "math.outs"): accuracy and speed. */
  kinds: Record<string, SkillRecord>;
  bestStreaks: Record<string, number>;
  /** Record an answer for a drill kind and one or more skill keys (the question's skill plus tags). */
  record: (kind: string, skill: string | string[], grade: Grade, ms: number) => void;
  recordStreak: (kind: string, streak: number) => void;
  reset: () => void;
}

export const useDrillStats = create<DrillStatsState>()(
  persist(
    (set, get) => ({
      skills: {},
      kinds: {},
      bestStreaks: {},
      record: (kind, skill, grade, ms) => {
        const { skills, kinds } = get();
        const next = { ...skills };
        for (const k of Array.isArray(skill) ? skill : [skill]) next[k] = recordAnswer(next[k] ?? emptySkill(), grade, ms);
        set({ skills: next, kinds: { ...kinds, [kind]: recordAnswer(kinds[kind] ?? emptySkill(), grade, ms) } });
      },
      recordStreak: (kind, streak) => {
        const best = get().bestStreaks;
        if (streak > (best[kind] ?? 0)) set({ bestStreaks: { ...best, [kind]: streak } });
      },
      reset: () => set({ skills: {}, kinds: {}, bestStreaks: {} }),
    }),
    { name: 'drill-stats', storage: createJSONStorage(() => idbStateStorage) },
  ),
);

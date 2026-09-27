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
  record: (kind: string, skill: string, grade: Grade, ms: number) => void;
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
        set({
          skills: { ...skills, [skill]: recordAnswer(skills[skill] ?? emptySkill(), grade, ms) },
          kinds: { ...kinds, [kind]: recordAnswer(kinds[kind] ?? emptySkill(), grade, ms) },
        });
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

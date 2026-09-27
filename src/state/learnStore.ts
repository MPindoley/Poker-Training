import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { idbStateStorage } from '../storage/db';

interface LessonRecord {
  bestScore: number;
  total: number;
  completedAt: string;
}

interface LearnState {
  lessons: Record<string, LessonRecord>;
  complete: (id: string, score: number, total: number) => void;
}

export const useLearn = create<LearnState>()(
  persist(
    (set, get) => ({
      lessons: {},
      complete: (id, score, total) => {
        const prev = get().lessons[id];
        set({ lessons: { ...get().lessons, [id]: { bestScore: Math.max(score, prev?.bestScore ?? 0), total, completedAt: new Date().toISOString() } } });
      },
    }),
    { name: 'learn', storage: createJSONStorage(() => idbStateStorage) },
  ),
);

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { idbStateStorage } from '../storage/db';
import { dayKey, nextStreak } from '../engine';

interface ProgressState {
  xp: number;
  streak: number;
  lastPracticeDay: string | null;
  addXp: (amount: number) => void;
  /** Call when the player completes any drill today. */
  recordPractice: () => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      xp: 0,
      streak: 0,
      lastPracticeDay: null,
      addXp: (amount) => set({ xp: get().xp + amount }),
      recordPractice: () => {
        const today = dayKey(new Date());
        const { lastPracticeDay, streak } = get();
        set({ streak: nextStreak(lastPracticeDay, today, streak), lastPracticeDay: today });
      },
    }),
    { name: 'progress', storage: createJSONStorage(() => idbStateStorage) },
  ),
);

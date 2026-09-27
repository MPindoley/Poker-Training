import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { idbStateStorage } from '../storage/db';
import { dayKey, levelFromXp, nextStreak } from '../engine';
import { useEvents } from './eventsStore';
import { useRewards } from './rewardsStore';

interface ProgressState {
  xp: number;
  streak: number;
  bestStreak: number;
  lastPracticeDay: string | null;
  /** Adds XP; a level-up grants a chest and queues a celebration. */
  addXp: (amount: number) => void;
  /** Call when the player completes any drill today. */
  recordPractice: () => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      xp: 0,
      streak: 0,
      bestStreak: 0,
      lastPracticeDay: null,
      addXp: (amount) => {
        const before = levelFromXp(get().xp).level;
        const xp = get().xp + amount;
        set({ xp });
        const after = levelFromXp(xp).level;
        if (after > before) {
          useRewards.getState().grantChests(after - before);
          useEvents.getState().push({ type: 'levelUp', from: before, to: after });
        }
      },
      recordPractice: () => {
        const today = dayKey(new Date());
        const { lastPracticeDay, streak, bestStreak } = get();
        const s = nextStreak(lastPracticeDay, today, streak);
        set({ streak: s, bestStreak: Math.max(bestStreak ?? 0, s), lastPracticeDay: today });
      },
    }),
    { name: 'progress', storage: createJSONStorage(() => idbStateStorage) },
  ),
);

/** Streak as shown today: it lapses if the last practice was before yesterday. */
export function liveStreak(streak: number, lastPracticeDay: string | null, now = new Date()): number {
  if (!lastPracticeDay) return 0;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  return lastPracticeDay === dayKey(now) || lastPracticeDay === dayKey(yesterday) ? streak : 0;
}

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  arenaCosmetics,
  createRng,
  dayKey,
  openChest,
  resolveLoadout,
  starterCosmetics,
  type ChestResult,
  type CosmeticSlot,
  type DailyTask,
  type Difficulty,
  type LoadoutChoice,
} from '../engine';
import { idbStateStorage } from '../storage/db';

interface DailyState {
  day: string;
  tasks: DailyTask[];
  /** Answers per drill kind today. */
  counts: Record<string, number>;
  /** Task ids already rewarded. */
  done: string[];
  /** All three finished and the chest was granted. */
  chestGiven: boolean;
}

interface RewardsState {
  owned: string[];
  loadout: LoadoutChoice;
  /** Unopened chests. */
  chests: number;
  achievements: Record<string, string>;
  daily: DailyState;
  dailyTasksDone: number;
  /** Best Paint-the-Range accuracy: paintBest[chartId][seat]. */
  paintBest: Record<string, Record<string, number>>;
  perfectRounds: number;
  diamondRounds: number;
  grantChests: (n: number) => void;
  /** Opens one chest if any are waiting. */
  openChest: () => ChestResult | null;
  equip: (slot: CosmeticSlot, id: string | undefined) => void;
  countAnswer: (kind: string) => void;
  /** Start a new day's task list if the day changed (or tasks are missing). */
  ensureDaily: (day: string, make: () => DailyTask[]) => void;
  markTaskDone: (id: string) => void;
  markDailyChest: () => void;
  unlockAchievement: (id: string) => void;
  recordPaint: (chartId: string, seat: string, accuracy: number) => void;
  recordRound: (correct: number, total: number, difficulty: Difficulty) => void;
}

const emptyDaily = (day: string): DailyState => ({ day, tasks: [], counts: {}, done: [], chestGiven: false });

export const useRewards = create<RewardsState>()(
  persist(
    (set, get) => ({
      owned: starterCosmetics(),
      loadout: {},
      chests: 0,
      achievements: {},
      daily: emptyDaily(dayKey(new Date())),
      dailyTasksDone: 0,
      paintBest: {},
      perfectRounds: 0,
      diamondRounds: 0,
      grantChests: (n) => set({ chests: get().chests + n }),
      openChest: () => {
        const { chests, owned } = get();
        if (chests <= 0) return null;
        const result = openChest(new Set(owned), createRng(Date.now()));
        set({ chests: chests - 1, owned: result.item ? [...owned, result.item.id] : owned });
        return result;
      },
      equip: (slot, id) => {
        const loadout = { ...get().loadout };
        if (id) loadout[slot] = id;
        else delete loadout[slot];
        set({ loadout });
      },
      countAnswer: (kind) => {
        const today = dayKey(new Date());
        const daily = get().daily.day === today ? get().daily : emptyDaily(today);
        set({ daily: { ...daily, counts: { ...daily.counts, [kind]: (daily.counts[kind] ?? 0) + 1 } } });
      },
      ensureDaily: (day, make) => {
        const d = get().daily;
        if (d.day === day && d.tasks.length) return;
        set({ daily: { ...(d.day === day ? d : emptyDaily(day)), tasks: make() } });
      },
      markTaskDone: (id) => {
        const d = get().daily;
        if (d.done.includes(id)) return;
        set({ daily: { ...d, done: [...d.done, id] }, dailyTasksDone: get().dailyTasksDone + 1 });
      },
      markDailyChest: () => set({ daily: { ...get().daily, chestGiven: true } }),
      unlockAchievement: (id) => {
        if (get().achievements[id]) return;
        set({ achievements: { ...get().achievements, [id]: new Date().toISOString() } });
      },
      recordPaint: (chartId, seat, accuracy) => {
        const prev = get().paintBest[chartId] ?? {};
        if ((prev[seat] ?? 0) >= accuracy) return;
        set({ paintBest: { ...get().paintBest, [chartId]: { ...prev, [seat]: accuracy } } });
      },
      recordRound: (correct, total, difficulty) => {
        if (total < 5) return;
        const acc = correct / total;
        set({
          perfectRounds: get().perfectRounds + (acc === 1 ? 1 : 0),
          diamondRounds: get().diamondRounds + (difficulty === 'diamond' && acc >= 0.8 ? 1 : 0),
        });
      },
    }),
    { name: 'rewards', storage: createJSONStorage(() => idbStateStorage) },
  ),
);

/** Owned cosmetics including arena themes unlocked by level. */
export function ownedSet(owned: readonly string[], level: number): Set<string> {
  return new Set([...owned, ...arenaCosmetics(level)]);
}

export { resolveLoadout };

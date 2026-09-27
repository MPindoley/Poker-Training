import { create } from 'zustand';

/** One-off celebrations queued for the global ProgressionHost (not persisted). */
export type ProgressEvent =
  | { type: 'levelUp'; from: number; to: number }
  | { type: 'achievement'; id: string }
  | { type: 'daily' };

interface EventsState {
  queue: ProgressEvent[];
  push: (e: ProgressEvent) => void;
  shift: () => void;
  /** Whether the chest-opening sheet is showing. */
  chestOpen: boolean;
  setChestOpen: (open: boolean) => void;
}

export const useEvents = create<EventsState>()((set, get) => ({
  queue: [],
  push: (e) => set({ queue: [...get().queue, e] }),
  shift: () => set({ queue: get().queue.slice(1) }),
  chestOpen: false,
  setChestOpen: (chestOpen) => set({ chestOpen }),
}));

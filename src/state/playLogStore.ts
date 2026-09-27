import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { HandReview, SessionSummary } from '../engine';
import { idbStateStorage } from '../storage/db';

export interface PlayedSession {
  id: string;
  date: string;
  stackBb: number;
  summary: SessionSummary;
  hands: HandReview[];
}

interface PlayLogState {
  sessions: PlayedSession[];
  addSession: (hands: HandReview[], summary: SessionSummary, stackBb: number) => void;
  clear: () => void;
}

/** Sessions played against bots, kept for the leak finder. */
export const usePlayLog = create<PlayLogState>()(
  persist(
    (set, get) => ({
      sessions: [],
      addSession: (hands, summary, stackBb) =>
        set({ sessions: [...get().sessions, { id: `s-${Date.now().toString(36)}`, date: new Date().toISOString(), stackBb, summary, hands }].slice(-50) }),
      clear: () => set({ sessions: [] }),
    }),
    { name: 'play-log', storage: createJSONStorage(() => idbStateStorage) },
  ),
);

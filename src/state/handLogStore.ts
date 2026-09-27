import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { DecisionReview, LoggedHand, RealSession } from '../engine';
import { idbStateStorage } from '../storage/db';

interface HandLogState {
  hands: LoggedHand[];
  sessions: RealSession[];
  /** Cached graded decisions per logged hand (for the leak finder). */
  analyses: Record<string, DecisionReview[]>;
  setAnalysis: (id: string, decisions: DecisionReview[]) => void;
  lastSetup: { heroSeat: string; stackBb: number; bigBlind: number; location: 'home' | 'casino' };
  addHand: (h: LoggedHand) => void;
  removeHand: (id: string) => void;
  saveSession: (s: RealSession) => void;
  removeSession: (id: string) => void;
  setLastSetup: (s: HandLogState['lastSetup']) => void;
}

/** Hands and sessions from real games. */
export const useHandLog = create<HandLogState>()(
  persist(
    (set, get) => ({
      hands: [],
      sessions: [],
      analyses: {},
      setAnalysis: (id, decisions) => set({ analyses: { ...get().analyses, [id]: decisions } }),
      lastSetup: { heroSeat: 'BTN', stackBb: 40, bigBlind: 0.5, location: 'home' },
      addHand: (h) => {
        const analyses = { ...get().analyses };
        delete analyses[h.id];
        set({ hands: [h, ...get().hands.filter((x) => x.id !== h.id)], analyses });
      },
      removeHand: (id) => {
        const analyses = { ...get().analyses };
        delete analyses[id];
        set({ hands: get().hands.filter((x) => x.id !== id), analyses });
      },
      saveSession: (s) => set({ sessions: [s, ...get().sessions.filter((x) => x.id !== s.id)] }),
      removeSession: (id) => set({ sessions: get().sessions.filter((x) => x.id !== id) }),
      setLastSetup: (lastSetup) => set({ lastSetup }),
    }),
    { name: 'hand-log', storage: createJSONStorage(() => idbStateStorage) },
  ),
);

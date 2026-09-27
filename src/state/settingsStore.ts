import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { idbStateStorage } from '../storage/db';
import type { Difficulty, PostflopFilters, Venue } from '../engine';

interface SettingsState {
  fourColorDeck: boolean;
  soundOn: boolean;
  setFourColorDeck: (on: boolean) => void;
  setSoundOn: (on: boolean) => void;
  hapticsOn: boolean;
  setHapticsOn: (on: boolean) => void;
  /** Default venue for the Pre-Game Warm-Up. */
  venue: Venue;
  setVenue: (v: Venue) => void;
  mathDifficulty: Difficulty;
  setMathDifficulty: (d: Difficulty) => void;
  preflopDifficulty: Difficulty;
  setPreflopDifficulty: (d: Difficulty) => void;
  postflopFilters: PostflopFilters;
  setPostflopFilters: (f: PostflopFilters) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      fourColorDeck: true,
      soundOn: true,
      setFourColorDeck: (fourColorDeck) => set({ fourColorDeck }),
      setSoundOn: (soundOn) => set({ soundOn }),
      hapticsOn: true,
      setHapticsOn: (hapticsOn) => set({ hapticsOn }),
      venue: 'home',
      setVenue: (venue) => set({ venue }),
      mathDifficulty: 'bronze',
      setMathDifficulty: (mathDifficulty) => set({ mathDifficulty }),
      preflopDifficulty: 'bronze',
      setPreflopDifficulty: (preflopDifficulty) => set({ preflopDifficulty }),
      postflopFilters: {},
      setPostflopFilters: (postflopFilters) => set({ postflopFilters }),
    }),
    { name: 'settings', storage: createJSONStorage(() => idbStateStorage) },
  ),
);

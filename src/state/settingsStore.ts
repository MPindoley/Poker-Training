import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { idbStateStorage } from '../storage/db';
import type { Difficulty } from '../engine';

interface SettingsState {
  fourColorDeck: boolean;
  soundOn: boolean;
  setFourColorDeck: (on: boolean) => void;
  setSoundOn: (on: boolean) => void;
  mathDifficulty: Difficulty;
  setMathDifficulty: (d: Difficulty) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      fourColorDeck: true,
      soundOn: true,
      setFourColorDeck: (fourColorDeck) => set({ fourColorDeck }),
      setSoundOn: (soundOn) => set({ soundOn }),
      mathDifficulty: 'bronze',
      setMathDifficulty: (mathDifficulty) => set({ mathDifficulty }),
    }),
    { name: 'settings', storage: createJSONStorage(() => idbStateStorage) },
  ),
);

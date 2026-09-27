import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { idbStateStorage } from '../storage/db';

interface SettingsState {
  fourColorDeck: boolean;
  soundOn: boolean;
  setFourColorDeck: (on: boolean) => void;
  setSoundOn: (on: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      fourColorDeck: true,
      soundOn: true,
      setFourColorDeck: (fourColorDeck) => set({ fourColorDeck }),
      setSoundOn: (soundOn) => set({ soundOn }),
    }),
    { name: 'settings', storage: createJSONStorage(() => idbStateStorage) },
  ),
);

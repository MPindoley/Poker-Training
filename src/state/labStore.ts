import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LabScenario } from '../engine';
import { idbStateStorage } from '../storage/db';

export interface SavedScenario {
  id: string;
  name: string;
  scenario: LabScenario;
  savedAt: number;
}

export interface LabGuess {
  at: number;
  guess: number;
  actual: number;
}

interface LabState {
  saved: SavedScenario[];
  /** Guess-mode history (newest last, last 200). */
  guesses: LabGuess[];
  save: (name: string, scenario: LabScenario) => void;
  remove: (id: string) => void;
  addGuess: (g: LabGuess) => void;
}

/** Range Lab: named scenarios and equity guesses, saved on the device. */
export const useLab = create<LabState>()(
  persist(
    (set, get) => ({
      saved: [],
      guesses: [],
      save: (name, scenario) => {
        const others = get().saved.filter((s) => s.name !== name);
        set({ saved: [{ id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, scenario: { ...scenario, name }, savedAt: Date.now() }, ...others].slice(0, 50) });
      },
      remove: (id) => set({ saved: get().saved.filter((s) => s.id !== id) }),
      addGuess: (g) => set({ guesses: [...get().guesses, g].slice(-200) }),
    }),
    { name: 'lab', storage: createJSONStorage(() => idbStateStorage) },
  ),
);

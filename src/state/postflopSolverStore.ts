import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { buildPostflopDb, type PostflopSolverDb, type PostflopSolverEntry } from '../engine';
import { idbStateStorage } from '../storage/db';

export interface PostflopImportRecord {
  name: string;
  date: string;
  entries: PostflopSolverEntry[];
}

interface PostflopSolverState {
  imports: PostflopImportRecord[];
  add: (name: string, entries: PostflopSolverEntry[]) => void;
  remove: (index: number) => void;
}

/** Imported postflop solver strategies (on-device). Later imports win for the same spot and hand. */
export const usePostflopSolver = create<PostflopSolverState>()(
  persist(
    (set, get) => ({
      imports: [],
      add: (name, entries) => set({ imports: [...get().imports, { name, date: new Date().toISOString(), entries }] }),
      remove: (index) => set({ imports: get().imports.filter((_, i) => i !== index) }),
    }),
    { name: 'postflop-solver', storage: createJSONStorage(() => idbStateStorage) },
  ),
);

/** Lookup table over every import (undefined when nothing is imported). */
export function usePostflopSolverDb(): PostflopSolverDb | undefined {
  const imports = usePostflopSolver((s) => s.imports);
  return useMemo(() => (imports.length ? buildPostflopDb(imports.flatMap((i) => i.entries)) : undefined), [imports]);
}

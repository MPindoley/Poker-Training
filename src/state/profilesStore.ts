import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { applyObservation, newProfile, type ArchetypeId, type PlayerStats, type Profile } from '../engine';
import { idbStateStorage } from '../storage/db';

interface ProfilesState {
  profiles: Profile[];
  add: (name: string, archetype: ArchetypeId) => Profile;
  update: (id: string, patch: Partial<Omit<Profile, 'id'>>) => void;
  remove: (id: string) => void;
  /** Drift a profile toward what you observed in a session (called from the Review tab). */
  observe: (id: string, observed: Partial<PlayerStats>, samples: number) => void;
}

export const useProfiles = create<ProfilesState>()(
  persist(
    (set, get) => ({
      profiles: [],
      add: (name, archetype) => {
        const p = newProfile(name, archetype, `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
        set({ profiles: [...get().profiles, p] });
        return p;
      },
      update: (id, patch) => set({ profiles: get().profiles.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)) }),
      remove: (id) => set({ profiles: get().profiles.filter((p) => p.id !== id) }),
      observe: (id, observed, samples) => set({ profiles: get().profiles.map((p) => (p.id === id ? applyObservation(p, observed, samples) : p)) }),
    }),
    { name: 'profiles', storage: createJSONStorage(() => idbStateStorage) },
  ),
);

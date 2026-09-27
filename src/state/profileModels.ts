import { REGULAR_MODEL, type VillainModel } from '../engine';

/** Villain models available for analysis. The Exploit Lab adds archetypes and custom profiles here. */
export function useProfileModels(): VillainModel[] {
  return [REGULAR_MODEL];
}

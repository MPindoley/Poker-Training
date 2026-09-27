import { useMemo } from 'react';
import { ARCHETYPES, REGULAR_MODEL, archetypeModel, profileModel, type ArchetypeId, type VillainModel } from '../engine';
import { useProfiles } from './profilesStore';

/** Every villain model available for analysis: the default, the archetypes and your custom profiles. */
export function useProfileModels(): VillainModel[] {
  const profiles = useProfiles((s) => s.profiles);
  return useMemo(
    () => [REGULAR_MODEL, ...(Object.keys(ARCHETYPES) as ArchetypeId[]).map(archetypeModel), ...profiles.map(profileModel)],
    [profiles],
  );
}

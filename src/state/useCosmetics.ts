import { useMemo } from 'react';
import { levelFromXp, resolveLoadout, type ResolvedLoadout } from '../engine';
import { useProgress } from './progressStore';
import { ownedSet, useRewards } from './rewardsStore';

/** The equipped card back, felt, chip set and table theme. */
export function useCosmetics(): ResolvedLoadout {
  const xp = useProgress((s) => s.xp);
  const owned = useRewards((s) => s.owned);
  const loadout = useRewards((s) => s.loadout);
  const level = levelFromXp(xp).level;
  return useMemo(() => resolveLoadout(loadout, level, ownedSet(owned, level)), [loadout, level, owned]);
}

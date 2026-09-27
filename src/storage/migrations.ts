/**
 * Versioned migrations for saved stores. Each persisted store records a version; when the shape
 * changes, the migration here upgrades old data, both when the app loads it (Zustand persist
 * `migrate`) and when a backup file is imported. Saved data is never dropped.
 */
import { HAND_LOG_VERSION, migrateLoggedHand, type LoggedHand, type LoggedHandV1 } from '../engine/review/handLog';

/** Current version of each store's saved shape (stores not listed are version 0). */
export const STORE_VERSIONS: Record<string, number> = {
  'hand-log': HAND_LOG_VERSION,
};

/** Hand-log store: v0/v1 hands (heroSeat + villainSeat) → v2 hands (players[]). */
export function migrateHandLogState(state: unknown, fromVersion: number): unknown {
  if (!state || typeof state !== 'object') return state;
  const s = state as { hands?: (LoggedHand | LoggedHandV1)[] };
  if (fromVersion < 2 && Array.isArray(s.hands)) return { ...s, hands: s.hands.map((h) => migrateLoggedHand(h)) };
  return state;
}

const MIGRATORS: Record<string, (state: unknown, fromVersion: number) => unknown> = {
  'hand-log': migrateHandLogState,
};

/** Upgrade one saved section `{ state, version }` (as stored, or as found in a backup) to the current version. */
export function migrateSection(key: string, section: { state: unknown; version?: number }): { state: unknown; version: number } {
  const target = STORE_VERSIONS[key] ?? section.version ?? 0;
  const from = section.version ?? 0;
  const migrate = MIGRATORS[key];
  if (!migrate || from >= target) return { state: section.state, version: section.version ?? target };
  return { state: migrate(section.state, from), version: target };
}

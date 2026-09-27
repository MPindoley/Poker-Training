/**
 * Export / import every piece of saved data as one JSON file, so nothing is ever lost.
 */
import { kvGet, kvSet } from './db';
import { migrateSection } from './migrations';

/** Every persisted store name (see the `name` option of each Zustand persist store). */
export const STORE_KEYS = ['progress', 'settings', 'drill-stats', 'charts', 'profiles', 'play-log', 'hand-log', 'learn', 'rewards', 'live', 'lab'] as const;

export interface Backup {
  app: 'felt-academy';
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

export async function exportAll(): Promise<Backup> {
  const data: Record<string, unknown> = {};
  for (const key of STORE_KEYS) {
    const raw = await kvGet<string>(key);
    if (raw) data[key] = JSON.parse(raw);
  }
  return { app: 'felt-academy', version: 1, exportedAt: new Date().toISOString(), data };
}

export function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class BackupError extends Error {}

/** Validate a parsed backup file. Throws BackupError with a readable reason. */
export function validateBackup(obj: unknown): Backup {
  if (!obj || typeof obj !== 'object') throw new BackupError('Not a JSON object');
  const b = obj as Partial<Backup>;
  if (b.app !== 'felt-academy') throw new BackupError('This file isn’t a Felt Academy backup');
  if (b.version !== 1) throw new BackupError(`Unsupported backup version: ${String(b.version)}`);
  if (!b.data || typeof b.data !== 'object') throw new BackupError('Backup has no data');
  for (const [k, v] of Object.entries(b.data)) {
    if (!(STORE_KEYS as readonly string[]).includes(k)) throw new BackupError(`Unknown section “${k}”`);
    if (!v || typeof v !== 'object' || !('state' in (v as object))) throw new BackupError(`Section “${k}” is damaged`);
  }
  return b as Backup;
}

/** Bring every section of a backup up to the current saved shapes (old backups keep working). */
export function migrateBackup(backup: Backup): Backup {
  const data = Object.fromEntries(Object.entries(backup.data).map(([k, v]) => [k, migrateSection(k, v as { state: unknown; version?: number })]));
  return { ...backup, data };
}

/** Replace saved data with the backup's (migrated to the current shapes). The app reloads afterwards. */
export async function importAll(backup: Backup): Promise<void> {
  for (const [k, v] of Object.entries(migrateBackup(backup).data)) await kvSet(k, JSON.stringify(v));
}

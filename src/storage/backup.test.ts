import { describe, expect, it } from 'vitest';
import { BackupError, exportAll, importAll, validateBackup } from './backup';
import { kvGet, kvSet } from './db';

describe('backup', () => {
  it('round-trips saved stores', async () => {
    await kvSet('progress', JSON.stringify({ state: { xp: 120 }, version: 0 }));
    const b = await exportAll();
    expect(b.data.progress).toEqual({ state: { xp: 120 }, version: 0 });
    await kvSet('progress', JSON.stringify({ state: { xp: 0 }, version: 0 }));
    await importAll(validateBackup(JSON.parse(JSON.stringify(b))));
    expect(JSON.parse((await kvGet<string>('progress'))!).state.xp).toBe(120);
  });
  it('rejects foreign or damaged files', () => {
    expect(() => validateBackup({ app: 'other' })).toThrow(BackupError);
    expect(() => validateBackup({ app: 'felt-academy', version: 1, data: { bogus: {} } })).toThrow(/Unknown section/);
    expect(() => validateBackup({ app: 'felt-academy', version: 1, data: { progress: 3 } })).toThrow(/damaged/);
    expect(() => validateBackup(null)).toThrow();
  });
});

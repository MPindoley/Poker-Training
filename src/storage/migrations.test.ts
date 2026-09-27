import { describe, expect, it } from 'vitest';
import { migrateBackup, validateBackup } from './backup';
import { migrateSection } from './migrations';

const OLD_STATE = {
  hands: [
    {
      id: 'h1',
      date: '2026-09-01',
      heroCards: ['Ah', 'Kd'],
      board: [],
      heroSeat: 'BTN',
      villainSeat: 'BB',
      stackBb: 40,
      bigBlind: 0.5,
      notes: '',
      actions: [{ street: 'preflop', actor: 'hero', type: 'raise', amount: 4 }],
    },
  ],
  sessions: [{ id: 's1' }],
  analyses: {},
  lastSetup: { heroSeat: 'BTN', stackBb: 40, bigBlind: 0.5, location: 'home' },
};

describe('store migrations', () => {
  it('hand-log v0 → v2 keeps every hand and field, converting to players[]', () => {
    const m = migrateSection('hand-log', { state: OLD_STATE, version: 0 });
    expect(m.version).toBe(2);
    const s = m.state as typeof OLD_STATE & { hands: { players: unknown[]; actions: { actor: string }[] }[] };
    expect(s.hands).toHaveLength(1);
    expect(s.hands[0]!.players).toEqual([
      { id: 'hero', seat: 'BTN', hero: true },
      { id: 'villain', seat: 'BB' },
    ]);
    expect(s.hands[0]!.actions[0]!.actor).toBe('hero');
    expect(s.sessions).toEqual([{ id: 's1' }]);
  });
  it('current-version and unknown stores pass through untouched', () => {
    const current = { state: { hands: [] }, version: 2 };
    expect(migrateSection('hand-log', current)).toEqual(current);
    expect(migrateSection('settings', { state: { a: 1 }, version: 0 })).toEqual({ state: { a: 1 }, version: 0 });
  });
  it('old backups import: both shapes validate and come out as v2', () => {
    for (const version of [0, 2]) {
      const state = version === 0 ? OLD_STATE : migrateSection('hand-log', { state: OLD_STATE, version: 0 }).state;
      const b = validateBackup({ app: 'felt-academy', version: 1, exportedAt: 'x', data: { 'hand-log': { state, version } } });
      const out = migrateBackup(b).data['hand-log'] as { version: number; state: { hands: { players: unknown[] }[] } };
      expect(out.version).toBe(2);
      expect(out.state.hands[0]!.players).toHaveLength(2);
    }
  });
});

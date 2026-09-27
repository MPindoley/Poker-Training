import { describe, expect, it } from 'vitest';
import { handleEquityJob } from './equityProtocol';
import { runEquity } from './equityClient';

describe('equity worker protocol', () => {
  it('returns results for a valid job', () => {
    const reply = handleEquityJob({ id: 7, players: ['AsAd', 'KK'], options: { board: 'Th9h4c' } });
    expect(reply.id).toBe(7);
    expect(reply.ok).toBe(true);
    if (reply.ok) expect(reply.result.method).toBe('exact');
  });

  it('returns errors as data instead of throwing', () => {
    const reply = handleEquityJob({ id: 8, players: ['AsAd'] });
    expect(reply).toEqual({ id: 8, ok: false, error: 'Equity needs 2 to 9 players' });
  });

  it('client falls back to inline computation without Worker support', async () => {
    const r = await runEquity(['AsAd', 'KsKd'], { board: 'Ah7c2d9s3h' });
    expect(r.players.map((p) => p.equity)).toEqual([1, 0]);
    await expect(runEquity(['AsAd', 'AsKd'])).rejects.toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import six from '../../data/ranges/cash-6max-100bb.json';
import nine from '../../data/ranges/cash-9max-100bb.json';
import home from '../../data/ranges/home-40bb.json';
import { createRng } from '../rng';
import { buildCharts, type ChartJson } from './charts';
import { makePreflopDrills } from './drills';

const charts = buildCharts(Object.fromEntries([six, nine, home].map((j) => [j.id, j as unknown as ChartJson])));

describe('home-game preflop drills', () => {
  for (const chart of Object.values(charts)) {
    it(`${chart.id}: every limper, squeeze and 4-bet variant builds a graded question with the math`, () => {
      const drills = makePreflopDrills({ chart, skills: {} }).filter((d) => ['preflop.limpers', 'preflop.squeeze', 'preflop.vs4bet'].includes(d.kind));
      expect(drills.map((d) => d.kind)).toEqual(['preflop.limpers', 'preflop.squeeze', 'preflop.vs4bet']);
      for (const d of drills) {
        for (const variant of d.variants.gold) {
          const q = d.generate(createRng(variant.length * 97), 'gold', variant, 'x');
          expect(q.kind).toBe(d.kind);
          expect(q.choices.filter((c) => c.grade === 'best')).toHaveLength(1);
          expect(q.choices.every((c) => c.feedback && c.feedback.length > 20)).toBe(true);
          expect(q.explanation.steps.some((s) => /equity needed|size|Squeeze size|Iso size/i.test(s))).toBe(true);
          expect(q.prompt).toMatch(/\?$/);
          expect(JSON.stringify(q)).not.toMatch(/NaN|undefined|Infinity/);
        }
      }
    });
  }
  it('BB vs limpers offers raise or check, SB offers complete', () => {
    const d = makePreflopDrills({ chart: charts['home-40bb']!, skills: {} }).find((x) => x.kind === 'preflop.limpers')!;
    const bb = d.generate(createRng(1), 'silver', 'lim:BB:2', 'b');
    expect(bb.choices.map((c) => c.label).sort()).toEqual(['Check', 'Raise to 6bb']);
    const sb = d.generate(createRng(2), 'silver', 'lim:SB:1', 's');
    expect(sb.choices.map((c) => c.label)).toContain('Complete');
  });
});

describe('home drill prices', () => {
  it('the overlimp price is call / (pot + call): 1bb into 2.5bb = 28.6%', () => {
    const d = makePreflopDrills({ chart: charts['home-40bb']!, skills: {} }).find((x) => x.kind === 'preflop.limpers')!;
    const q = d.generate(createRng(3), 'silver', 'lim:CO:1', 'p');
    expect(q.explanation.steps.join('\n')).toContain('1bb into 2.5bb = 28.6%');
  });
});

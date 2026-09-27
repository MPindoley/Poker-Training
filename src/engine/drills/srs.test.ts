import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { MAX_BOX, accuracy, averageMs, emptySkill, recordAnswer, skillWeight, weightedPick } from './srs';

describe('leitner boxes', () => {
  it('climbs on best, holds on acceptable, resets on mistake', () => {
    let r = emptySkill();
    r = recordAnswer(r, 'best', 1000);
    r = recordAnswer(r, 'best', 2000);
    expect(r.box).toBe(2);
    r = recordAnswer(r, 'acceptable', 1000);
    expect(r.box).toBe(2);
    r = recordAnswer(r, 'mistake', 3000);
    expect(r.box).toBe(0);
    expect(r.attempts).toBe(4);
    expect(accuracy(r)).toBe(3 / 4);
    expect(averageMs(r)).toBe(7000 / 4);
  });
  it('caps at MAX_BOX', () => {
    let r = emptySkill();
    for (let i = 0; i < 10; i++) r = recordAnswer(r, 'best', 1);
    expect(r.box).toBe(MAX_BOX);
  });
  it('missed skills weigh more than mastered ones', () => {
    const missed = recordAnswer(emptySkill(), 'mistake', 1);
    let mastered = emptySkill();
    for (let i = 0; i < 5; i++) mastered = recordAnswer(mastered, 'best', 1);
    expect(skillWeight(missed)).toBeGreaterThan(skillWeight(undefined));
    expect(skillWeight(undefined)).toBeGreaterThan(skillWeight(mastered));
    expect(skillWeight(mastered)).toBe(1);
  });
  it('weightedPick follows weights', () => {
    const rng = createRng(3);
    const counts = { a: 0, b: 0 };
    for (let i = 0; i < 10_000; i++) counts[weightedPick(['a', 'b'] as const, (x) => (x === 'a' ? 3 : 1), rng)]++;
    expect(counts.a / 10_000).toBeGreaterThan(0.72);
    expect(counts.a / 10_000).toBeLessThan(0.78);
    expect(accuracy(undefined)).toBeNull();
  });
});

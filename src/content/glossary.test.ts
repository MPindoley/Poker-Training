import { describe, expect, it } from 'vitest';
import { GLOSSARY } from './glossary';
import { dyn } from './learn/types';

describe('glossary', () => {
  it('has unique terms, and related links resolve', () => {
    const terms = new Set(GLOSSARY.map((g) => g.term));
    expect(terms.size).toBe(GLOSSARY.length);
    for (const g of GLOSSARY) for (const r of g.related ?? []) expect(terms.has(r)).toBe(true);
  });
  it('computed examples render', () => {
    for (const g of GLOSSARY) {
      if (g.example) expect(dyn(g.example)).not.toMatch(/NaN|undefined/);
      if (g.vs) expect(dyn(g.vs).startsWith('vs ')).toBe(true);
    }
  });
  it('look-alike terms are separated', () => {
    const vs = (t: string) => GLOSSARY.find((g) => g.term.startsWith(t))!.vs;
    for (const t of ['Overcard', 'Overpair', 'Backdoor', 'Runner-runner', 'Value bet', 'Thin value', 'Set', 'Trips']) expect(vs(t)).toBeTruthy();
  });
});

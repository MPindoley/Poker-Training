import { describe, expect, it } from 'vitest';
import six from '../../data/ranges/cash-6max-100bb.json';
import { buildCharts, type ChartJson } from '../preflop/charts';
import { generateSpot, type Theme } from '../postflop/scenario';
import { createRng } from '../rng';
import { analyzeSpot } from './analyze';
import { ALTERNATES, CLEAR_MARGIN_POT, marginConfidence, mistakeWeight, shiftModel } from './confidence';
import { REGULAR_MODEL, actionProbs, forStreet } from './villainModel';

const chart = buildCharts({ [six.id]: six as unknown as ChartJson })[six.id]!;

describe('marginConfidence (hand-built EVs)', () => {
  it('clear when the best wins by at least CLEAR_MARGIN_POT of the pot', () => {
    expect(marginConfidence([5, 5 - CLEAR_MARGIN_POT * 10, 0], 10)).toBe('clear');
    expect(marginConfidence([5, 4.95, 0], 10)).toBe('close');
    expect(marginConfidence([3], 10)).toBe('clear');
  });
  it('mistake weights: clear mistakes count fully, others half, non-mistakes zero', () => {
    expect(mistakeWeight('mistake', 'clear')).toBe(1);
    expect(mistakeWeight('mistake', 'close')).toBe(0.5);
    expect(mistakeWeight('mistake', 'model-dependent')).toBe(0.5);
    expect(mistakeWeight('best', 'clear')).toBe(0);
  });
});

describe('shiftModel', () => {
  it('looser = folds less, tighter = folds more, on every street', () => {
    for (const st of ['flop', 'turn', 'river'] as const) {
      const base = actionProbs(forStreet(REGULAR_MODEL, st), 'weak', 0.66).fold;
      expect(actionProbs(forStreet(shiftModel(REGULAR_MODEL, 1.25), st), 'weak', 0.66).fold).toBeLessThan(base);
      expect(actionProbs(forStreet(shiftModel(REGULAR_MODEL, 0.8), st), 'weak', 0.66).fold).toBeGreaterThan(base);
    }
  });
});

describe('analyzeSpot with confidence', () => {
  const spots = Array.from({ length: 24 }, (_, i) => {
    const themes: Theme[] = ['value', 'bluff', 'facing', 'river'];
    return generateSpot(createRng(100 + i), { theme: themes[i % themes.length]!, chart, model: REGULAR_MODEL });
  });
  const results = spots.map((s) => ({ s, a: analyzeSpot(s, { sizes: [0.33, 0.66, 1], seed: 3, confidence: true }) }));

  it('labels every spot, always as a model estimate', () => {
    for (const { a } of results) {
      expect(['clear', 'close', 'model-dependent']).toContain(a.confidence);
      expect(a.source).toBe('model');
      expect(a.confidenceNote).toBeTruthy();
    }
  });

  it('a model-dependent label really flips under an alternate (unless the c-bet rule disagreed)', () => {
    const md = results.filter((r) => r.a.confidence === 'model-dependent' && !r.a.plan);
    for (const { s, a } of md) {
      const flips = ALTERNATES.some((alt) => {
        const b = analyzeSpot({ ...s, model: shiftModel(s.model, alt.stickiness) }, { sizes: [0.33, 0.66, 1], seed: 3, realization: alt.realization });
        return b.best.label !== a.best.label;
      });
      expect(flips).toBe(true);
    }
  });

  it('clear spots have the margin, close spots do not', () => {
    for (const { s, a } of results) {
      const evs = a.options.map((o) => o.ev).sort((x, y) => y - x);
      const margin = evs.length > 1 ? evs[0]! - evs[1]! : Infinity;
      if (a.confidence === 'clear') expect(margin).toBeGreaterThanOrEqual(CLEAR_MARGIN_POT * s.pot - 1e-9);
      if (a.confidence === 'close') expect(margin).toBeLessThan(CLEAR_MARGIN_POT * s.pot);
    }
  });

  it('without the flag nothing is added', () => {
    expect(analyzeSpot(spots[0]!, { seed: 3 }).confidence).toBeUndefined();
  });
});

describe('XP by confidence', async () => {
  const { answerXp } = await import('../meta/xp');
  it('a mistake in a close or read-dependent spot earns more XP than a clear mistake, less than Acceptable', () => {
    const clear = answerXp('mistake', 'bronze', 'clear');
    const close = answerXp('mistake', 'bronze', 'close');
    expect(clear).toBe(answerXp('mistake', 'bronze'));
    expect(close).toBeGreaterThan(clear);
    expect(close).toBeLessThan(answerXp('acceptable', 'bronze'));
    expect(answerXp('best', 'bronze', 'close')).toBe(answerXp('best', 'bronze'));
  });
});

import { describe, expect, it } from 'vitest';
import six from '../../data/ranges/cash-6max-100bb.json';
import nine from '../../data/ranges/cash-9max-100bb.json';
import home from '../../data/ranges/home-40bb.json';
import { parseCardIndices } from '../cards';
import { buildQuestion } from '../drills/round';
import { buildCharts, type ChartJson } from '../preflop/charts';
import { parseRange } from '../range';
import { createRng } from '../rng';
import { analyzeSpot } from '../strategy/analyze';
import { cbetPlan, cbetHandRule, RULES } from '../strategy/rules';
import { REGULAR_MODEL, continueProb } from '../strategy/villainModel';
import { classifyHand } from './buckets';
import { makePostflopDrills, postflopVariants, THEMES } from './drills';
import { bettingRange, classifyRange, composition, continuingRange } from './narrow';
import { buildReplaySpot } from './replay';
import { generateSpot, POT_TYPE_NAMES, type PotType } from './scenario';

const library = Object.fromEntries([six, nine, home].map((j) => [j.id, j as unknown as ChartJson]));
const charts = buildCharts(library);
const c6 = charts['cash-6max-100bb']!;
const ch = charts['home-40bb']!;

const hand = (h: string, b: string) => {
  const [c1, c2] = parseCardIndices(h);
  return classifyHand(c1!, c2!, parseCardIndices(b));
};

describe('hand buckets', () => {
  it.each([
    ['7s7c', 'Kh7h2c', 'monster', 'Set'],
    ['Kd7d', 'Kh7h2c', 'monster', 'Two pair'],
    ['AsAd', 'Kh7h2c', 'strong', 'Overpair'],
    ['KsQd', 'Kh7h2c', 'strong', 'Top pair, good kicker'],
    ['Ks4d', 'Kh7h2c', 'medium', 'Top pair, weak kicker'],
    ['8s7d', 'Kh7h2c', 'medium', 'Second pair'],
    ['3s2d', 'Kh7h2c', 'weak', 'Bottom pair'],
    ['AhQh', 'Kh7h2c', 'draw', 'Flush draw'],
    ['9s8s', 'Th7d2c', 'draw', 'Open-ended straight draw'],
    ['9h8h', 'Th7h2c', 'draw', 'Flush + straight draw'],
    ['QsJd', 'Kh7h2c', 'air', 'No pair'],
    ['AsJd', 'Kh7h2c', 'weak', 'Ace high'],
    ['6s5s', 'Kh7h8c9d4s', 'monster', 'Straight'],
  ])('%s on %s is %s', (h, b, bucket, description) => {
    const info = hand(h, b);
    expect(info.bucket).toBe(bucket);
    expect(info.description).toBe(description);
  });

  it('flags strong draws and made hands with draws', () => {
    expect(hand('9h8h', 'Th7h2c').strongDraw).toBe(true);
    expect(hand('AhKh', 'Kc7h2h').description).toBe('Top pair, good kicker + flush draw');
    expect(hand('AhKh', 'Kc7h2h').strongDraw).toBe(true);
  });

  it('no draws on the river', () => {
    expect(hand('AhQh', 'Kh7h2c3s4d').flushDraw).toBe(false);
  });
});

describe('villain model and narrowing', () => {
  it('bigger bets fold out more (except monsters)', () => {
    expect(continueProb(REGULAR_MODEL, 'monster', 2)).toBe(1);
    expect(continueProb(REGULAR_MODEL, 'medium', 1)).toBeLessThan(continueProb(REGULAR_MODEL, 'medium', 0.33));
    expect(continueProb(REGULAR_MODEL, 'medium', 0.5)).toBeCloseTo(REGULAR_MODEL.continueVsHalfPot.medium, 12);
  });

  it('continuing ranges shrink as the bet grows', () => {
    const combos = classifyRange(parseRange('22+, A2s+, KTs+, QTs+, JTs, T9s, ATo+, KJo+'), parseCardIndices('Kh7h2c'));
    const total = (r: ReturnType<typeof continuingRange>) => r.weights.reduce((s, w) => s + w, 0);
    expect(total(continuingRange(combos, 1, REGULAR_MODEL))).toBeLessThan(total(continuingRange(combos, 0.33, REGULAR_MODEL)));
  });

  it('balanced river betting ranges bluff about bet/(pot+2bet)', () => {
    const board = parseCardIndices('Kh7h2c9s3d');
    const combos = classifyRange(parseRange('random'), board);
    const bet = bettingRange(combos, 1, REGULAR_MODEL, 'river');
    const comp = composition(classifyRange(bet, board));
    const bluffs = comp.share.air + comp.share.weak;
    expect(bluffs).toBeGreaterThan(0.25);
    expect(bluffs).toBeLessThan(0.45); // target 1/3 plus some weak hands
  });
});

describe('scenario generator', () => {
  for (const potType of ['srp', '3bet', 'limped', 'multiway'] as PotType[]) {
    it(`builds valid ${POT_TYPE_NAMES[potType]} spots`, () => {
      for (let i = 0; i < 6; i++) {
        let theme = THEMES[i % THEMES.length]!;
        if (theme === 'cbet' && potType === 'limped') theme = 'value';
        if (theme === 'short' && (potType === 'limped' || potType === 'multiway')) theme = 'facing';
        const spot = generateSpot(createRng(40 + i), { theme, potType, chart: theme === 'short' ? ch : c6, model: REGULAR_MODEL });
        expect(spot.potType).toBe(potType);
        expect(spot.board.length).toBe(spot.street === 'flop' ? 3 : spot.street === 'turn' ? 4 : 5);
        expect(new Set([...spot.board, ...spot.hero]).size).toBe(spot.board.length + 2);
        expect(spot.pot).toBeGreaterThan(0);
        expect(spot.effectiveStack).toBeGreaterThan(0);
        if (potType === 'multiway') expect([2, 3]).toContain(spot.villains.length);
        else expect(spot.villains.length).toBe(1);
        for (const v of spot.villains) expect(classifyRange(v.range, spot.board, spot.hero).length).toBeGreaterThan(0);
      }
    });
  }
  it('c-bet spots put hero in the aggressor seat; short spots are 40bb', () => {
    const s = generateSpot(createRng(3), { theme: 'cbet', chart: c6, model: REGULAR_MODEL });
    expect(s.heroAggressor).toBe(true);
    const t = generateSpot(createRng(4), { theme: 'short', chart: ch, model: REGULAR_MODEL });
    expect(t.stackBb).toBe(40);
  });
  it('deals hero a hand from hero’s own range', () => {
    const s = generateSpot(createRng(9), { theme: 'value', street: 'river', chart: c6, model: REGULAR_MODEL });
    const idx = classifyRange(s.heroRange, s.board).map((c) => c.index);
    const [a, b] = [...s.hero].sort((x, y) => y - x);
    const heroIdx = classifyRange(parseRange(`${'23456789TJQKA'[a! >> 2]}${'shdc'[a! & 3]}${'23456789TJQKA'[b! >> 2]}${'shdc'[b! & 3]}`), s.board)[0]!.index;
    expect(idx).toContain(heroIdx);
  });
});

describe('analysis', () => {
  const riverFacing = (heroCards: string) =>
    buildReplaySpot(c6, {
      hero: heroCards,
      board: 'Kh7h2c9s3d',
      heroSeat: 'BB',
      villainSeat: 'BTN',
      preflop: 'villain-open',
      earlier: ['villain-bet-call', 'check-check'],
      pot: 12,
      effectiveStack: 90,
      facingBet: 9,
      model: REGULAR_MODEL,
    });

  it('the nuts never folds, air never calls a big river bet', () => {
    const nuts = analyzeSpot(riverFacing('KsKd'));
    expect(nuts.best.action).not.toBe('fold');
    const air = analyzeSpot(riverFacing('5c4c'));
    expect(air.best.action).toBe('fold');
  });

  it('call EV = equity × (pot + 2·bet) − bet on the river', () => {
    const a = analyzeSpot(riverFacing('QsQd'));
    const call = a.options.find((o) => o.action === 'call')!;
    expect(call.ev).toBeCloseTo(a.heroEquity * (12 + 18) - 9, 6);
  });

  it('exactly one Best per spot and the explanation covers range, equity and why', () => {
    for (let i = 0; i < 6; i++) {
      const spot = generateSpot(createRng(100 + i), { theme: i % 2 ? 'cbet' : 'value', chart: c6, model: REGULAR_MODEL });
      const a = analyzeSpot(spot, { gradeBy: spot.theme === 'cbet' ? 'cbet' : 'ev', sizes: [0.33, 0.5, 0.75, 1] });
      expect(a.options.filter((o) => o.grade === 'best')).toHaveLength(1);
      const text = a.steps.join('\n');
      expect(text).toMatch(/Villain's range/);
      expect(text).toMatch(/equity vs that range/);
      expect(text).toMatch(/EV ≈/);
    }
  });

  it('c-bet plans follow the documented thresholds', () => {
    expect(cbetPlan(0.6, 0, 'dry')).toBe('range-small');
    expect(cbetPlan(0.56, 0.06, 'wet')).toBe('polar-big');
    expect(cbetPlan(0.45, 0.1, 'wet')).toBe('check-heavy');
    expect(cbetPlan(0.52, 0, 'semi-wet')).toBe('medium');
    expect(cbetHandRule('range-small', hand('QsJd', 'Kh7c2s')).best).toBe('small');
    expect(cbetHandRule('polar-big', hand('Ts8d', 'Kh8h2c')).best).toBe('check');
    expect(RULES.evTolerance).toBeGreaterThan(0);
  });
});

describe('postflop drills', () => {
  it('every theme produces a well-formed question', () => {
    const drills = makePostflopDrills({ chart: c6, shortChart: ch, model: REGULAR_MODEL, filters: {} });
    for (const drill of drills) {
      for (let i = 0; i < 3; i++) {
        const q = buildQuestion({ drills: [drill], difficulty: 'silver', skills: {}, seed: 11 + i * 17 }, i);
        expect(q.choices.filter((c) => c.grade === 'best')).toHaveLength(1);
        expect(q.explanation.steps.length).toBeGreaterThan(1);
        expect(q.prompt).toMatch(/\?$/);
        expect(JSON.stringify(q)).not.toMatch(/NaN|undefined/);
      }
    }
  }, 60_000);

  it('filters restrict the variants', () => {
    expect(postflopVariants('cbet', { streets: ['river'] })).toEqual(['cbet|*|srp']);
    expect(postflopVariants('facing', { streets: ['river'], potTypes: ['3bet'] })).toEqual(['facing|river|3bet']);
    expect(postflopVariants('value', { streets: ['flop'], potTypes: ['srp'] })).toContain('value|flop|srp|streets');
  });
});

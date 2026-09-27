/** Raise model, check-raise / facing-raise analysis, turn cards, multi-way spots and the new drill packs. */
import { describe, expect, it } from 'vitest';
import six from '../../data/ranges/cash-6max-100bb.json';
import home from '../../data/ranges/home-40bb.json';
import { parseCardIndices } from '../cards';
import { buildQuestion } from '../drills/round';
import { archetypeModel } from '../exploit/profiles';
import { buildCharts, type ChartJson } from '../preflop/charts';
import { parseRange } from '../range';
import { createRng } from '../rng';
import { analyzeSpot } from '../strategy/analyze';
import { DEFAULT_RAISE_SHARE, REGULAR_MODEL, actionProbs, raiseShareOf } from '../strategy/villainModel';
import { classifyHand } from './buckets';
import { makePostflopDrills, postflopVariants } from './drills';
import { callingRange, classifyRange, continuingRange, raisingRange } from './narrow';
import { generateSpot, actsAfter, type Spot } from './scenario';
import { cardChanges, straightWindows } from './turnCard';

const library = Object.fromEntries([six, home].map((j) => [j.id, j as unknown as ChartJson]));
const charts = buildCharts(library);
const c6 = charts['cash-6max-100bb']!;
const ch = charts['home-40bb']!;
const cards = (s: string) => parseCardIndices(s);
const sum = (w: Float64Array) => w.reduce((a, b) => a + b, 0);

describe('raise model', () => {
  it('fold + call + raise = 1 and raises are a share of continuing hands', () => {
    for (const b of ['monster', 'strong', 'medium', 'draw', 'weak', 'air'] as const) {
      for (const f of [0.33, 0.5, 1, 2]) {
        const p = actionProbs(REGULAR_MODEL, b, f);
        expect(p.fold + p.call + p.raise).toBeCloseTo(1, 12);
        expect(p.raise).toBeCloseTo((1 - p.fold) * DEFAULT_RAISE_SHARE[b], 12);
      }
    }
    expect(raiseShareOf(REGULAR_MODEL, 'draw', true)).toBe(DEFAULT_RAISE_SHARE.strongDraw);
    expect(actionProbs(REGULAR_MODEL, 'monster', 0.5).raise).toBeCloseTo(0.35); // monsters always continue
  });

  it('aggressive profiles raise more than passive ones', () => {
    const maniac = archetypeModel('maniac');
    const station = archetypeModel('station');
    expect(raiseShareOf(maniac, 'monster')).toBeGreaterThan(raiseShareOf(station, 'monster'));
    expect(raiseShareOf(maniac, 'air')).toBeGreaterThan(raiseShareOf(station, 'air'));
  });

  it('calling + raising ranges add up to the continuing range', () => {
    const board = cards('Kh7h2c');
    const combos = classifyRange(parseRange('22+,A2s+,K9o+,QTs+,JTs,T9s,98s,87s,76s'), board);
    for (const f of [0.33, 0.75]) {
      const cont = sum(continuingRange(combos, f, REGULAR_MODEL).weights);
      const split = sum(callingRange(combos, f, REGULAR_MODEL).weights) + sum(raisingRange(combos, f, REGULAR_MODEL).weights);
      expect(split).toBeCloseTo(cont, 9);
    }
  });
});

/** A hand-built heads-up river spot (hero in position unless stated). */
function riverSpot(hero: string, villainRange: string, extra: Partial<Spot> = {}): Spot {
  const board = cards('AsKsQsJs2h');
  return {
    theme: 'river',
    potType: 'srp',
    street: 'river',
    stackBb: 100,
    board,
    hero: cards(hero) as [number, number],
    heroSeat: 'BTN',
    heroRange: parseRange('random'),
    heroIP: true,
    heroAggressor: true,
    villains: [{ seat: 'BB', range: parseRange(villainRange), stack: 90, aggressor: false }],
    pot: 20,
    effectiveStack: 90,
    facingBet: null,
    checkedTo: true,
    history: [],
    rangeTrail: [],
    model: REGULAR_MODEL,
    ...extra,
  };
}

describe('analysis with raises', () => {
  it('bet EV = fold·pot + call·(eq·(pot+2B) − B) + raise·max(−B, eq·(pot+2R) − R)', () => {
    // Hero has a royal flush (equity 1); villain holds only 33 (one bucket, so one set of probabilities).
    const spot = riverSpot('Ts9d', '3h3d,3h3c,3d3c'); // no 3♠: a flush would change the bucket
    const a = analyzeSpot(spot, { sizes: [0.5] });
    const bet = a.options.find((o) => o.action === 'bet')!;
    const B = 10;
    expect(bet.amount).toBe(B);
    const bucket = classifyHand(cards('3c')[0]!, cards('3d')[0]!, spot.board).bucket;
    const p = actionProbs(REGULAR_MODEL, bucket, B / 20);
    const R = 30;
    const expected = p.fold * 20 + p.call * (1 * (20 + 2 * B) - B) + p.raise * Math.max(-B, 1 * (20 + 2 * R) - R);
    expect(bet.ev).toBeCloseTo(expected, 6);
    if (p.raise > 0) {
      expect(bet.raiseTo).toBe(R);
      expect(bet.vsRaise).toBe('call');
    }
  });

  it('with no equity, getting raised means folding: a bet loses exactly what gets called or raised', () => {
    // Villain has the royal flush; hero has air.
    const spot = riverSpot('7d6c', 'Ts9c');
    const a = analyzeSpot(spot, { sizes: [0.5] });
    const bet = a.options.find((o) => o.action === 'bet')!;
    const p = actionProbs(REGULAR_MODEL, 'monster', 0.5);
    expect(bet.ev).toBeCloseTo(p.fold * 20 - p.call * 10 - p.raise * 10, 6);
    expect(bet.vsRaise).toBe('fold');
    expect(a.best.action).toBe('check');
  });

  it('all-in bets cannot be raised', () => {
    const spot = riverSpot('Ts9d', '3h3d', { effectiveStack: 10 });
    const a = analyzeSpot(spot, { sizes: [1] });
    const bet = a.options.find((o) => o.action === 'bet')!;
    expect(bet.allIn).toBe(true);
    expect(bet.raisePct).toBeUndefined();
  });

  it('facing a check-raise: call EV = eq·(pot + 2R) − (R − bet); all-in is offered', () => {
    const spot = riverSpot('QhQd', 'Ts9c,33,KhKd', { checkedTo: false, facingRaise: { heroBet: 10, raiseTo: 30 } });
    const a = analyzeSpot(spot);
    const call = a.options.find((o) => o.action === 'call')!;
    expect(call.amount).toBe(20);
    expect(call.ev).toBeCloseTo(a.heroEquity * (20 + 60) - 20, 6);
    expect(a.options.map((o) => o.id)).toEqual(['fold', 'call', 'jam']);
    expect(a.options.filter((o) => o.grade === 'best')).toHaveLength(1);
  });
});

describe('turn cards', () => {
  it('names what the turn changed', () => {
    expect(cardChanges(cards('9h8h2c'), cards('Th')[0]!)).toEqual(['overcard', 'flush-possible', 'straight-possible']);
    expect(cardChanges(cards('9h8h2c'), cards('9d')[0]!)).toEqual(['pairs-board']);
    expect(cardChanges(cards('Kc7d2h'), cards('3s')[0]!)).toEqual(['brick']);
    expect(cardChanges(cards('AhKh2h'), cards('7h')[0]!)).toContain('four-flush');
    expect(cardChanges(cards('AhKd2c'), cards('7h')[0]!)).toEqual(['flush-draw']);
  });
  it('counts straight windows', () => {
    expect(straightWindows(cards('Kc7d2h'))).toBe(0);
    expect(straightWindows(cards('9h8h7c'))).toBe(3); // 5-9, 6-T, 7-J
    expect(straightWindows(cards('Ah2d3c'))).toBe(1); // wheel only
  });
});

describe('new spot types', () => {
  it('4-way pots have 3 villains and the pot is 4 opens plus dead blinds', () => {
    for (let i = 0; i < 6; i++) {
      const s = generateSpot(createRng(300 + i), { theme: 'multiway', potType: 'multiway', players: 4, street: 'flop', heroRole: 'aggressor', action: 'first', chart: c6, model: REGULAR_MODEL });
      expect(s.villains).toHaveLength(3);
      expect(s.heroAggressor).toBe(true);
      const seats = [s.heroSeat, ...s.villains.map((v) => v.seat)];
      const dead = (seats.includes('SB') ? 0 : 0.5) + (seats.includes('BB') ? 0 : 1);
      expect(s.pot).toBeCloseTo(c6.openSize(s.heroSeat) * 4 + dead, 6);
    }
  });

  it('multi-way facing spots: hero acts last and the callers’ chips are in the pot', () => {
    for (let i = 0; i < 6; i++) {
      const s = generateSpot(createRng(400 + i), { theme: 'multiway', potType: 'multiway', action: 'facing', chart: c6, model: REGULAR_MODEL });
      for (const v of s.villains) expect(actsAfter(s.heroSeat, v.seat)).toBe(true);
      expect(s.callersBefore).toHaveLength(s.villains.length - 1);
      expect(s.facingBet).toBeGreaterThan(0);
    }
  });

  it('check-raise spots: hero bet in position and villain raised 3× (or all-in)', () => {
    for (let i = 0; i < 6; i++) {
      const s = generateSpot(createRng(500 + i), { theme: 'checkraise', potType: 'srp', street: 'flop', heroRole: 'aggressor', heroIP: true, action: 'facingRaise', chart: c6, model: REGULAR_MODEL });
      expect(s.heroIP).toBe(true);
      const { heroBet, raiseTo } = s.facingRaise!;
      expect(raiseTo === heroBet * 3 || raiseTo === s.effectiveStack).toBe(true);
      expect(classifyRange(s.villains[0]!.range, s.board, s.hero).length).toBeGreaterThan(0);
    }
  });

  it('barrel lines bet and get called on every earlier street', () => {
    const s = generateSpot(createRng(600), { theme: 'turn', street: 'turn', heroRole: 'aggressor', line: 'barrel', action: 'first', chart: c6, model: REGULAR_MODEL });
    expect(s.history.filter((h) => h.street === 'flop')[0]!.text).toMatch(/you bet/);
  });
});

describe('new drill packs', () => {
  const drills = makePostflopDrills({ chart: c6, shortChart: ch, model: REGULAR_MODEL, filters: {} });
  for (const theme of ['checkraise', 'turn', 'river', 'multiway'] as const) {
    it(`${theme}: every variant builds well-formed questions`, () => {
      const drill = drills.find((d) => d.kind === `postflop.${theme}`)!;
      for (const variant of drill.variants.silver) {
        for (let i = 0; i < 2; i++) {
          const q = drill.generate(createRng(700 + i * 31), 'silver', variant, `t-${i}`);
          expect(q.kind).toBe(`postflop.${theme}`);
          expect(q.choices.filter((c) => c.grade === 'best')).toHaveLength(1);
          expect(q.explanation.steps.length).toBeGreaterThan(3);
          expect(q.prompt).toMatch(/\?$/);
          expect(JSON.stringify(q)).not.toMatch(/NaN|undefined|Infinity/);
        }
      }
    }, 120_000);
  }
  it('rounds mix variants through the normal round builder', () => {
    const drill = drills.find((d) => d.kind === 'postflop.checkraise')!;
    const q = buildQuestion({ drills: [drill], difficulty: 'gold', skills: {}, seed: 5 }, 0);
    expect(q.skill).toMatch(/^postflop\.checkraise\|/);
  });
  it('filters pick matching variants and fall back when nothing matches', () => {
    expect(postflopVariants('checkraise', { streets: ['turn'], potTypes: ['srp'] })).toEqual(['checkraise|turn|srp|make', 'checkraise|turn|srp|face']);
    expect(postflopVariants('river', { streets: ['flop'] })).toEqual(['river|river|*|bluffcatch', 'river|river|*|size']);
    expect(postflopVariants('multiway', { potTypes: ['srp'] })).toEqual(['multiway|flop|multiway|cbet', 'multiway|flop|multiway|facing']);
    expect(postflopVariants('turn', {})).toEqual(['turn|turn|*|barrel']);
  });
});

describe('bet size as the villain model reads it', () => {
  it('bets are bet/pot; raises are the extra call over the pot before it', async () => {
    const { betFractionFacing } = await import('../strategy/analyze');
    expect(betFractionFacing(20, 0, 10)).toBe(0.5); // half-pot bet
    expect(betFractionFacing(20, 0, 20)).toBe(1); // pot-size bet
    // Pot 20, villain bets 10, hero raises to 40 (a pot-size raise): villain calls 30 into 70 → like a pot-size bet.
    expect(betFractionFacing(20, 10, 40)).toBe(0.75);
    expect(betFractionFacing(20, 10, 50)).toBe(1);
  });
});

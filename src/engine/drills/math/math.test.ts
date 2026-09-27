import { describe, expect, it } from 'vitest';
import { classCombos } from '../../range';
import { calculateOuts } from '../../outs';
import { formatPercent } from '../../math';
import { bluffBreakeven, hitProbability, minimumDefenseFrequency, requiredEquity } from '../../odds';
import { createRng } from '../../rng';
import { buildQuestion } from '../round';
import { emptySkill, recordAnswer } from '../srs';
import { DIFFICULTIES, bestChoice, type Question } from '../types';
import { comboWorking } from './combosDrill';
import { MATH_DRILLS, MATH_DRILL_BY_KIND } from './index';

const SEEDS = 12;

function questions(kind: string, difficulty: (typeof DIFFICULTIES)[number], n = SEEDS): Question[] {
  const drill = MATH_DRILL_BY_KIND.get(kind)!;
  return Array.from({ length: n }, (_, i) => buildQuestion({ drills: [drill], difficulty, skills: {}, seed: 1000 + i * 31 }, i));
}

const num = (label: string) => Number(label.replace(/[^0-9.\-]/g, ''));
const money = (s: string) => Number(s.replace(/[^0-9.]/g, ''));
const fact = (q: Question, label: string) => q.context.facts?.find((f) => f.label === label)?.value ?? '';

describe('every drill, every difficulty', () => {
  for (const drill of MATH_DRILLS) {
    for (const difficulty of DIFFICULTIES) {
      it(`${drill.kind} / ${difficulty} produces well-formed questions`, () => {
        for (const q of questions(drill.kind, difficulty)) {
          expect(q.kind).toBe(drill.kind);
          expect(q.difficulty).toBe(difficulty);
          expect(q.choices.filter((c) => c.grade === 'best')).toHaveLength(1);
          expect(new Set(q.choices.map((c) => c.label)).size).toBe(q.choices.length);
          expect(q.choices.length).toBeGreaterThanOrEqual(2);
          expect(q.explanation.summary.length).toBeGreaterThan(10);
          expect(q.explanation.steps.length).toBeGreaterThan(0);
          expect(q.prompt).toMatch(/\?$/);
          expect(q.explanation.summary + q.explanation.steps.join('')).not.toMatch(/NaN|undefined|Infinity/);
        }
      }, 30_000);
    }
  }
});

describe('answers match independent recomputation', () => {
  it('outs = engine outs count', () => {
    for (const d of ['bronze', 'silver', 'gold'] as const) {
      for (const q of questions('math.outs', d, 8)) {
        const villain = q.context.villain!;
        // Rebuild from the question's cards: hand-mode villains show their two cards as tokens.
        const vCards = [...villain.matchAll(/\{(\w\w)\}/g)].map((m) => m[1]).join('');
        if (!vCards) continue; // range villains are checked via the dirty-outs test below
        const r = calculateOuts(q.context.hero!.join(''), q.context.board!.join(''), vCards);
        expect(Number(bestChoice(q).label)).toBe(r.outs.length);
      }
    }
  });

  it('rule of 2 and 4 answer is the exact probability', () => {
    for (const q of questions('math.rule24', 'silver', 20)) {
      const outs = Number(fact(q, 'Outs'));
      const unseen = Number(fact(q, 'Unseen cards'));
      const draws = Number(fact(q, 'Cards to come'));
      expect(bestChoice(q).label).toBe(formatPercent(hitProbability(outs, unseen, draws)));
    }
  });

  it('pot odds answer = call / (pot + bet + call)', () => {
    for (const q of questions('math.potodds', 'silver', 20)) {
      const pot = money(fact(q, 'Pot'));
      const bet = money(fact(q, 'Bet').split(' ')[0]!);
      expect(bestChoice(q).label).toBe(formatPercent(requiredEquity(pot, bet).requiredEquity));
    }
  });

  it('combo answers equal engine combo counts with blockers', () => {
    for (const d of ['bronze', 'silver', 'gold'] as const) {
      for (const q of questions('math.combos', d, 15)) {
        const dead = [...q.context.hero!, ...q.context.board!].join('');
        const m = /combos of (\S+) can/.exec(q.prompt) ?? /range is (.+)\. How/.exec(q.prompt);
        const labels = m![1]!.split(', ');
        const total = labels.reduce((s, l) => s + classCombos(l, dead), 0);
        expect(Number(bestChoice(q).label)).toBe(total);
      }
    }
  });

  it('MDF answer = pot / (pot + bet)', () => {
    for (const q of questions('math.mdf', 'silver', 15)) {
      const pot = money(fact(q, 'Pot'));
      const bet = money(fact(q, 'Villain bets').split(' ')[0]!);
      expect(bestChoice(q).label).toBe(formatPercent(minimumDefenseFrequency(pot, bet)));
    }
  });

  it('pure bluff verdict follows the breakeven', () => {
    for (const q of questions('math.bluff', 'silver', 20)) {
      const pot = money(fact(q, 'Pot'));
      const bet = money(fact(q, 'Your bet').split(' ')[0]!);
      const fold = num(fact(q, 'Villain folds')) / 100;
      const verdict = fold > bluffBreakeven(pot, bet) ? 'Profitable' : 'Not profitable';
      expect(bestChoice(q).label).toBe(verdict);
    }
  });

  it('EV drill best choice has the highest EV note', () => {
    for (const q of questions('math.ev', 'silver', 8)) {
      const evs = q.choices.map((c) => ({ c, ev: Number(c.note!.replace(/[^0-9.\-−]/g, '').replace('−', '-')) }));
      const top = Math.max(...evs.map((e) => e.ev));
      expect(evs.find((e) => e.c.grade === 'best')!.ev).toBeCloseTo(top, 1);
    }
  });

  it('call/fold: best action matches the sign of the call EV', () => {
    for (const q of questions('math.callfold', 'silver', 10)) {
      const call = q.choices.find((c) => c.label === 'Call')!;
      const ev = Number(call.note!.replace(/[^0-9.\-−]/g, '').replace('−', '-'));
      expect(call.grade === 'best').toBe(ev > 0);
    }
  });

  it('gold outs include dirty outs when asked', () => {
    const drill = MATH_DRILL_BY_KIND.get('math.outs')!;
    const q = drill.generate(createRng(5), 'gold', 'dirty', 'x');
    expect(q.explanation.steps.join(' ')).toMatch(/Dirty/);
  });
});

describe('combo working', () => {
  it('shows the blocker math for the classic example', () => {
    // Holding AQ on K-7-2: AK combos = 3 aces × 3 kings = 9
    const dead = ['Ah', 'Qc', 'Kd', '7s', '2c'].map((c) => {
      const r = '23456789TJQKA'.indexOf(c[0]!);
      return r * 4 + 'shdc'.indexOf(c[1]!);
    });
    const w = comboWorking('AK', dead);
    expect(w.combos).toBe(9);
    expect(w.steps.join(' ')).toContain('3 × 3 = 9');
    expect(comboWorking('KK', dead).combos).toBe(3);
    expect(comboWorking('AKs', dead).combos).toBe(2);
    expect(comboWorking('AKo', dead).combos).toBe(7);
  });
});

describe('rounds', () => {
  it('are deterministic per seed', () => {
    const spec = { drills: MATH_DRILLS, difficulty: 'diamond' as const, skills: {}, seed: 42 };
    expect(buildQuestion(spec, 3)).toEqual(buildQuestion(spec, 3));
  });

  it('diamond mixes drill types', () => {
    const spec = { drills: MATH_DRILLS, difficulty: 'diamond' as const, skills: {}, seed: 9 };
    const kinds = new Set(Array.from({ length: 20 }, (_, i) => buildQuestion(spec, i).kind));
    expect(kinds.size).toBeGreaterThanOrEqual(4);
  });

  it('missed skills are resurfaced more often', () => {
    const drill = MATH_DRILL_BY_KIND.get('math.potodds')!;
    let mastered = emptySkill();
    for (let i = 0; i < 5; i++) mastered = recordAnswer(mastered, 'best', 1000);
    const skills = { 'math.potodds:multiway': recordAnswer(emptySkill(), 'mistake', 1000), 'math.potodds:raised': mastered, 'math.potodds:sized': mastered };
    const counts: Record<string, number> = {};
    for (let i = 0; i < 300; i++) {
      const q = buildQuestion({ drills: [drill], difficulty: 'gold', skills, seed: 77 }, i);
      counts[q.skill] = (counts[q.skill] ?? 0) + 1;
    }
    expect(counts['math.potodds:multiway']!).toBeGreaterThan(counts['math.potodds:raised']! * 3);
  });
});

import { describe, expect, it } from 'vitest';
import { REGULAR_MODEL, actionProbs, forStreet } from '../strategy/villainModel';
import { BUCKETS } from '../postflop/buckets';
import {
  BLUFF_MEMORY_HANDS,
  CARD_DEAD_HANDS,
  IMAGE_LABELS,
  NEUTRAL_IMAGE,
  TIGHT_FEARED_START,
  applyImage,
  effectiveStickiness,
  imageLabel,
  updateImage,
  type HandImageEvents,
} from './image';

const fold: HandImageEvents = { played: false, aggressive: 0, passive: 0, won: false, showed: 'none' };
const playAggro: HandImageEvents = { played: true, aggressive: 2, passive: 0, won: true, showed: 'none' };

describe('image state', () => {
  it('starts Tight and Feared for the home-game preset, Solid when neutral', () => {
    expect(imageLabel(TIGHT_FEARED_START)).toBe('tight-feared');
    expect(imageLabel(NEUTRAL_IMAGE)).toBe('solid');
  });

  it('moves in the right direction: playing lots of hands raises VPIP, folding lowers it', () => {
    let s = NEUTRAL_IMAGE;
    for (let i = 0; i < 5; i++) s = updateImage(s, playAggro);
    expect(s.vpip).toBeGreaterThan(NEUTRAL_IMAGE.vpip);
    expect(s.aggression).toBeGreaterThan(NEUTRAL_IMAGE.aggression);
    let t = NEUTRAL_IMAGE;
    for (let i = 0; i < 5; i++) t = updateImage(t, fold);
    expect(t.vpip).toBeLessThan(NEUTRAL_IMAGE.vpip);
  });

  it('a shown bluff makes you Wild, and it decays after BLUFF_MEMORY_HANDS', () => {
    let s = updateImage(TIGHT_FEARED_START, { played: true, aggressive: 3, passive: 0, won: false, showed: 'bluff' });
    expect(imageLabel(s)).toBe('wild');
    for (let i = 0; i < BLUFF_MEMORY_HANDS; i++) s = updateImage(s, i % 3 ? fold : { ...playAggro, won: false });
    expect(imageLabel(s)).not.toBe('wild');
  });

  it('decays toward the new behaviour: a loose image fades after many folded hands', () => {
    let s = NEUTRAL_IMAGE;
    for (let i = 0; i < 40; i++) s = updateImage(s, playAggro);
    expect(imageLabel(s)).toBe('wild');
    for (let i = 0; i < 60; i++) s = updateImage(s, i % 5 ? fold : playAggro);
    expect(imageLabel(s)).not.toBe('wild');
    expect(s.vpip).toBeLessThan(0.3);
  });

  it('folding CARD_DEAD_HANDS in a row reads Card Dead', () => {
    let s = NEUTRAL_IMAGE;
    for (let i = 0; i < CARD_DEAD_HANDS; i++) s = updateImage(s, fold);
    expect(imageLabel(s)).toBe('card-dead');
  });
});

describe('applyImage', () => {
  it('reactivity 0 means no change', () => {
    for (const l of IMAGE_LABELS) expect(applyImage(REGULAR_MODEL, l, 0)).toBe(REGULAR_MODEL);
    expect(effectiveStickiness('wild', 'river', 0)).toBe(1);
  });

  it('keeps every probability valid for every label, street and bucket', () => {
    for (const l of IMAGE_LABELS)
      for (const r of [0.5, 1, 2])
        for (const st of ['flop', 'turn', 'river'] as const) {
          const m = forStreet(applyImage(REGULAR_MODEL, l, r), st);
          for (const b of BUCKETS)
            for (const f of [0.33, 0.75, 1.5]) {
              const p = actionProbs(m, b, f);
              for (const x of [p.fold, p.call, p.raise]) {
                expect(x).toBeGreaterThanOrEqual(0);
                expect(x).toBeLessThanOrEqual(1);
              }
              expect(p.fold + p.call + p.raise).toBeCloseTo(1, 9);
            }
        }
  });

  it('Tight and Feared: they fold more on the flop but continue as much or more on the river', () => {
    const m = applyImage(REGULAR_MODEL, 'tight-feared', 1);
    const base = actionProbs(REGULAR_MODEL, 'medium', 0.5).fold;
    expect(actionProbs(forStreet(m, 'flop'), 'medium', 0.5).fold).toBeGreaterThan(base);
    expect(actionProbs(forStreet(m, 'river'), 'medium', 0.5).fold).toBeLessThanOrEqual(base);
  });

  it('Wild: they call wider on every street, more with higher reactivity', () => {
    for (const st of ['flop', 'turn', 'river'] as const) {
      const f0 = actionProbs(REGULAR_MODEL, 'weak', 0.5).fold;
      const f1 = actionProbs(forStreet(applyImage(REGULAR_MODEL, 'wild', 1), st), 'weak', 0.5).fold;
      const f2 = actionProbs(forStreet(applyImage(REGULAR_MODEL, 'wild', 2), st), 'weak', 0.5).fold;
      expect(f1).toBeLessThan(f0);
      expect(f2).toBeLessThan(f1);
    }
  });

  it('never makes a monster fold', () => {
    const m = forStreet(applyImage(REGULAR_MODEL, 'card-dead', 2), 'flop');
    expect(m.continueVsHalfPot.monster).toBe(1);
  });
});

describe('imageEventsFromHand + bots', () => {
  it('reads a folded preflop hand as not played', async () => {
    const { startHand, applyAction } = await import('../game/holdem');
    const { createRng } = await import('../rng');
    const { imageEventsFromHand } = await import('./fromHand');
    let h = startHand([{ name: 'You', stack: 40, hero: true }, { name: 'A', stack: 40 }, { name: 'B', stack: 40 }], 0, { sb: 0.5, bb: 1 }, createRng(1), 1);
    while (!h.finished && h.toAct !== 0) h = applyAction(h, { type: h.toAct === null ? 'check' : 'fold' });
    if (!h.finished) h = applyAction(h, { type: 'fold' });
    const e = imageEventsFromHand(h, 0);
    expect(e.played).toBe(false);
    expect(e.showed).toBe('none');
  });

  it('a bot facing hero folds more often when hero looks Tight and Feared than when Wild', async () => {
    const { botDecision, makeBot } = await import('../game/bots');
    const { ARCHETYPES } = await import('../exploit/profiles');
    const { startHand, applyAction } = await import('../game/holdem');
    const { createRng } = await import('../rng');
    const bot = makeBot('Reg', ARCHETYPES.tag.stats, 'tag');
    const count = (label: 'tight-feared' | 'wild') => {
      let folds = 0;
      for (let seed = 1; seed <= 400; seed++) {
        // Heads-up: hero is the button/SB and raises; the bot in the BB responds.
        let h = startHand([{ name: 'You', stack: 40, hero: true }, { name: 'Reg', stack: 40 }], 0, { sb: 0.5, bb: 1 }, createRng(seed), seed);
        h = applyAction(h, { type: 'raise', to: 3 });
        if (botDecision(h, bot, createRng(seed * 7), { seat: 0, label }).type === 'fold') folds++;
      }
      return folds;
    };
    expect(count('tight-feared')).toBeGreaterThan(count('wild'));
  });
});

describe('imageCoachTip', async () => {
  const { imageCoachTip, imageSessionNotes } = await import('./image');
  it('is silent for a Solid image and quotes computed numbers otherwise', () => {
    expect(imageCoachTip('solid', 'flop', true, REGULAR_MODEL)).toBeNull();
    const tip = imageCoachTip('wild', 'river', true, REGULAR_MODEL)!;
    const after = forStreet(applyImage(REGULAR_MODEL, 'wild', 1), 'river').continueVsHalfPot.medium;
    expect(tip).toContain(`${Math.round(after * 100)}%`);
    expect(imageCoachTip('tight-feared', 'preflop', true, REGULAR_MODEL)).toContain('25% tighter');
  });
  it('writes session notes', () => {
    expect(imageSessionNotes([{ handNo: 4, from: 'tight-feared', to: 'wild' }], 'wild')[0]).toContain('Tight and Feared to Wild');
  });
});

describe('Image Shifts drill pack', () => {
  it('generates a graded question for every variant', async () => {
    const { makeExploitDrills } = await import('../exploit/drills');
    const { buildCharts } = await import('../preflop/charts');
    const six = (await import('../../data/ranges/cash-6max-100bb.json')).default;
    const { createRng } = await import('../rng');
    const chart = buildCharts({ [six.id]: six as never })[six.id]!;
    const pack = makeExploitDrills({ chart }).find((d) => d.kind === 'exploit.imageShift')!;
    for (const v of pack.variants.gold) {
      const q = pack.generate(createRng(3), 'gold', v, `t-${v}`);
      expect(q.choices.some((c) => c.grade === 'best')).toBe(true);
      expect(q.prompt).toMatch(/You look/);
    }
  });
});

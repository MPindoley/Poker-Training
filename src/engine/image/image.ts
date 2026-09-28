/**
 * TABLE IMAGE — how the table sees you, built only from what they can observe, and how that changes
 * the way opponents respond to your bets. Readable constants; adjust them like strategy/rules.ts.
 *
 * State is a set of exponential moving averages over recent hands (window IMAGE_WINDOW_HANDS), so
 * image fades as you play: a shown bluff is loud at first and forgotten after a while.
 */
import type { Bucket } from '../postflop/buckets';
import { forStreet, type ModelStreet, type VillainModel } from '../strategy/villainModel';

/** Hands an image "remembers": each new hand weighs 1 / IMAGE_WINDOW_HANDS. */
export const IMAGE_WINDOW_HANDS = 30;
/** A shown bluff makes you look wild for this many hands. */
export const BLUFF_MEMORY_HANDS = 12;
/** Folding this many hands in a row preflop makes you look card dead. */
export const CARD_DEAD_HANDS = 12;
/** Thresholds for the labels (shares of hands / of actions). */
export const IMAGE_THRESHOLDS = { tightVpip: 0.2, looseVpip: 0.32, wildVpip: 0.4, wildAggression: 0.6, fearedAggression: 0.5 } as const;

export interface ImageState {
  hands: number;
  /** Share of recent hands hero played (voluntarily put chips in preflop). */
  vpip: number;
  /** Share of hero's recent actions that were bets or raises. */
  aggression: number;
  /** Share of recent hands hero won. */
  potsWon: number;
  /** Recent big hands shown at showdown (decaying count). */
  bigShown: number;
  /** Recent weak hands shown that won (decaying count). */
  weakWins: number;
  /** Hands since hero last showed a bluff (null = never). */
  sinceBluffShown: number | null;
  /** Hands folded preflop in a row. */
  foldStreak: number;
}

export type ShowdownKind = 'bluff' | 'big' | 'weak-win' | 'none';

/** What the table could see about hero in one hand. */
export interface HandImageEvents {
  played: boolean;
  aggressive: number;
  passive: number;
  won: boolean;
  showed: ShowdownKind;
}

export const NEUTRAL_IMAGE: ImageState = { hands: 0, vpip: 0.25, aggression: 0.5, potsWon: 0.15, bigShown: 0, weakWins: 0, sinceBluffShown: null, foldStreak: 0 };

/** How the Home Game preset starts: the table already sees you as the tight, strong player. */
export const TIGHT_FEARED_START: ImageState = { hands: 40, vpip: 0.16, aggression: 0.65, potsWon: 0.2, bigShown: 1, weakWins: 0, sinceBluffShown: null, foldStreak: 0 };

export function updateImage(s: ImageState, e: HandImageEvents, window = IMAGE_WINDOW_HANDS): ImageState {
  const a = 1 / window;
  const ema = (old: number, x: number) => old + (x - old) * a;
  const acts = e.aggressive + e.passive;
  return {
    hands: s.hands + 1,
    vpip: ema(s.vpip, e.played ? 1 : 0),
    aggression: acts ? ema(s.aggression, e.aggressive / acts) : s.aggression,
    potsWon: ema(s.potsWon, e.won ? 1 : 0),
    bigShown: s.bigShown * (1 - a) + (e.showed === 'big' ? 1 : 0),
    weakWins: s.weakWins * (1 - a) + (e.showed === 'weak-win' ? 1 : 0),
    sinceBluffShown: e.showed === 'bluff' ? 0 : s.sinceBluffShown === null ? null : s.sinceBluffShown + 1,
    foldStreak: e.played ? 0 : s.foldStreak + 1,
  };
}

export type ImageLabel = 'tight-feared' | 'solid' | 'loose' | 'wild' | 'card-dead';
export const IMAGE_LABELS: readonly ImageLabel[] = ['tight-feared', 'solid', 'loose', 'wild', 'card-dead'];

export const IMAGE_NAMES: Record<ImageLabel, string> = {
  'tight-feared': 'Tight and Feared',
  solid: 'Solid',
  loose: 'Loose',
  wild: 'Wild / Bluffer',
  'card-dead': 'Card Dead',
};

export const IMAGE_BLURBS: Record<ImageLabel, string> = {
  'tight-feared': 'They think you only play strong hands: they fold marginal hands early, but once they call they rarely fold later.',
  solid: 'Nothing special: they play their normal game against you.',
  loose: 'You play a lot of pots: they call a little wider.',
  wild: 'They’ve seen you bluff: they call much wider for a while.',
  'card-dead': 'You’ve folded for ages: when you finally bet, they believe you.',
};

export function imageLabel(s: ImageState): ImageLabel {
  const t = IMAGE_THRESHOLDS;
  if ((s.sinceBluffShown !== null && s.sinceBluffShown < BLUFF_MEMORY_HANDS) || (s.vpip >= t.wildVpip && s.aggression >= t.wildAggression)) return 'wild';
  if (s.foldStreak >= CARD_DEAD_HANDS) return 'card-dead';
  if (s.vpip <= t.tightVpip && (s.aggression >= t.fearedAggression || s.bigShown >= 0.5)) return 'tight-feared';
  if (s.vpip >= t.looseVpip) return 'loose';
  return 'solid';
}

export type ImageStreet = 'preflop' | ModelStreet;

/**
 * STICKINESS by image and street: > 1 = they continue MORE against your bets, < 1 = they fold more.
 * Continue chances become p' = p^(1 / s), which keeps them in 0..1 and never folds a monster.
 *  - Tight and Feared: fold more preflop and on the flop, but after calling the flop they continue as
 *    much or more on the turn and river (they "know" you have it, but they've decided to see it through).
 *  - Wild: call much wider everywhere (they remember your bluff).
 *  - Card Dead: fold more to your bets.
 */
export const IMAGE_STICKINESS: Record<ImageLabel, Record<ImageStreet, number>> = {
  'tight-feared': { preflop: 0.75, flop: 0.8, turn: 1.1, river: 1.15 },
  solid: { preflop: 1, flop: 1, turn: 1, river: 1 },
  loose: { preflop: 1.15, flop: 1.1, turn: 1.05, river: 1.05 },
  wild: { preflop: 1.3, flop: 1.3, turn: 1.35, river: 1.4 },
  'card-dead': { preflop: 0.8, flop: 0.85, turn: 0.9, river: 0.9 },
};

/** How much opponents bluff YOU, relative to normal (they bluff the feared player less). */
export const IMAGE_BLUFF_FACTOR: Record<ImageLabel, number> = { 'tight-feared': 0.8, solid: 1, loose: 1, wild: 1.15, 'card-dead': 0.9 };

/** Default reactivity by archetype: 0 = ignores image, 1 = normal, 2 = very reactive. */
export const ARCHETYPE_REACTIVITY: Record<string, number> = { station: 0.3, nit: 1.5, maniac: 0.5, tag: 1, efls: 1.2, gambler: 0.6 };

/** Stickiness after reactivity: 1 + (s − 1) × reactivity (reactivity 0 = no change). */
export function effectiveStickiness(label: ImageLabel, street: ImageStreet, reactivity: number): number {
  return Math.max(0.05, 1 + (IMAGE_STICKINESS[label][street] - 1) * reactivity);
}

const stick = (p: number, s: number) => (p <= 0 ? 0 : p >= 1 ? 1 : Math.pow(p, 1 / s));

/** The model this opponent uses AGAINST HERO'S BETS given hero's image (per street). */
export function applyImage(model: VillainModel, label: ImageLabel, reactivity: number): VillainModel {
  if (reactivity === 0 || label === 'solid') return model;
  const bluff = 1 + (IMAGE_BLUFF_FACTOR[label] - 1) * reactivity;
  const street = (st: ModelStreet): VillainModel => {
    const base = forStreet(model, st);
    const s = effectiveStickiness(label, st, reactivity);
    const cont = Object.fromEntries((Object.entries(base.continueVsHalfPot) as [Bucket, number][]).map(([b, p]) => [b, stick(p, s)])) as Record<Bucket, number>;
    return { ...base, continueVsHalfPot: cont, bluffFactor: base.bluffFactor * bluff, byStreet: undefined };
  };
  const byStreet = { flop: street('flop'), turn: street('turn'), river: street('river') };
  return { ...byStreet.flop, id: `${model.id}+img:${label}`, name: `${model.name} (you look ${IMAGE_NAMES[label].toLowerCase()})`, byStreet };
}

/** Multiplier on a bot's preflop calling range when facing hero's raise (<1 = folds more). */
export function preflopImageFactor(label: ImageLabel, reactivity: number): number {
  return effectiveStickiness(label, 'preflop', reactivity);
}

/**
 * One-line coach tip about image for the current spot. The number shown is computed: how the typical
 * reactive opponent's continue chance for a medium hand vs a half-pot bet moves on this street.
 */
export function imageCoachTip(label: ImageLabel, street: ImageStreet, heroIsBetting: boolean, base: VillainModel): string | null {
  if (label === 'solid') return null;
  const name = IMAGE_NAMES[label];
  if (street === 'preflop') {
    const f = preflopImageFactor(label, 1);
    return f < 1
      ? `You look ${name}: raises get fewer calls (calling ranges about ${Math.round((1 - f) * 100)}% tighter). Open a little wider.`
      : `You look ${name}: raises get about ${Math.round((f - 1) * 100)}% more calls. Tighten up and raise bigger for value.`;
  }
  const m = forStreet(applyImage(base, label, 1), street);
  const before = forStreet(base, street).continueVsHalfPot.medium;
  const after = m.continueVsHalfPot.medium;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const move = `A top-pair-type hand continues vs half pot ${pct(before)} → ${pct(after)} on the ${street}`;
  if (!heroIsBetting) return `You look ${name}. ${move} when you bet.`;
  if (after < before) return `You look ${name}: bluffs work better here. ${move}.`;
  if (after > before) return `You look ${name}: bet thinner for value, bluff less. ${move}.`;
  return null;
}

export interface ImageShift {
  handNo: number;
  from: ImageLabel;
  to: ImageLabel;
}

/** Session summary note: where the image moved and what that means. */
export function imageSessionNotes(shifts: ImageShift[], final: ImageLabel): string[] {
  const notes = shifts.map((s) => `Hand #${s.handNo}: you went from ${IMAGE_NAMES[s.from]} to ${IMAGE_NAMES[s.to]}.`);
  notes.push(`You finish looking ${IMAGE_NAMES[final]}. ${IMAGE_BLURBS[final]}`);
  return notes;
}

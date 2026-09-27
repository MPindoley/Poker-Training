/**
 * How a player continues, bets and bluffs, by hand bucket. These are readable, adjustable
 * assumptions — not solver output. Exploit Lab profiles are just different numbers here.
 *
 * continueVsHalfPot: chance to call or raise a half-pot bet, by bucket.
 * sizeElasticity: how much bigger bets fold out more hands (0 = never cares, 1 = normal, 1.5 = very size-sensitive).
 *   continue(bet) = base ^ ((bet / 0.5) ^ sizeElasticity)   (bet as a fraction of the pot)
 * betFreq: chance to bet when checked to (or lead), by bucket — the value side of the betting range.
 * bluffFactor: 1 = bluffs so bluffs make up bet/(pot + 2·bet) of the river betting range (the classic
 *   balanced ratio); >1 bluffs more, <1 bluffs less. Earlier streets allow more bluffs (draws).
 */
import type { Bucket } from '../postflop/buckets';

export type ModelStreet = 'flop' | 'turn' | 'river';

export interface VillainModel {
  id: string;
  name: string;
  continueVsHalfPot: Record<Bucket, number>;
  sizeElasticity: number;
  betFreq: Record<Bucket, number>;
  bluffFactor: number;
  /** Optional per-street versions (e.g. folds a lot on the flop, never on the river). */
  byStreet?: Partial<Record<ModelStreet, VillainModel>>;
}

/** The model to use on a given street. */
export function forStreet(model: VillainModel, street: ModelStreet): VillainModel {
  return model.byStreet?.[street] ?? model;
}

export const REGULAR_MODEL: VillainModel = {
  id: 'regular',
  name: 'Solid regular (default)',
  // Tuned so a typical calling range defends close to MDF (a little over-folding vs big bets).
  continueVsHalfPot: { monster: 1, strong: 0.98, medium: 0.86, draw: 0.86, weak: 0.45, air: 0.08 },
  sizeElasticity: 1.3,
  betFreq: { monster: 0.75, strong: 0.7, medium: 0.35, draw: 0.5, weak: 0.1, air: 0 },
  bluffFactor: 1,
};

/** Default line model for hero's own range (used to narrow hero's range through earlier streets). */
export const HERO_LINE_MODEL: VillainModel = {
  ...REGULAR_MODEL,
  id: 'hero-line',
  name: 'Hero (standard lines)',
};

/** Extra bluffing room by street: draws make early-street bluffs cheaper. */
export const STREET_BLUFF_FACTOR = { flop: 1.6, turn: 1.25, river: 1 } as const;

export function continueProb(model: VillainModel, bucket: Bucket, betFraction: number, strongDraw = false): number {
  const base = strongDraw && bucket === 'draw' ? Math.max(model.continueVsHalfPot.draw, 0.95) : model.continueVsHalfPot[bucket];
  if (base >= 1) return 1;
  if (base <= 0) return 0;
  const scale = Math.pow(Math.max(betFraction, 0.01) / 0.5, model.sizeElasticity);
  return Math.pow(base, scale);
}

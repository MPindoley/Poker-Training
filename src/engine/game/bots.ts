/**
 * Bots that play from a player profile's stats: VPIP/PFR decide preflop ranges, the per-street
 * villain model decides how often each hand bucket bets, calls and folds postflop.
 */
import { COMBOS } from '../range';
import { classifyHand } from '../postflop/buckets';
import { preflopRanking } from '../preflop/ranking';
import { actionProbs, forStreet, type VillainModel } from '../strategy/villainModel';
import { STREET_BLUFF_FACTOR } from '../strategy/villainModel';
import { statsToModel, type ArchetypeId, type PlayerStats } from '../exploit/profiles';
import type { Rng } from '../rng';
import { legalActions, potSize, type HandState, type PlayerAction } from './holdem';

export interface BotProfile {
  name: string;
  archetype?: ArchetypeId;
  profileId?: string;
  stats: PlayerStats;
  model: VillainModel;
}

export function makeBot(name: string, stats: PlayerStats, archetype?: ArchetypeId, profileId?: string): BotProfile {
  return { name, archetype, profileId, stats, model: statsToModel(stats, profileId ?? `bot:${name}`, name) };
}

let percentileCache: Map<string, number> | null = null;
/** 0 = best hand, 1 = worst, by cumulative combos of the engine's preflop ranking. */
export function handPercentile(label: string): number {
  if (!percentileCache) {
    percentileCache = new Map();
    let acc = 0;
    for (const { label: l } of preflopRanking()) {
      const combos = l.length === 2 ? 6 : l.endsWith('s') ? 4 : 12;
      percentileCache.set(l, (acc + combos / 2) / 1326);
      acc += combos;
    }
  }
  return percentileCache.get(label) ?? 1;
}

export function holeLabel(hole: number[]): string {
  const [a, b] = [...hole].sort((x, y) => y - x) as [number, number];
  return COMBOS.find((c) => c.c1 === a && c.c2 === b)!.label;
}

const OPEN_SIZE: Partial<Record<ArchetypeId, number>> = { maniac: 4, gambler: 3.5, station: 2.5, nit: 3 };
const BET_SIZES: Partial<Record<ArchetypeId, [number, number]>> = {
  station: [0.33, 0.5],
  nit: [0.5, 0.66],
  maniac: [0.75, 1.25],
  efls: [0.33, 0.66],
  gambler: [0.66, 1],
  tag: [0.5, 0.75],
};

/**
 * Share of a bot's first-in RAISING hands it open-limps instead (on top of its normal limping range,
 * VPIP − PFR). Loose-passive home-game types limp a lot, so the limper spots come up at the table.
 */
export const OPEN_LIMP_SHARE: Partial<Record<ArchetypeId, number>> = { station: 0.5, efls: 0.5, gambler: 0.3 };

/** Preflop bet unit: the straddle when there is one, else the big blind. */
export function preflopUnit(s: HandState): number {
  const st = s.log.find((e) => e.type === 'post-straddle');
  return st ? Math.max(s.bb, st.to) : s.bb;
}

function raiseTo(_s: HandState, to: number): PlayerAction {
  return { type: 'raise', to };
}

export function botDecision(s: HandState, bot: BotProfile, rng: Rng): PlayerAction {
  const la = legalActions(s)!;
  const me = s.seats[la.seat]!;
  const st = bot.stats;
  const aggr = st.aggression;
  const pot = potSize(s);

  if (s.street === 'preflop') {
    const p = handPercentile(holeLabel(me.hole));
    const raises = s.log.filter((e) => e.street === 'preflop' && (e.type === 'raise' || e.type === 'bet')).length;
    const limpers = s.log.filter((e) => e.street === 'preflop' && e.type === 'call').length;
    const isBB = la.seat === s.bbSeat || la.seat === s.straddleSeat;
    const unit = preflopUnit(s);
    const bigShove = la.toCall >= 0.4 * (me.stack + me.bet);
    if (raises === 0) {
      const limpInstead = limpers === 0 && !isBB && rng() < (OPEN_LIMP_SHARE[bot.archetype ?? 'tag'] ?? 0);
      if (p < st.pfr && !limpInstead) return raiseTo(s, Math.max(la.minTo, unit * ((OPEN_SIZE[bot.archetype ?? 'tag'] ?? 3) + limpers)));
      if (p < st.vpip && !isBB) return { type: 'call' };
      return { type: la.canCheck ? 'check' : 'fold' };
    }
    if (bigShove) {
      const callWith = st.pfr * (bot.archetype === 'gambler' || bot.archetype === 'maniac' ? 1.2 : 0.45);
      return p < callWith ? { type: 'call' } : { type: 'fold' };
    }
    if (raises === 1) {
      const valueThree = st.pfr * 0.3;
      const bluffThree = aggr > 2.5 && rng() < (aggr - 2.5) / 8 && p < 0.55;
      if (p < valueThree || bluffThree) return raiseTo(s, s.currentBet * 3.2);
      const callWith = st.vpip * (st.pfr / st.vpip < 0.4 ? 0.75 : 0.55) + (isBB ? 0.1 : 0);
      return p < callWith ? { type: 'call' } : { type: 'fold' };
    }
    const fourBet = bot.archetype === 'maniac' || bot.archetype === 'gambler' ? 0.06 : 0.025;
    if (p < fourBet) return raiseTo(s, s.currentBet * 2.4);
    return p < fourBet + 0.04 + (st.vpip > 0.35 ? 0.04 : 0) ? { type: 'call' } : { type: 'fold' };
  }

  const street = s.street;
  const model = forStreet(bot.model, street);
  const info = classifyHand(me.hole[0]!, me.hole[1]!, s.board);
  const r = rng();
  if (la.toCall > 0) {
    const frac = la.toCall / Math.max(1, pot - la.toCall);
    // Same fold / call / raise model the coach and the trainers use (raises include check-raises).
    const p = actionProbs(model, info.bucket, frac, info.strongDraw);
    if (la.canRaise && r < p.raise) return raiseTo(s, s.currentBet * 3);
    return r < p.raise + p.call ? { type: 'call' } : { type: 'fold' };
  }
  const bluff = Math.min(0.6, 0.12 * model.bluffFactor * STREET_BLUFF_FACTOR[street]);
  const betP = info.bucket === 'air' ? bluff : info.bucket === 'weak' ? Math.max(model.betFreq.weak, bluff * 0.35) : model.betFreq[info.bucket];
  if (!la.canRaise || r >= betP) return { type: 'check' };
  const spr = me.stack / Math.max(1, pot);
  if (bot.archetype === 'gambler' && spr < 2.5) return raiseTo(s, la.maxTo);
  const [lo, hi] = BET_SIZES[bot.archetype ?? 'tag'] ?? [0.5, 0.75];
  const frac = lo + rng() * (hi - lo);
  return raiseTo(s, Math.max(la.minTo, Math.round(pot * frac * 2) / 2));
}

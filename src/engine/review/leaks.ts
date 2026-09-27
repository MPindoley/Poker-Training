/**
 * LEAK FINDER — groups graded decisions (from logged hands and played hands) into known leak
 * patterns and ranks them by estimated cost. Each rule is a readable predicate over a decision.
 */
import type { DecisionReview } from '../game/coach';

export interface LeakRule {
  id: string;
  title: string;
  description: string;
  /** Route of the drill pack that trains it. */
  drill: string;
  drillName: string;
  /** Is this decision an opportunity for the leak? */
  applies: (d: DecisionReview) => boolean;
  /** Did the player make the leaky choice? */
  leaked: (d: DecisionReview) => boolean;
}

const t = (d: DecisionReview) => d.tags;
const isMistake = (d: DecisionReview) => d.grade === 'mistake';

export const LEAK_RULES: LeakRule[] = [
  {
    id: 'turn-folds',
    title: 'Folding too often to turn bets',
    description: 'You fold on the turn when the price and your equity say continue.',
    drill: '/train/postflop/play?theme=facing',
    drillName: 'Facing bets',
    applies: (d) => d.street === 'turn' && !!t(d)?.facingBet,
    leaked: (d) => t(d)?.actionType === 'fold' && isMistake(d),
  },
  {
    id: 'small-value',
    title: 'Betting too small for value',
    description: 'Your strong hands bet smaller than the size that earns the most.',
    drill: '/train/postflop/play?theme=value',
    drillName: 'Value betting',
    applies: (d) => d.street !== 'preflop' && !t(d)?.facingBet && (t(d)?.bucket === 'monster' || t(d)?.bucket === 'strong') && (t(d)?.actionType === 'bet' || t(d)?.actionType === 'check'),
    leaked: (d) =>
      d.grade !== 'best' &&
      (t(d)?.actionType === 'check' || ((t(d)?.chosenFraction ?? 0) + 0.05 < (t(d)?.bestFraction ?? 0))),
  },
  {
    id: 'blind-calls',
    title: 'Calling too wide from the blinds',
    description: 'You defend hands from the blinds that the charts fold.',
    drill: '/train/preflop/play?kind=preflop.defense&d=silver',
    drillName: 'Blind Defense',
    applies: (d) => d.street === 'preflop' && (t(d)?.heroPos === 'SB' || t(d)?.heroPos === 'BB') && t(d)?.preflopKind === 'vsOpen',
    leaked: (d) => t(d)?.actionType === 'call' && isMistake(d),
  },
  {
    id: 'bluff-callers',
    title: 'Bluffing into calling stations',
    description: 'You bet weak hands into players who rarely fold.',
    drill: '/train/exploit/play?pack=compare',
    drillName: 'Exploit Lab: same spot, 3 opponents',
    applies: (d) => d.street !== 'preflop' && !t(d)?.facingBet && ['air', 'weak', 'draw'].includes(t(d)?.bucket ?? '') && (t(d)?.villainArchetype === 'station' || (t(d)?.villainFoldRiver ?? 1) < 0.3),
    leaked: (d) => t(d)?.actionType === 'bet' && isMistake(d),
  },
  {
    id: 'river-calls',
    title: 'Calling river bets too light',
    description: 'You pay off river bets without the equity the price requires.',
    drill: '/train/postflop/play?theme=facing',
    drillName: 'Facing bets',
    applies: (d) => d.street === 'river' && !!t(d)?.facingBet,
    leaked: (d) => t(d)?.actionType === 'call' && isMistake(d),
  },
  {
    id: 'open-limps',
    title: 'Open-limping',
    description: 'You limp first in instead of raising or folding.',
    drill: '/train/preflop/play?kind=preflop.flash&d=silver',
    drillName: 'Preflop flash cards',
    applies: (d) => d.street === 'preflop' && t(d)?.preflopKind === 'rfi',
    leaked: (d) => t(d)?.actionType === 'call' && isMistake(d),
  },
];

export interface Leak {
  rule: LeakRule;
  opportunities: number;
  count: number;
  /** Fraction of opportunities where you leaked. */
  rate: number;
  /** Estimated bb lost (sum of EV lost where the engine could compute it). */
  cost: number;
  /** Leaks whose cost couldn't be computed for some hands. */
  uncosted: number;
}

export function findLeaks(decisions: DecisionReview[]): Leak[] {
  return LEAK_RULES.map((rule) => {
    const opps = decisions.filter(rule.applies);
    const hits = opps.filter(rule.leaked);
    const cost = hits.reduce((a, d) => a + (d.evLost ?? 0), 0);
    return {
      rule,
      opportunities: opps.length,
      count: hits.length,
      rate: opps.length ? hits.length / opps.length : 0,
      cost: Math.round(cost * 100) / 100,
      uncosted: hits.filter((d) => d.evLost === null).length,
    };
  })
    .filter((l) => l.count > 0)
    .sort((a, b) => b.cost - a.cost || b.count - a.count);
}

/**
 * Classify a preflop decision from the actions before it: first in, behind limpers, squeeze,
 * limped-and-raised, facing a 3-bet or a 4-bet. Works for any number of players (actors are ids).
 */
export type PreflopDecisionKind = 'rfi' | 'vsLimpers' | 'vsOpen' | 'squeeze' | 'vsLimpRaise' | 'vs3bet' | 'vs4bet' | 'none';

export interface PreflopAct {
  actor: string;
  type: 'fold' | 'check' | 'call' | 'bet' | 'raise';
}

export interface PreflopDecision {
  kind: PreflopDecisionKind;
  /** Limpers (vsLimpers) or callers of the open (squeeze). */
  count: number;
  /** Actor who made the first raise (the opener), if any. */
  opener?: string;
}

/**
 * @param prior preflop actions before hero's decision, in order (no blind posts)
 * @param extraLimpers limpers that happened but weren't logged (e.g. "3 limpers" context)
 */
export function classifyPreflopDecision(prior: readonly PreflopAct[], hero: string, extraLimpers = 0): PreflopDecision {
  const raises = prior.filter((a) => a.type === 'raise' || a.type === 'bet');
  const firstRaise = prior.findIndex((a) => a.type === 'raise' || a.type === 'bet');
  const beforeRaise = firstRaise < 0 ? prior : prior.slice(0, firstRaise);
  const limpers = beforeRaise.filter((a) => a.type === 'call' && a.actor !== hero).length + extraLimpers;
  const heroLimped = beforeRaise.some((a) => a.actor === hero && a.type === 'call');
  const opener = raises[0]?.actor;
  if (raises.length === 0) return limpers > 0 ? { kind: 'vsLimpers', count: limpers } : { kind: 'rfi', count: 0 };
  if (raises.length === 1) {
    if (heroLimped) return { kind: 'vsLimpRaise', count: 0, opener };
    if (opener === hero) return { kind: 'none', count: 0, opener };
    const callers = prior.slice(firstRaise + 1).filter((a) => a.type === 'call').length;
    return callers > 0 ? { kind: 'squeeze', count: callers, opener } : { kind: 'vsOpen', count: 0, opener };
  }
  if (raises.length === 2 && raises[0]!.actor === hero) return { kind: 'vs3bet', count: 0, opener };
  if (raises.length === 3 && raises[1]!.actor === hero) return { kind: 'vs4bet', count: 0, opener };
  return { kind: 'none', count: 0, opener };
}

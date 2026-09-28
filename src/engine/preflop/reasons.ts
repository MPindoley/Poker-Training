/**
 * One-line reasons for preflop answers. Template text only — every number passed in is computed.
 */
import { formatPercent } from '../math';
import { hitProbability } from '../odds';
import { parseRange } from '../range';
import { handGroup, type HandGroup } from './groups';
import type { PreflopAction } from './charts';

const VALUE_3BET = parseRange('TT+, AQs+, AKo');

export function isValueHand(label: string): boolean {
  return parseRange(label).weights.some((w, i) => w > 0 && VALUE_3BET.weights[i]! > 0);
}

function groupTail(group: HandGroup): string {
  switch (group) {
    case 'pairs':
      return ` Small and middle pairs mostly win by flopping a set (${formatPercent(hitProbability(2, 50, 3))} of flops).`;
    case 'suited-connectors':
      return ' Suited connectors need position and deep stacks to realize their equity.';
    case 'broadways':
      return ' Offsuit broadways get dominated by the hands that continue against them.';
    case 'suited-aces':
      return ' Suited aces make the nut flush and block villain’s strongest aces.';
    case 'offsuit-aces':
      return ' Weak offsuit aces are often dominated by better aces.';
    case 'suited-other':
      return ' Weak suited hands mostly play for flushes and need position.';
    default:
      return ' Offsuit hands without high cards rarely flop well enough to continue.';
  }
}

export const ACTION_NAMES: Record<PreflopAction, string> = {
  raise: 'Raise',
  limp: 'Limp',
  fold: 'Fold',
  call: 'Call',
  '3bet': '3-bet',
  '4bet': '4-bet',
  '5bet': '5-bet all-in',
  check: 'Check',
};

export interface ReasonInput {
  kind: 'rfi' | 'vsOpen' | 'vs3bet' | 'vsLimpers' | 'squeeze' | 'vsLimpRaise' | 'vs4bet';
  /** Limpers (vsLimpers) or callers (squeeze) before hero. */
  count?: number;
  /** Effective stack in big blinds (vs4bet wording). */
  stackBb?: number;
  label: string;
  seat: string;
  opener?: string;
  best: PreflopAction;
  chosen: PreflopAction | null;
  /** Fraction of all hands the relevant range contains (e.g. the RFI range). */
  rangeFraction: number;
  playersBehind: number;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function homeSpotReason(r: ReasonInput): string {
  const group = handGroup(r.label);
  const n = r.count ?? 1;
  const where = r.seat === 'BTN' ? 'on the button' : r.seat === 'SB' ? 'from the small blind' : r.seat === 'BB' ? 'in the big blind' : `from ${r.seat}`;
  const setChance = formatPercent(hitProbability(2, 50, 3));
  if (r.kind === 'vsLimpers') {
    const limpers = `${plural(n, 'limper')}${n >= 3 ? ' or more' : ''}`;
    if (r.best === 'raise') {
      if (r.chosen === 'limp') return `Overlimping ${r.label} wastes a hand that dominates limping ranges: iso-raise ${where} to play heads-up with the initiative.`;
      if (r.chosen === 'check') return `${r.label} is strong enough to raise for value against ${limpers} — checking lets them all see a cheap flop.`;
      return `${r.label} iso-raises over ${limpers} ${where}: it plays well heads-up with the initiative and dominates the hands that limp.`;
    }
    if (r.best === 'limp') {
      const verb = r.seat === 'SB' ? 'completes' : 'overlimps';
      if (group === 'pairs') return `${r.label} ${verb} behind ${limpers} ${where}: it wants a cheap multi-way flop to hit a set (${setChance} of flops).`;
      if (group === 'suited-connectors' || group === 'suited-other') return `${r.label} ${verb} behind ${limpers} ${where}: it plays well multi-way, making straights and flushes that win big pots.`;
      if (group === 'suited-aces') return `${r.label} ${verb} behind ${limpers} ${where}: it makes the nut flush, which gets paid multi-way, but is too weak to isolate.`;
      return `${r.label} ${verb} behind ${limpers} ${where}: the price is good and it can make strong hands, but it is too weak to raise.`;
    }
    if (r.best === 'check') return `${r.label} checks its option: not strong enough to raise into ${limpers}, and the flop is free.`;
    if (group === 'broadways' || group === 'offsuit-aces')
      return `${r.label} folds to ${limpers} ${where}: offsuit hands flop weak one-pair hands multi-way and get dominated.`;
    return `${r.label} folds to ${limpers} ${where}: too weak to isolate, and not the kind of hand that wins big multi-way pots.`;
  }
  if (r.kind === 'squeeze') {
    const callers = plural(n, 'caller');
    if (r.best === '3bet')
      return isValueHand(r.label)
        ? `${r.label} squeezes for value against an open and ${callers}: the dead money in the pot and your strong hand both reward a big raise.`
        : `${r.label} is a squeeze bluff: it blocks the strongest hands and the caller${n === 1 ? '' : 's'} rarely hold hands that can continue.`;
    if (r.best === 'call') return `${r.label} calls an open with ${callers} in: it plays well in a multi-way pot but isn't strong enough to squeeze for value.`;
    return `${r.label} folds to an open and ${callers}: against several ranges it is dominated too often and is not a good squeeze.`;
  }
  if (r.kind === 'vsLimpRaise') {
    if (r.best === 'call') return `${r.label} can call the raise after limping: it plays well multi-way and the limpers behind improve your price.`;
    if (r.best === '3bet') return `${r.label} limp-3-bets for value.`;
    return `Limp-fold ${r.label}: limping ranges are weak, and calling raises out of the limp with them loses money. This is why iso-or-fold beats limping.`;
  }
  // vs4bet
  const deep = (r.stackBb ?? 100) <= 60;
  if (r.best === '5bet') return `${r.label} goes all-in over the 4-bet: it is at the top of your 3-bet range${deep ? ' and at this stack depth there is no room to call and fold later' : ''}.`;
  if (r.best === 'call') return `${r.label} calls the 4-bet: strong enough to continue, but going all-in only gets called by better.`;
  return `${r.label} folds to the 4-bet: a 4-bet range is very strong, and ${r.label} is behind most of it.`;
}

export function preflopReason(r: ReasonInput): string {
  if (r.kind === 'vsLimpers' || r.kind === 'squeeze' || r.kind === 'vsLimpRaise' || r.kind === 'vs4bet') return homeSpotReason(r);
  const tail = groupTail(handGroup(r.label));
  const pct = formatPercent(r.rangeFraction, 0);
  if (r.kind === 'rfi') {
    if (r.best === 'raise') {
      if (r.chosen === 'limp') return `${r.label} is a standard open from ${r.seat}; limping invites a multi-way pot it plays badly in.`;
      if (r.chosen === 'fold') return `${r.label} is strong enough to open from ${r.seat} — it is inside the ${pct} of hands this seat opens.${tail}`;
      return `${r.label} is a standard open from ${r.seat} (the range is ${pct} of hands).`;
    }
    if (r.chosen === 'limp') return `Limping ${r.label} from ${r.seat} builds a pot with a hand that should just be folded here.`;
    return `${r.label} is outside the ${r.seat} opening range (${pct} of hands) with ${r.playersBehind} player${r.playersBehind === 1 ? '' : 's'} left to act.${tail}`;
  }
  const vs = r.kind === 'vsOpen' ? `a ${r.opener} open` : 'a 3-bet';
  if (r.best === '3bet' || r.best === '4bet') {
    const verb = r.best === '3bet' ? '3-bet' : '4-bet';
    return isValueHand(r.label)
      ? `${r.label} is strong enough to ${verb} for value against ${vs}.`
      : `${r.label} is a good ${verb} bluff against ${vs}: it has blockers or playability and gets better hands to fold.`;
  }
  if (r.best === 'call') return `${r.label} plays well enough against ${vs} to call, but isn’t strong enough to raise for value.${r.seat === 'BB' ? ' The big blind also gets a discount.' : ''}`;
  return `${r.label} is dominated too often by ${vs} (the continuing range is ${pct} of hands); fold.${tail}`;
}

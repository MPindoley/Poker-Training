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
};

export interface ReasonInput {
  kind: 'rfi' | 'vsOpen' | 'vs3bet';
  label: string;
  seat: string;
  opener?: string;
  best: PreflopAction;
  chosen: PreflopAction | null;
  /** Fraction of all hands the relevant range contains (e.g. the RFI range). */
  rangeFraction: number;
  playersBehind: number;
}

export function preflopReason(r: ReasonInput): string {
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

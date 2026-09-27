/** Hand groups used for tracking weak spots, e.g. "suited connectors". */
import { RANKS } from '../cards';
import { handClassByLabel } from '../hands';

export type HandGroup = 'pairs' | 'suited-aces' | 'broadways' | 'suited-connectors' | 'suited-other' | 'offsuit-aces' | 'offsuit-junk';

export const HAND_GROUPS: readonly HandGroup[] = ['pairs', 'suited-aces', 'broadways', 'suited-connectors', 'suited-other', 'offsuit-aces', 'offsuit-junk'];

export const HAND_GROUP_NAMES: Record<HandGroup, string> = {
  pairs: 'Pairs',
  'suited-aces': 'Suited aces',
  broadways: 'Broadways',
  'suited-connectors': 'Suited connectors',
  'suited-other': 'Other suited',
  'offsuit-aces': 'Offsuit aces',
  'offsuit-junk': 'Offsuit junk',
};

const idx = (r: string) => RANKS.indexOf(r as (typeof RANKS)[number]);

export function handGroup(label: string): HandGroup {
  const h = handClassByLabel(label);
  if (h.kind === 'pair') return 'pairs';
  const hi = idx(h.high);
  const lo = idx(h.low);
  if (h.kind === 'suited' && h.high === 'A') return 'suited-aces';
  if (lo >= 8) return 'broadways'; // both T or higher
  if (h.kind === 'suited') return hi - lo <= 3 ? 'suited-connectors' : 'suited-other';
  if (h.high === 'A') return 'offsuit-aces';
  return 'offsuit-junk';
}

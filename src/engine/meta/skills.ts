/**
 * Skill areas for the Profile radar, Daily Training and mixed sessions. Every drill kind maps to
 * exactly one area; an area's score is its accuracy shrunk toward 50% until there is enough data.
 */
import { THEME_NAMES } from '../postflop/scenario';

export type SkillArea = 'math' | 'preflop' | 'postflop' | 'exploits' | 'reading';

export const SKILL_AREAS: readonly SkillArea[] = ['math', 'preflop', 'postflop', 'exploits', 'reading'];

export const AREA_NAMES: Record<SkillArea, string> = {
  math: 'Math',
  preflop: 'Preflop',
  postflop: 'Postflop',
  exploits: 'Exploits',
  reading: 'Hand Reading',
};

export interface TrainableKind {
  kind: string;
  title: string;
  area: SkillArea;
}

/** Every drill kind that Daily Training and mixed sessions can send the player to. */
export const TRAINABLE_KINDS: readonly TrainableKind[] = [
  { kind: 'math.outs', title: 'Count the Outs', area: 'math' },
  { kind: 'math.rule24', title: 'Rule of 2 & 4', area: 'math' },
  { kind: 'math.potodds', title: 'Pot Odds', area: 'math' },
  { kind: 'math.callfold', title: 'Call or Fold', area: 'math' },
  { kind: 'math.bluff', title: 'Bluff Math', area: 'math' },
  { kind: 'math.mdf', title: 'Minimum Defense', area: 'math' },
  { kind: 'math.ev', title: 'EV Calculator', area: 'math' },
  { kind: 'math.combos', title: 'Combo Counting', area: 'reading' },
  { kind: 'preflop.flash', title: 'Flash Cards', area: 'preflop' },
  { kind: 'preflop.ladder', title: 'Seat Ladder', area: 'preflop' },
  { kind: 'preflop.sizing', title: 'Sizing', area: 'preflop' },
  { kind: 'preflop.defense', title: 'Blind Defense', area: 'preflop' },
  { kind: 'preflop.limpers', title: 'Limpers', area: 'preflop' },
  { kind: 'preflop.squeeze', title: 'Squeeze', area: 'preflop' },
  { kind: 'preflop.vs4bet', title: 'Facing 4-bets', area: 'preflop' },
  { kind: 'postflop.cbet', title: THEME_NAMES.cbet, area: 'postflop' },
  { kind: 'postflop.value', title: THEME_NAMES.value, area: 'postflop' },
  { kind: 'postflop.bluff', title: THEME_NAMES.bluff, area: 'postflop' },
  { kind: 'postflop.facing', title: THEME_NAMES.facing, area: 'postflop' },
  { kind: 'postflop.short', title: THEME_NAMES.short, area: 'postflop' },
  { kind: 'postflop.checkraise', title: THEME_NAMES.checkraise, area: 'postflop' },
  { kind: 'postflop.turn', title: THEME_NAMES.turn, area: 'postflop' },
  { kind: 'postflop.river', title: THEME_NAMES.river, area: 'postflop' },
  { kind: 'postflop.multiway', title: THEME_NAMES.multiway, area: 'postflop' },
  { kind: 'postflop.reading', title: THEME_NAMES.reading, area: 'reading' },
  { kind: 'exploit.efls', title: 'Early Folder, Late Sticker', area: 'exploits' },
  { kind: 'exploit.image', title: 'Your Table Image', area: 'exploits' },
  { kind: 'exploit.imageShift', title: 'Image Shifts', area: 'exploits' },
];

/** Area a drill kind counts toward (null for kinds outside the radar). */
export function areaOfKind(kind: string): SkillArea | null {
  const known = TRAINABLE_KINDS.find((k) => k.kind === kind);
  if (known) return known.area;
  if (kind === 'preflop.paint' || kind.startsWith('preflop.')) return 'preflop';
  if (kind.startsWith('math.')) return 'math';
  if (kind.startsWith('postflop.')) return 'postflop';
  if (kind.startsWith('exploit.')) return 'exploits';
  return null;
}

export interface AttemptTally {
  attempts: number;
  correct: number;
}

/** Answers needed before an area's score is shown as confident. */
export const CONFIDENT_ATTEMPTS = 20;
/** Pseudo-answers at 50% blended in, so two lucky answers don't read as 100%. */
export const PRIOR_ANSWERS = 4;

/** Accuracy shrunk toward 50%: (correct + 0.5·prior) / (attempts + prior). */
export function smoothedAccuracy(t: AttemptTally): number {
  return (t.correct + 0.5 * PRIOR_ANSWERS) / (t.attempts + PRIOR_ANSWERS);
}

export interface AreaScore extends AttemptTally {
  area: SkillArea;
  /** 0..1, smoothed accuracy. */
  score: number;
  /** Raw accuracy, or null with no answers. */
  accuracy: number | null;
  confident: boolean;
}

export function skillRadar(kinds: Readonly<Record<string, AttemptTally>>): Record<SkillArea, AreaScore> {
  const out = {} as Record<SkillArea, AreaScore>;
  for (const area of SKILL_AREAS) out[area] = { area, attempts: 0, correct: 0, score: 0, accuracy: null, confident: false };
  for (const [kind, t] of Object.entries(kinds)) {
    const area = areaOfKind(kind);
    if (!area) continue;
    out[area].attempts += t.attempts;
    out[area].correct += t.correct;
  }
  for (const a of SKILL_AREAS) {
    const s = out[a];
    s.score = smoothedAccuracy(s);
    s.accuracy = s.attempts ? s.correct / s.attempts : null;
    s.confident = s.attempts >= CONFIDENT_ATTEMPTS;
  }
  return out;
}

/**
 * Areas from weakest to strongest. Lower smoothed score first; ties go to the area with fewer answers
 * (less practised), then to `tiebreak` order.
 */
export function weakestAreas(radar: Record<SkillArea, AreaScore>, tiebreak: readonly SkillArea[] = SKILL_AREAS): SkillArea[] {
  return [...SKILL_AREAS].sort(
    (a, b) => radar[a].score - radar[b].score || radar[a].attempts - radar[b].attempts || tiebreak.indexOf(a) - tiebreak.indexOf(b),
  );
}

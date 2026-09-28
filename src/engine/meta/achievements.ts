/** Achievements: pure checks over a snapshot of the player's saved progress. */
import { SKILL_AREAS, skillRadar, type AttemptTally } from './skills';
import { EQUITY_GUESS_BEST } from '../lab/lab';

export interface AchievementSnapshot {
  level: number;
  /** Best daily streak ever reached. */
  bestDayStreak: number;
  /** Per drill kind totals. */
  kinds: Readonly<Record<string, AttemptTally>>;
  /** Longest run of non-mistake answers per drill kind, across rounds. */
  bestRuns: Readonly<Record<string, number>>;
  /** Best Paint-the-Range accuracy per chart and seat: paintBest[chartId][seat] = 0..1. */
  paintBest: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** Opening seats per chart id. */
  paintSeats: Readonly<Record<string, readonly string[]>>;
  lessonsDone: number;
  lessonsTotal: number;
  perfectRounds: number;
  /** Diamond rounds finished with at least 80% right. */
  diamondRounds: number;
  tableHands: number;
  loggedHands: number;
  cosmeticsOwned: number;
  dailyTasksDone: number;
  /** Hands tracked at the live table tracker (optional: older callers omit it). */
  liveHands?: number;
  /** Range Lab guesses within EQUITY_GUESS_BEST of the real equity. */
  labGoodGuesses?: number;
}

export const ISO_KING_CORRECT = 50;
export const SCOUT_HANDS = 100;
export const EQUITY_EYE_GUESSES = 20;

export interface Achievement {
  id: string;
  name: string;
  description: string;
  /** Awards a reward chest when unlocked. */
  chest: boolean;
  /** 0..1; unlocked at 1. */
  progress: (s: AchievementSnapshot) => number;
}

const ratio = (have: number, need: number) => Math.min(1, Math.max(0, have / need));
const totalAnswers = (s: AchievementSnapshot) => Object.values(s.kinds).reduce((n, t) => n + t.attempts, 0);

/** Best fraction of a chart's seats painted at ≥ threshold, over all charts. */
export function paintCoverage(s: Pick<AchievementSnapshot, 'paintBest' | 'paintSeats'>, threshold: number): number {
  let best = 0;
  for (const [chart, seats] of Object.entries(s.paintSeats)) {
    if (!seats.length) continue;
    const scores = s.paintBest[chart] ?? {};
    best = Math.max(best, seats.filter((seat) => (scores[seat] ?? 0) >= threshold).length / seats.length);
  }
  return best;
}

export const RANGE_MASTER_ACCURACY = 0.95;
export const POT_ODDS_PRO_RUN = 50;
export const ALL_ROUNDER_ACCURACY = 0.7;
export const ALL_ROUNDER_ANSWERS = 20;

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-steps', name: 'First Steps', description: 'Answer your first drill question', chest: false, progress: (s) => ratio(totalAnswers(s), 1) },
  {
    id: 'pot-odds-pro',
    name: 'Pot Odds Pro',
    description: `${POT_ODDS_PRO_RUN} correct Pot Odds answers in a row`,
    chest: true,
    progress: (s) => ratio(s.bestRuns['math.potodds'] ?? 0, POT_ODDS_PRO_RUN),
  },
  {
    id: 'range-master',
    name: 'Range Master',
    description: `Paint every opening seat of a chart with ${Math.round(RANGE_MASTER_ACCURACY * 100)}% accuracy or better`,
    chest: true,
    progress: (s) => paintCoverage(s, RANGE_MASTER_ACCURACY),
  },
  { id: 'outs-counter', name: 'Outs Counter', description: '25 correct Count the Outs answers in a row', chest: false, progress: (s) => ratio(s.bestRuns['math.outs'] ?? 0, 25) },
  { id: 'flawless', name: 'Flawless', description: 'Finish a round without a mistake', chest: false, progress: (s) => ratio(s.perfectRounds, 1) },
  { id: 'perfectionist', name: 'Perfectionist', description: 'Finish 10 rounds without a mistake', chest: true, progress: (s) => ratio(s.perfectRounds, 10) },
  { id: 'diamond-mind', name: 'Diamond Mind', description: 'Score 80% or better on a Diamond round', chest: true, progress: (s) => ratio(s.diamondRounds, 1) },
  { id: 'streak-3', name: 'Warming Up', description: 'Practise 3 days in a row', chest: false, progress: (s) => ratio(s.bestDayStreak, 3) },
  { id: 'streak-7', name: 'Week Warrior', description: 'Practise 7 days in a row', chest: true, progress: (s) => ratio(s.bestDayStreak, 7) },
  { id: 'streak-30', name: 'Iron Grinder', description: 'Practise 30 days in a row', chest: true, progress: (s) => ratio(s.bestDayStreak, 30) },
  { id: 'daily-10', name: 'Daily Devotion', description: 'Complete 10 daily tasks', chest: false, progress: (s) => ratio(s.dailyTasksDone, 10) },
  { id: 'volume-500', name: 'Volume Player', description: 'Answer 500 drill questions', chest: true, progress: (s) => ratio(totalAnswers(s), 500) },
  { id: 'level-10', name: 'Card Room Regular', description: 'Reach level 10', chest: true, progress: (s) => ratio(s.level, 10) },
  { id: 'level-20', name: 'High Roller', description: 'Reach level 20', chest: true, progress: (s) => ratio(s.level, 20) },
  { id: 'scholar', name: 'Scholar', description: 'Complete every lesson in Learn', chest: true, progress: (s) => (s.lessonsTotal ? ratio(s.lessonsDone, s.lessonsTotal) : 0) },
  { id: 'table-100', name: 'Seat Warmer', description: 'Play 100 hands at the Play table', chest: false, progress: (s) => ratio(s.tableHands, 100) },
  { id: 'logger-10', name: 'Honest Notebook', description: 'Log 10 real hands in Review', chest: false, progress: (s) => ratio(s.loggedHands, 10) },
  { id: 'collector', name: 'Collector', description: 'Own 12 cosmetics', chest: false, progress: (s) => ratio(s.cosmeticsOwned, 12) },
  {
    id: 'iso-king',
    name: 'Iso King',
    description: `${ISO_KING_CORRECT} correct limper spots`,
    chest: true,
    progress: (s) => ratio(s.kinds['preflop.limpers']?.correct ?? 0, ISO_KING_CORRECT),
  },
  { id: 'scout', name: 'Scout', description: `Track ${SCOUT_HANDS} hands live`, chest: true, progress: (s) => ratio(s.liveHands ?? 0, SCOUT_HANDS) },
  {
    id: 'equity-eye',
    name: 'Equity Eye',
    description: `${EQUITY_EYE_GUESSES} Range Lab guesses within ${Math.round(EQUITY_GUESS_BEST * 100)} points`,
    chest: true,
    progress: (s) => ratio(s.labGoodGuesses ?? 0, EQUITY_EYE_GUESSES),
  },
  {
    id: 'all-rounder',
    name: 'All-Rounder',
    description: `${Math.round(ALL_ROUNDER_ACCURACY * 100)}%+ accuracy in every skill area (${ALL_ROUNDER_ANSWERS}+ answers each)`,
    chest: true,
    progress: (s) => {
      const radar = skillRadar(s.kinds);
      const ok = SKILL_AREAS.filter((a) => radar[a].attempts >= ALL_ROUNDER_ANSWERS && (radar[a].accuracy ?? 0) >= ALL_ROUNDER_ACCURACY).length;
      return ok / SKILL_AREAS.length;
    },
  },
];

/** Ids of achievements whose progress is complete. */
export function unlockedAchievements(s: AchievementSnapshot): string[] {
  return ACHIEVEMENTS.filter((a) => a.progress(s) >= 1).map((a) => a.id);
}

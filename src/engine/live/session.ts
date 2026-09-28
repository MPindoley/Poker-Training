/**
 * Live table tracker: record reads at the table with one tap each, turn them into observed stats
 * with sample sizes, and move saved profiles toward them (small samples move them only a little).
 */
import { applyObservation, type PlayerStats, type Profile } from '../exploit/profiles';

export type LiveEventType =
  | 'hand'
  | 'vpip'
  | 'pfr'
  | 'limp'
  | 'threebet'
  | 'foldCbet'
  | 'callCbet'
  | 'raiseCbet'
  | 'foldTurn'
  | 'callTurn'
  | 'foldRiver'
  | 'callRiver'
  | 'showdown'
  | 'showedBluff'
  | 'showedMonster';

export const LIVE_EVENT_LABELS: Record<Exclude<LiveEventType, 'hand'>, string> = {
  vpip: 'Played',
  pfr: 'Raised pre',
  limp: 'Limped',
  threebet: '3-bet',
  foldCbet: 'Fold to c-bet',
  callCbet: 'Call c-bet',
  raiseCbet: 'Raise c-bet',
  foldTurn: 'Fold turn',
  callTurn: 'Call turn',
  foldRiver: 'Fold river',
  callRiver: 'Call river',
  showdown: 'Showdown',
  showedBluff: 'Showed bluff',
  showedMonster: 'Showed monster',
};

export interface LivePlayer {
  id: string;
  seat: string;
  name: string;
  profileId?: string;
  /** Hand number when they sat down (for per-player hand counts). */
  joinedHand: number;
  /** Hand number when they left, if they did. */
  leftHand?: number;
}

export interface LiveEvent {
  id: number;
  type: LiveEventType;
  /** Player id ('' for a hand dealt). */
  player: string;
  hand: number;
  at: number;
}

export interface LiveBookmark {
  id: string;
  hand: number;
  at: number;
  /** Seats and players at the time, so the hand logger can be pre-filled. */
  players: { id: string; seat: string; name: string; profileId?: string }[];
  logged?: boolean;
}

export interface LiveSession {
  id: string;
  startedAt: number;
  venue: 'home' | 'casino';
  smallBlind: number;
  bigBlind: number;
  buyIn: number;
  heroSeat: string;
  players: LivePlayer[];
  /** Hands dealt so far (the first hand is 1). */
  handNo: number;
  events: LiveEvent[];
  bookmarks: LiveBookmark[];
  endedAt?: number;
}

export function createLiveSession(opts: Omit<LiveSession, 'id' | 'startedAt' | 'handNo' | 'events' | 'bookmarks' | 'players'> & { players: Omit<LivePlayer, 'joinedHand'>[] }, now = Date.now()): LiveSession {
  return {
    ...opts,
    id: `live-${now.toString(36)}`,
    startedAt: now,
    handNo: 1,
    players: opts.players.map((p) => ({ ...p, joinedHand: 1 })),
    events: [],
    bookmarks: [],
  };
}

let seq = 0;
/** Record one tap. 'hand' advances the hand counter (the denominator for VPIP / PFR). */
export function addEvent(s: LiveSession, type: LiveEventType, player = '', now = Date.now()): LiveSession {
  const e: LiveEvent = { id: now * 1000 + (seq++ % 1000), type, player, hand: s.handNo, at: now };
  return { ...s, handNo: type === 'hand' ? s.handNo + 1 : s.handNo, events: [...s.events, e] };
}

/** Undo the last tap (for a player, or the last tap at all). */
export function undoLast(s: LiveSession, player?: string): LiveSession {
  const idx = player === undefined ? s.events.length - 1 : s.events.map((e) => e.player).lastIndexOf(player);
  if (idx < 0) return s;
  const e = s.events[idx]!;
  return { ...s, handNo: e.type === 'hand' ? s.handNo - 1 : s.handNo, events: s.events.filter((_, i) => i !== idx) };
}

export function addPlayer(s: LiveSession, p: Omit<LivePlayer, 'joinedHand'>): LiveSession {
  return { ...s, players: [...s.players.filter((x) => x.seat !== p.seat || x.leftHand !== undefined), { ...p, joinedHand: s.handNo }] };
}

export function removePlayer(s: LiveSession, id: string): LiveSession {
  return { ...s, players: s.players.map((p) => (p.id === id ? { ...p, leftHand: s.handNo } : p)) };
}

export function bookmarkHand(s: LiveSession, now = Date.now()): LiveSession {
  const players = s.players.filter((p) => p.leftHand === undefined).map((p) => ({ id: p.id, seat: p.seat, name: p.name, profileId: p.profileId }));
  return { ...s, bookmarks: [...s.bookmarks, { id: `bm-${now.toString(36)}`, hand: s.handNo, at: now, players }] };
}

/** Hands a player was seated for. */
export function handsFor(s: LiveSession, playerId: string): number {
  const p = s.players.find((x) => x.id === playerId);
  if (!p) return 0;
  const end = p.leftHand ?? s.handNo;
  return Math.max(0, end - p.joinedHand);
}

export interface ObservedStat {
  value: number;
  hits: number;
  n: number;
  /** Enough samples to take seriously (n ≥ CONFIDENT_SAMPLES). */
  confident: boolean;
}

/** Samples before an observed stat counts as confident. */
export const CONFIDENT_SAMPLES = 10;

export type ObservedStats = Partial<Record<keyof PlayerStats, ObservedStat>>;

const stat = (hits: number, n: number): ObservedStat | undefined => (n > 0 ? { value: hits / n, hits, n, confident: n >= CONFIDENT_SAMPLES } : undefined);

/**
 * Observed stats for one player, each with its sample size:
 * - VPIP, PFR: taps / hands dealt while seated.
 * - Fold to c-bet / turn / river: folds / (folds + calls + raises) at that street.
 * - WTSD: showdowns / hands played (VPIP) — an approximation (we don't track who saw the flop).
 * - Aggression: (preflop raises + 3-bets + raises vs c-bets) / (limps + calls) — an approximation.
 */
export function computeObservedStats(s: LiveSession, playerId: string): ObservedStats {
  const ev = s.events.filter((e) => e.player === playerId);
  // No taps for this player: they weren't tracked, so there is nothing to observe (not "0 of N").
  if (!ev.length) return {};
  const count = (t: LiveEventType) => ev.filter((e) => e.type === t).length;
  const hands = handsFor(s, playerId);
  const vpip = count('vpip');
  const out: ObservedStats = {};
  const put = (k: keyof PlayerStats, o: ObservedStat | undefined) => {
    if (o) out[k] = o;
  };
  put('vpip', stat(vpip, hands));
  put('pfr', stat(count('pfr'), hands));
  put('foldToCbet', stat(count('foldCbet'), count('foldCbet') + count('callCbet') + count('raiseCbet')));
  put('foldToTurnBet', stat(count('foldTurn'), count('foldTurn') + count('callTurn')));
  put('foldToRiverBet', stat(count('foldRiver'), count('foldRiver') + count('callRiver')));
  put('wtsd', stat(count('showdown'), vpip));
  const aggressive = count('pfr') + count('threebet') + count('raiseCbet');
  const passive = count('limp') + count('callCbet') + count('callTurn') + count('callRiver');
  if (aggressive + passive > 0) out.aggression = { value: passive ? aggressive / passive : aggressive, hits: aggressive, n: aggressive + passive, confident: aggressive + passive >= CONFIDENT_SAMPLES };
  return out;
}

/**
 * Move a profile toward a session's observations. Each stat moves by its own sample size through
 * applyObservation (weight n / (n + DRIFT_K)), so 3 observations barely move it and 30 move it a lot.
 * A session with no observations returns the same profile.
 */
export function applySession(profile: Profile, observed: ObservedStats, handsSeen: number, now = Date.now()): Profile {
  const entries = Object.entries(observed) as [keyof PlayerStats, ObservedStat][];
  if (!entries.length) return profile;
  let p = profile;
  for (const [k, o] of entries) p = applyObservation(p, { [k]: o.value } as Partial<PlayerStats>, o.n, now);
  const samples = { ...(profile.samples ?? {}) };
  for (const [k, o] of entries) samples[k] = (samples[k] ?? 0) + o.n;
  return { ...p, observations: profile.observations + handsSeen, samples };
}

/** A one-line read from the most telling observed stat. */
export function liveRead(name: string, obs: ObservedStats): string {
  const him = 'them';
  const lines: { weight: number; text: string }[] = [];
  const fold = (k: 'foldToCbet' | 'foldToTurnBet' | 'foldToRiverBet', street: string, bluffAdvice: string) => {
    const o = obs[k];
    if (!o || o.n < 3) return;
    if (o.value <= 0.25)
      lines.push({ weight: o.n * (0.5 - o.value), text: `${name}: folded to ${o.hits} of ${o.n} ${street} bets. Keep value betting big; never bluff ${him} on the ${street}.` });
    else if (o.value >= 0.6) lines.push({ weight: o.n * (o.value - 0.4), text: `${name}: folded to ${o.hits} of ${o.n} ${street} bets. ${bluffAdvice}` });
  };
  fold('foldToCbet', 'flop', 'C-bet bluff the flop often; value bet thinner when they call.');
  fold('foldToTurnBet', 'turn', 'Barrel the turn as a bluff more often.');
  fold('foldToRiverBet', 'river', 'River bluffs work; bet thin for value only with strong hands.');
  const v = obs.vpip;
  if (v && v.n >= 8) {
    if (v.value >= 0.4) lines.push({ weight: v.n * (v.value - 0.25), text: `${name}: played ${v.hits} of ${v.n} hands. Isolate ${him} with value hands and bet big when you hit.` });
    else if (v.value <= 0.15) lines.push({ weight: v.n * (0.25 - v.value), text: `${name}: played only ${v.hits} of ${v.n} hands. Respect ${him} raises; steal ${him} blinds.` });
  }
  if (!lines.length) {
    const taps = Object.values(obs).reduce((a, o) => a + (o?.n ?? 0), 0);
    return taps ? `${name}: nothing stands out yet (small sample).` : `${name}: no reads recorded.`;
  }
  return lines.sort((a, b) => b.weight - a.weight)[0]!.text;
}

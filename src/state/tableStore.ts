/**
 * Live table state for the Play tab. Game logic lives in src/engine/game; this store sequences
 * hands, keeps session stats and collects hero decisions for review.
 */
import { create } from 'zustand';
import {
  ARCHETYPES,
  NEUTRAL_IMAGE,
  TIGHT_FEARED_START,
  applyImage,
  imageEventsFromHand,
  imageLabel,
  reactivityOf,
  updateImage,
  type ImageLabel,
  type ImageShift,
  type ImageState,
  allInAdjusted,
  applyAction,
  botDecision,
  createRng,
  describeAction,
  STRADDLE_BB,
  gradePreflop,
  isoSize,
  preflopUnit,
  indexToString,
  initialRanges,
  makeBot,
  matchOption,
  positionsFor,
  preflopAdvice,
  profileModel,
  spotFromGame,
  startHand,
  summarizeSession,
  updateRanges,
  type ArchetypeId,
  type BotProfile,
  type Chart,
  type DecisionReview,
  type HandReview,
  type HandState,
  type PlayerAction,
  type PreflopAdvice,
  type Profile,
  type RangeMap,
  type SessionSummary,
  type Spot,
  type SpotAnalysis,
} from '../engine';
import { analyzeInWorker } from '../workers/engineClient';
import { usePlayLog } from './playLogStore';

export type Speed = 'slow' | 'normal' | 'fast';
export const SPEED_MS: Record<Speed, number> = { slow: 1100, normal: 650, fast: 260 };

export interface TableConfig {
  players: 6 | 9;
  stackBb: 40 | 100;
  /** Display only: the real-money big blind, e.g. 0.5 for a $0.25/$0.50 game. */
  bigBlindDollars: number;
  speed: Speed;
  coach: boolean;
  showBadges: boolean;
  homeGame: boolean;
  /** UTG posts a 2bb straddle every hand (optional: older saved tables have no value = off). */
  straddle?: boolean;
  /** Show the table-image meter (optional: missing = on). */
  imageMeter?: boolean;
  /** Hard mode: no coach and no image meter (optional: missing = off). */
  hardMode?: boolean;
}

/** Whether the meter is visible for this config. */
export const showImageMeter = (c: TableConfig) => !c.hardMode && c.imageMeter !== false;

export const DEFAULT_CONFIG: TableConfig = { players: 6, stackBb: 40, bigBlindDollars: 0.5, speed: 'normal', coach: true, showBadges: true, homeGame: false };

interface HeroDecision {
  eventIndex: number;
  street: HandState['street'];
  preflop: PreflopAdvice | null;
  spot: Spot | null;
  analysis: SpotAnalysis | null;
}

interface TableState {
  active: boolean;
  config: TableConfig;
  names: string[];
  bots: Record<number, BotProfile | undefined>;
  stacks: number[];
  buyIns: number[];
  button: number;
  handNo: number;
  hand: HandState | null;
  ranges: RangeMap;
  positions: Record<number, string>;
  decisions: HeroDecision[];
  /** Coach analysis for the current decision (postflop). */
  coach: { loading: boolean; analysis: SpotAnalysis | null; preflop: PreflopAdvice | null; error: string | null };
  reviews: HandReview[];
  lastReview: HandReview | null;
  reviewing: boolean;
  chart: Chart | null;
  /** How the table sees you (bots react to it). */
  image: ImageState;
  imageShifts: ImageShift[];

  startSession: (config: TableConfig, profiles: Profile[], chart: Chart) => void;
  endSession: () => void;
  nextHand: () => void;
  heroAct: (a: PlayerAction) => void;
  botStep: () => void;
  summary: () => SessionSummary;
  requestCoach: () => void;
}

const ARCH_ROTATION: ArchetypeId[] = ['station', 'tag', 'nit', 'maniac', 'efls', 'gambler', 'station', 'tag'];
const r2 = (x: number) => Math.round(x * 100) / 100;

export const HERO = 0;

export const useTable = create<TableState>()((set, get) => ({
  active: false,
  config: DEFAULT_CONFIG,
  names: [],
  bots: {},
  stacks: [],
  buyIns: [],
  button: 0,
  handNo: 0,
  hand: null,
  ranges: {},
  positions: {},
  decisions: [],
  coach: { loading: false, analysis: null, preflop: null, error: null },
  reviews: [],
  lastReview: null,
  reviewing: false,
  chart: null,
  image: NEUTRAL_IMAGE,
  imageShifts: [],

  startSession: (config, profiles, chart) => {
    const n = config.players;
    const bots: Record<number, BotProfile> = {};
    const names = ['You'];
    const custom = config.homeGame ? profiles : [];
    for (let i = 1; i < n; i++) {
      const p = custom[i - 1];
      if (p) {
        const b = makeBot(p.name, p.stats, p.archetype, p.id);
        b.model = profileModel(p);
        bots[i] = b;
        names.push(p.name);
      } else {
        const arch = ARCH_ROTATION[(i - 1) % ARCH_ROTATION.length]!;
        const name = `${ARCHETYPES[arch].short} ${Math.ceil(i / ARCH_ROTATION.length) > 1 ? i : ''}`.trim();
        bots[i] = makeBot(name, ARCHETYPES[arch].stats, arch);
        names.push(name);
      }
    }
    set({
      active: true,
      config,
      names,
      bots,
      stacks: Array(n).fill(config.stackBb),
      buyIns: Array(n).fill(config.stackBb),
      button: Math.floor(Math.random() * n),
      handNo: 0,
      hand: null,
      reviews: [],
      lastReview: null,
      reviewing: false,
      chart,
      // Home Game preset: the regulars already know you as the tight, strong player.
      image: config.homeGame ? TIGHT_FEARED_START : NEUTRAL_IMAGE,
      imageShifts: [],
    });
    get().nextHand();
  },

  endSession: () => {
    const s = get();
    if (s.reviews.length) usePlayLog.getState().addSession(s.reviews, summarizeSession(s.reviews), s.config.stackBb);
    set({ active: false, hand: null, reviews: [], lastReview: null, reviewing: false });
  },

  nextHand: () => {
    const s = get();
    const n = s.config.players;
    // Rebuy anyone who is (nearly) broke — home-game style.
    const stacks = [...s.stacks];
    const buyIns = [...s.buyIns];
    for (let i = 0; i < n; i++)
      if (stacks[i]! < 1) {
        stacks[i] = r2(stacks[i]! + s.config.stackBb);
        buyIns[i] = buyIns[i]! + s.config.stackBb;
      }
    const button = s.hand ? (s.button + 1) % n : s.button;
    const handNo = s.handNo + 1;
    const hand = startHand(
      s.names.map((name, i) => ({ name, stack: stacks[i]!, hero: i === HERO })),
      button,
      { sb: 0.5, bb: 1, straddle: s.config.straddle ? STRADDLE_BB : undefined },
      createRng(Date.now() + handNo),
      handNo,
    );
    const active = hand.seats.filter((x) => !x.out).map((x) => x.index);
    set({
      stacks,
      buyIns,
      button,
      handNo,
      hand,
      ranges: initialRanges(hand),
      positions: positionsFor(active, button, n),
      decisions: [],
      coach: { loading: false, analysis: null, preflop: null, error: null },
      lastReview: null,
      reviewing: false,
    });
    get().requestCoach();
  },

  requestCoach: () => {
    const s = get();
    const hand = s.hand;
    if (!hand || hand.finished || hand.toAct !== HERO || !s.chart) return;
    if (hand.street === 'preflop') {
      set({ coach: { loading: false, analysis: null, preflop: preflopAdvice(hand, HERO, s.chart, s.positions), error: null } });
      return;
    }
    const spot = spotFromGame(hand, HERO, s.ranges, imagedBots(), s.positions);
    if (!s.config.coach || s.config.hardMode) {
      set({ coach: { loading: false, analysis: null, preflop: null, error: null } });
      return;
    }
    set({ coach: { loading: true, analysis: null, preflop: null, error: null } });
    const handNo = hand.handNo;
    const logLen = hand.log.length;
    analyzeInWorker(spot, { sizes: [0.33, 0.5, 0.75, 1], confidence: true })
      .then((analysis) => {
        const now = get().hand;
        if (now?.handNo === handNo && now.log.length === logLen) set({ coach: { loading: false, analysis, preflop: null, error: null } });
      })
      .catch((e: Error) => set({ coach: { loading: false, analysis: null, preflop: null, error: e.message } }));
  },

  heroAct: (a) => {
    const s = get();
    const hand = s.hand;
    if (!hand || hand.finished || hand.toAct !== HERO || !s.chart) return;
    const decision: HeroDecision = {
      eventIndex: hand.log.length,
      street: hand.street,
      preflop: hand.street === 'preflop' ? preflopAdvice(hand, HERO, s.chart, s.positions) : null,
      spot: hand.street === 'preflop' ? null : spotFromGame(hand, HERO, s.ranges, imagedBots(), s.positions),
      analysis: s.coach.analysis,
    };
    const next = applyAction(hand, a);
    const ev = next.log[next.log.length - 1]!;
    set({ hand: next, ranges: updateRanges(s.ranges, hand, ev, imagedBots()), decisions: [...s.decisions, decision], coach: { loading: false, analysis: null, preflop: null, error: null } });
    afterAction();
  },

  botStep: () => {
    const s = get();
    const hand = s.hand;
    if (!hand || hand.finished || hand.toAct === null || hand.toAct === HERO) return;
    const bot = s.bots[hand.toAct]!;
    const next = applyAction(hand, botDecision(hand, bot, createRng(Date.now() + hand.log.length), { seat: HERO, label: imageLabel(s.image) }));
    const ev = next.log[next.log.length - 1]!;
    set({ hand: next, ranges: updateRanges(s.ranges, hand, ev, imagedBots()) });
    afterAction();
  },

  summary: () => summarizeSession(get().reviews),
}));

/** Hero's current image label. */
export const heroImageLabel = (): ImageLabel => imageLabel(useTable.getState().image);

/**
 * Bots with hero's image applied to their models, so the coach and range narrowing read the same
 * opponents the bots actually are (botDecision applies it itself from the raw model).
 */
function imagedBots(): Record<number, BotProfile | undefined> {
  const s = useTable.getState();
  const label = imageLabel(s.image);
  const out: Record<number, BotProfile | undefined> = {};
  for (const [k, b] of Object.entries(s.bots)) out[Number(k)] = b && { ...b, model: applyImage(b.model, label, reactivityOf(b)) };
  return out;
}

function afterAction() {
  const s = useTable.getState();
  const hand = s.hand!;
  if (hand.finished) {
    const before = imageLabel(s.image);
    const image = updateImage(s.image, imageEventsFromHand(hand, HERO));
    const after = imageLabel(image);
    const imageShifts = after !== before ? [...s.imageShifts, { handNo: hand.handNo, from: before, to: after }] : s.imageShifts;
    useTable.setState({ stacks: hand.seats.map((x) => x.stack), reviewing: true, image, imageShifts });
    void reviewHand();
  } else if (hand.toAct === HERO) {
    s.requestCoach();
  }
}

async function reviewHand() {
  const s = useTable.getState();
  const hand = s.hand!;
  const decisions: DecisionReview[] = [];
  for (const d of s.decisions) {
    const ev = hand.log[d.eventIndex]!;
    const action = describeAction(ev);
    if (d.preflop) {
      const g = gradePreflop(d.preflop, ev.type);
      decisions.push({
        street: 'preflop',
        action,
        grade: g?.grade ?? null,
        evLost: null,
        equity: null,
        best: d.preflop.best,
        note: g?.note ?? d.preflop.situation,
        tags: {
          facingBet: (d.preflop.price ?? 0) > 0,
          heroPos: s.positions[HERO],
          actionType: ev.type,
          preflopKind: d.preflop.kind,
          preflopCount: d.preflop.count,
          isoSize:
            d.preflop.kind === 'vsLimpers' && (ev.type === 'raise' || ev.type === 'bet')
              ? { chosen: ev.to / preflopUnit(hand), recommended: isoSize(s.chart?.id.startsWith('home') ? 'home' : 'casino', s.positions[HERO]!, d.preflop.count ?? 1).best }
              : undefined,
        },
      });
      continue;
    }
    try {
      const analysis = d.analysis?.confidence ? d.analysis : await analyzeInWorker(d.spot!, { sizes: [0.33, 0.5, 0.75, 1], confidence: true });
      const chosen = matchOption(analysis, ev.type, ev.to);
      const lost = chosen ? Math.max(0, analysis.best.ev - chosen.ev) : null;
      decisions.push({
        street: d.street,
        action,
        grade: chosen?.grade ?? null,
        evLost: lost !== null ? Math.round(lost * 100) / 100 : null,
        equity: analysis.heroEquity,
        best: analysis.best.label,
        note: analysis.summary,
        confidence: analysis.confidence,
        source: analysis.source,
        tags: {
          facingBet: d.spot!.facingBet !== null,
          bucket: analysis.hero.bucket,
          heroPos: s.positions[HERO],
          villainArchetype: s.bots[d.spot!.villains.length === 1 ? Object.keys(s.bots).map(Number).find((i) => s.positions[i] === d.spot!.villains[0]!.seat) ?? -1 : -1]?.archetype,
          chosenFraction: ev.type === 'bet' || ev.type === 'raise' ? ev.amount / Math.max(1, ev.potBefore) : null,
          bestFraction: analysis.best.fraction,
          actionType: ev.type,
        },
      });
    } catch (e) {
      decisions.push({ street: d.street, action, grade: null, evLost: null, equity: null, best: null, note: `Couldn't analyse: ${(e as Error).message}` });
    }
  }
  const hero = hand.seats[HERO]!;
  const shift = useTable.getState().imageShifts.find((x) => x.handNo === hand.handNo);
  const review: HandReview = {
    handNo: hand.handNo,
    imageShift: shift ? { from: shift.from, to: shift.to } : undefined,
    heroCards: hero.hole.map(indexToString),
    board: hand.board.map(indexToString),
    net: hand.result?.net[HERO] ?? 0,
    allIn: allInAdjusted(hand, HERO),
    decisions,
  };
  if (useTable.getState().hand?.handNo !== hand.handNo) return;
  useTable.setState((st) => ({ reviews: [...st.reviews, review], lastReview: review }));
}

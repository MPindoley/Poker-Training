/**
 * Preflop drill generators. Built from resolved charts (so user edits apply) and the player's
 * skill records (so weak seats and hand groups come up more often).
 */
import { formatPercent } from '../math';
import { HAND_GRID } from '../hands';
import { classComboIndices, comboToString } from '../range';
import type { Rng } from '../rng';
import { shuffle } from '../rng';
import type { Grade } from '../grading';
import { finalizeChoices, type Candidate } from '../drills/choices';
import type { DrillDef } from '../drills/math';
import { skillWeight, weightedPick, type SkillRecord } from '../drills/srs';
import type { Difficulty, Question, StrategyVisual } from '../drills/types';
import { actionStats, strategyFor, strategyGrid, type ActionRanges, type Chart, type PreflopAction } from './charts';
import { HAND_GROUP_NAMES, handGroup } from './groups';
import { ACTION_NAMES, preflopReason } from './reasons';
import { bigBlindPrice, sizingRule, type GameMode } from './sizing';

export const ACTION_COLORS: Record<string, string> = {
  raise: '#e5383b',
  '3bet': '#e5383b',
  '4bet': '#8b4ae8',
  call: '#22b35e',
  limp: '#f5b820',
};

function visualFor(spot: ActionRanges, highlight: string, caption: string): StrategyVisual {
  const grid = strategyGrid(spot);
  const actions = Object.keys(spot.ranges).map((id) => ({ id, label: ACTION_NAMES[id as PreflopAction], color: ACTION_COLORS[id] ?? '#2f7fe8' }));
  return {
    kind: 'strategy',
    cells: Object.fromEntries(Object.entries(grid).map(([k, v]) => [k, v.freq])),
    actions,
    highlight,
    caption,
  };
}

/** A label is on the boundary if a grid neighbour has a different main action. */
function boundaryLabels(spot: ActionRanges): Set<string> {
  const grid = strategyGrid(spot);
  const out = new Set<string>();
  for (let r = 0; r < 13; r++)
    for (let c = 0; c < 13; c++) {
      const me = grid[HAND_GRID[r]![c]!.label]!.main;
      for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const n = HAND_GRID[r + dr!]?.[c + dc!];
        if (n && grid[n.label]!.main !== me) out.add(HAND_GRID[r]![c]!.label);
      }
    }
  return out;
}

function pickHand(rng: Rng, spot: ActionRanges, difficulty: Difficulty, skills: Readonly<Record<string, SkillRecord>>): string {
  const boundary = boundaryLabels(spot);
  const labels = HAND_GRID.flat().map((h) => h.label);
  return weightedPick(
    labels,
    (l) => {
      const b = boundary.has(l);
      const base = difficulty === 'bronze' ? (b ? 0.2 : 1) : b ? 4 : 1;
      return base * skillWeight(skills[`preflop.group:${handGroup(l)}`]);
    },
    rng,
  );
}

function comboFor(rng: Rng, label: string): string[] {
  const idx = classComboIndices(label);
  const s = comboToString(idx[Math.floor(rng() * idx.length)]!);
  return [s.slice(0, 2), s.slice(2)];
}

function gradeFromFreq(freq: number, isMain: boolean): Grade {
  if (isMain) return 'best';
  return freq >= 0.25 ? 'acceptable' : 'mistake';
}

export interface PreflopDrillContext {
  chart: Chart;
  skills: Readonly<Record<string, SkillRecord>>;
}

function stackNote(chart: Chart) {
  return `${chart.name}`;
}

// ---------------------------------------------------------------------------
// Flash cards

function flashQuestion(ctx: PreflopDrillContext, rng: Rng, difficulty: Difficulty, variant: string, id: string): Question {
  const { chart } = ctx;
  const [kind, seat, opener] = variant.split(':') as ['rfi' | 'open' | '3bet', string, string?];
  const spot = kind === 'rfi' ? chart.rfi(seat) : kind === 'open' ? chart.vsOpen(seat, opener!) : chart.vs3bet(seat);
  if (!spot) throw new Error(`No chart data for ${variant}`);
  const label = pickHand(rng, spot, difficulty, ctx.skills);
  const strat = strategyFor(spot, label);
  const hero = comboFor(rng, label);

  const actions: PreflopAction[] = kind === 'rfi' ? ['raise', 'limp', 'fold'] : kind === 'open' ? ['3bet', 'call', 'fold'] : ['4bet', 'call', 'fold'];
  const openBb = chart.openSize(kind === 'open' ? opener! : seat);
  const actionLabel = (a: PreflopAction) =>
    a === 'raise' ? `Raise ${openBb}bb` : a === 'limp' ? 'Limp' : ACTION_NAMES[a];

  const continuing = kind === 'rfi' ? actionStats(spot.ranges.raise!) : combinedStats(spot);
  const playersBehind = chart.seatsBehind(seat).length;
  const cands: Candidate[] = actions.map((a) => {
    const f = strat.freq[a] ?? 0;
    const reason = preflopReason({
      kind: kind === 'rfi' ? 'rfi' : kind === 'open' ? 'vsOpen' : 'vs3bet',
      label,
      seat,
      opener,
      best: strat.main,
      chosen: a,
      rangeFraction: continuing.fraction,
      playersBehind,
    });
    return { label: actionLabel(a), grade: gradeFromFreq(f, a === strat.main), note: `${formatPercent(f, 0)} in chart`, feedback: reason };
  });

  const steps = Object.entries(spot.ranges).map(([a, r]) => {
    const st = actionStats(r!);
    return `${ACTION_NAMES[a as PreflopAction]} range: ${formatPercent(st.fraction)} of hands (${round(st.combos)} combos)`;
  });
  steps.push(`${label}: ${actions.map((a) => `${ACTION_NAMES[a]} ${formatPercent(strat.freq[a] ?? 0, 0)}`).join(' · ')}`);
  steps.push(`Hand group: ${HAND_GROUP_NAMES[handGroup(label)]}`);

  const situation =
    kind === 'rfi'
      ? `Folded to you in the ${seat}.`
      : kind === 'open'
        ? `${opener} opens to ${openBb}bb. You're in the ${seat}.`
        : `You opened from the ${seat} and face a 3-bet.`;
  return {
    id,
    kind: 'preflop.flash',
    skill: `preflop.flash:${variant}`,
    tags: [`preflop.seat:${seat}`, `preflop.group:${handGroup(label)}`],
    difficulty,
    prompt: `${situation} What's your play?`,
    context: { hero, facts: [{ label: 'Game', value: stackNote(chart) }, { label: 'Seat', value: seat }] },
    choices: finalizeChoices(cands, rng, 3),
    explanation: {
      summary: preflopReason({
        kind: kind === 'rfi' ? 'rfi' : kind === 'open' ? 'vsOpen' : 'vs3bet',
        label,
        seat,
        opener,
        best: strat.main,
        chosen: strat.main,
        rangeFraction: continuing.fraction,
        playersBehind,
      }),
      steps,
    },
    visual: visualFor(spot, label, `${chart.name} · ${kind === 'rfi' ? `${seat} open` : kind === 'open' ? `${seat} vs ${opener}` : `${seat} vs 3-bet`} (approximation)`),
  };
}

function combinedStats(spot: ActionRanges) {
  let fraction = 0;
  let combos = 0;
  for (const r of Object.values(spot.ranges)) {
    const s = actionStats(r!);
    fraction += s.fraction;
    combos += s.combos;
  }
  return { fraction, combos };
}

const round = (x: number) => (Number.isInteger(x) ? x : Math.round(x * 10) / 10);

// ---------------------------------------------------------------------------
// Seat ladder

function ladderQuestion(ctx: PreflopDrillContext, rng: Rng, difficulty: Difficulty, _variant: string, id: string): Question {
  const { chart } = ctx;
  const seats = chart.openingSeats.filter((s) => s !== 'SB');
  const firstOpen = (label: string) => seats.find((s) => (strategyFor(chart.rfi(s)!, label).freq.raise ?? 0) >= 0.5) ?? null;
  // Prefer hands that change somewhere along the ladder.
  const labels = HAND_GRID.flat().map((h) => h.label);
  const interesting = labels.filter((l) => {
    const f = firstOpen(l);
    return f !== null && f !== seats[0];
  });
  const label = rng() < 0.85 ? interesting[Math.floor(rng() * interesting.length)]! : labels[Math.floor(rng() * labels.length)]!;
  const first = firstOpen(label);
  const answer = first === null ? 'Never' : first === seats[0] ? 'Every seat' : first;

  const pool = [...seats.slice(1), 'Every seat', 'Never'];
  const i = pool.indexOf(answer);
  const near = shuffle(pool.filter((p) => p !== answer), rng).sort((a, b) => Math.abs(pool.indexOf(a) - i) - Math.abs(pool.indexOf(b) - i));
  const cands: Candidate[] = [{ label: answer, grade: 'best' }, ...near.slice(0, 3).map((l) => ({ label: l, grade: 'mistake' as Grade }))];

  const steps = seats.map((s) => {
    const f = strategyFor(chart.rfi(s)!, label).freq.raise ?? 0;
    const pct = formatPercent(actionStats(chart.rfi(s)!.ranges.raise!).fraction, 0);
    return `${s} (opens ${pct}): ${f >= 0.5 ? 'RAISE' : 'fold'}${f > 0 && f < 1 ? ` (${formatPercent(f, 0)})` : ''}`;
  });
  return {
    id,
    kind: 'preflop.ladder',
    skill: 'preflop.ladder:ladder',
    tags: [`preflop.group:${handGroup(label)}`],
    difficulty,
    prompt: `Folded to you. From which seat does ${label} become an open?`,
    context: { hero: comboFor(rng, label), facts: [{ label: 'Game', value: chart.name }] },
    choices: finalizeChoices(cands, rng, 4),
    explanation: {
      summary:
        answer === 'Never'
          ? `${label} isn't an open from any seat ${seats[0]}–${seats[seats.length - 1]}.`
          : answer === 'Every seat'
            ? `${label} is an open from every seat, even ${seats[0]}.`
            : `${label} folds before ${answer} and opens from ${answer} onward: fewer players behind means fewer hands that can wake up with something better.`,
      steps,
    },
    visual: first ? visualFor(chart.rfi(first)!, label, `${first} open range (approximation)`) : visualFor(chart.rfi(seats[seats.length - 1]!)!, label, `${seats[seats.length - 1]} open range (approximation)`),
  };
}

// ---------------------------------------------------------------------------
// Sizing

function sizingQuestion(ctx: PreflopDrillContext, rng: Rng, difficulty: Difficulty, variant: string, id: string): Question {
  const { chart } = ctx;
  const mode = variant as GameMode;
  const seats = chart.openingSeats;
  const seat = seats[Math.floor(rng() * seats.length)]!;
  const maxLimpers = difficulty === 'bronze' ? 0 : mode === 'home' ? 3 : 2;
  const limpers = seat === 'UTG' ? 0 : Math.floor(rng() * (maxLimpers + 1));
  const rule = sizingRule(mode, seat, limpers);
  const sizes = new Set<number>([rule.best, ...rule.acceptable, 2.5, 3, 4, 4 + limpers, 3 + limpers]);
  const cands: Candidate[] = [...sizes]
    .sort((a, b) => a - b)
    .map((s) => ({
      label: `${s}bb`,
      grade: (s === rule.best ? 'best' : rule.acceptable.includes(s) ? 'acceptable' : 'mistake') as Grade,
      note: `BB needs ${formatPercent(bigBlindPrice(s, limpers))} to call`,
    }));
  // Keep best, one acceptable, and mistakes, max 4.
  const best = cands.find((c) => c.grade === 'best')!;
  const acc = cands.filter((c) => c.grade === 'acceptable').slice(0, 1);
  const bad = shuffle(cands.filter((c) => c.grade === 'mistake'), rng).slice(0, 2);
  const label = pickHand(rng, chart.rfi(seat)!, 'silver', ctx.skills);
  const steps = [
    rule.reason,
    `Price for the BB at ${rule.best}bb: needs ${formatPercent(bigBlindPrice(rule.best, limpers))}; at 2.5bb: ${formatPercent(bigBlindPrice(2.5, limpers))}.`,
  ];
  if (limpers) steps.push(`Each limper already put 1bb in: a size that ignores them gives everyone a great price to call.`);
  if (mode === 'home') steps.push('Home-game mode: against players who call too much, bigger opens win more from their weak calls.');
  return {
    id,
    kind: 'preflop.sizing',
    skill: `preflop.sizing:${mode}`,
    difficulty,
    prompt: `${mode === 'home' ? 'Home game, loose-passive table. ' : 'Casino, 100bb. '}You open from the ${seat}${limpers ? ` after ${limpers} limper${limpers > 1 ? 's' : ''}` : ''}. What size?`,
    context: { hero: comboFor(rng, strategyFor(chart.rfi(seat)!, label).main === 'raise' ? label : 'AKs'), facts: [{ label: 'Seat', value: seat }, { label: 'Limpers', value: String(limpers) }] },
    choices: finalizeChoices([best, ...acc, ...bad], rng, 4),
    explanation: { summary: rule.reason, steps },
  };
}

// ---------------------------------------------------------------------------
// Blind defense

function defenseQuestion(ctx: PreflopDrillContext, rng: Rng, difficulty: Difficulty, variant: string, id: string): Question {
  const { chart } = ctx;
  const opener = variant.split(':')[1]!;
  const spot = chart.vsOpen('BB', opener);
  if (!spot) throw new Error(`No BB defense vs ${opener}`);
  const label = pickHand(rng, spot, difficulty, ctx.skills);
  const strat = strategyFor(spot, label);
  const open = chart.openSize(opener);
  const price = bigBlindPrice(open, 0, opener === 'SB' ? 0 : 0.5);
  const priceNote = `You need ${formatPercent(price)} equity to call`;
  const actions: PreflopAction[] = ['3bet', 'call', 'fold'];
  const defend = combinedStats(spot);
  const reason = (a: PreflopAction) =>
    preflopReason({ kind: 'vsOpen', label, seat: 'BB', opener, best: strat.main, chosen: a, rangeFraction: defend.fraction, playersBehind: 0 });
  const cands: Candidate[] = actions.map((a) => ({
    label: ACTION_NAMES[a],
    grade: gradeFromFreq(strat.freq[a] ?? 0, a === strat.main),
    note: `${formatPercent(strat.freq[a] ?? 0, 0)} in chart`,
    feedback: reason(a),
  }));
  return {
    id,
    kind: 'preflop.defense',
    skill: `preflop.defense:${variant}`,
    tags: [`preflop.seat:BBvs${opener}`, `preflop.group:${handGroup(label)}`],
    difficulty,
    prompt: `${opener} opens to ${open}bb${opener === 'SB' ? '' : ', folds to you'}. You're in the big blind. Defend?`,
    context: { hero: comboFor(rng, label), facts: [{ label: 'Open', value: `${open}bb` }, { label: 'Pot odds', value: priceNote }] },
    choices: finalizeChoices(cands, rng, 3),
    explanation: {
      summary: reason(strat.main),
      steps: [
        `Pot before you act: ${opener === 'SB' ? `${open}bb (SB)` : `0.5bb (SB) + ${open}bb`} + your 1bb; you call ${open - 1}bb more.`,
        `${priceNote}: call / (pot + bet + call) = ${formatPercent(price)}`,
        `BB defends ${formatPercent(defend.fraction)} vs ${opener} (${round(defend.combos)} combos): 3-bet ${formatPercent(actionStats(spot.ranges['3bet']!).fraction)}, call ${formatPercent(actionStats(spot.ranges.call!).fraction)}`,
        `${label}: 3-bet ${formatPercent(strat.freq['3bet'] ?? 0, 0)} · call ${formatPercent(strat.freq.call ?? 0, 0)} · fold ${formatPercent(strat.freq.fold ?? 0, 0)}`,
      ],
    },
    visual: visualFor(spot, label, `${chart.name} · BB vs ${opener} (approximation)`),
  };
}

// ---------------------------------------------------------------------------

export function makePreflopDrills(ctx: PreflopDrillContext): DrillDef[] {
  const { chart } = ctx;
  const rfi = chart.openingSeats.map((s) => `rfi:${s}`);
  const facing = chart.facingOpenPairs().map((p) => `open:${p.seat}:${p.opener}`);
  const threeBet = chart.facing3betSeats().map((s) => `3bet:${s}`);
  const bbVs = chart.facingOpenPairs().filter((p) => p.seat === 'BB').map((p) => `vs:${p.opener}`);
  const mode: GameMode = chart.id.startsWith('home') ? 'home' : 'casino';
  const wrap = (fn: typeof flashQuestion) => (rng: Rng, d: Difficulty, v: string, id: string) => fn(ctx, rng, d, v, id);
  return [
    {
      kind: 'preflop.flash',
      title: 'Flash Cards',
      blurb: 'Raise, call or fold — fast',
      glyph: 'FC',
      variants: { bronze: rfi, silver: rfi, gold: [...facing, ...threeBet, ...rfi.slice(-3)] },
      generate: wrap(flashQuestion),
    },
    {
      kind: 'preflop.ladder',
      title: 'Seat Ladder',
      blurb: 'Where does a hand start opening?',
      glyph: 'UP',
      variants: { bronze: ['ladder'], silver: ['ladder'], gold: ['ladder'] },
      generate: wrap(ladderQuestion),
    },
    {
      kind: 'preflop.sizing',
      title: 'Sizing',
      blurb: 'Pick the open size',
      glyph: 'bb',
      variants: { bronze: [mode], silver: [mode, mode === 'home' ? 'casino' : 'home'], gold: ['home', 'casino'] },
      generate: wrap(sizingQuestion),
    },
    {
      kind: 'preflop.defense',
      title: 'Blind Defense',
      blurb: 'Big blind vs every seat',
      glyph: 'BB',
      variants: { bronze: bbVs, silver: bbVs, gold: bbVs },
      generate: wrap(defenseQuestion),
    },
  ];
}


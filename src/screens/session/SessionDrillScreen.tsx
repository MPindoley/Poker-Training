import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AREA_NAMES,
  MATH_DRILLS,
  REGULAR_MODEL,
  VENUE_NAMES,
  buildQuestion,
  makeExploitDrills,
  makeEquityDrills,
  makePostflopDrills,
  makePreflopDrills,
  planLength,
  quickDrillPlan,
  segmentAt,
  skillRadar,
  warmUpPlan,
  type DrillDef,
  type SessionPlan,
  type Venue,
} from '../../engine';
import { usePostflopSolverDb } from '../../state/postflopSolverStore';
import { useCharts } from '../../state/chartStore';
import { useDrillStats } from '../../state/drillStatsStore';
import { useSettings } from '../../state/settingsStore';
import { useProgressHydrated } from '../../state/progression';
import { DrillRunner } from '../../components/drill/DrillRunner';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ChipGroup } from '../../components/ui/Chips';
import { GameButton, Panel } from '../../components/ui';

function minutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m <= 1 ? 'about 1 minute' : `about ${m} minutes`;
}

/** Quick Drill (2 min, weakest area) and Pre-Game Warm-Up (10 min, tuned for home game or casino). */
export function SessionDrillScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const type = params.get('type') === 'warmup' ? 'warmup' : 'quick';
  const savedVenue = useSettings((s) => s.venue);
  const setVenue = useSettings((s) => s.setVenue);
  const venue: Venue = (params.get('venue') as Venue) === 'casino' || (params.get('venue') !== 'home' && savedVenue === 'casino') ? 'casino' : 'home';
  const charts = useCharts();
  const solver = usePostflopSolverDb();
  const [started, setStarted] = useState(false);

  // Stats are live on the intro screen (they may still be loading from IndexedDB) and frozen at Start
  // so the plan doesn't shift while playing.
  const hydrated = useProgressHydrated();
  const liveKinds = useDrillStats((s) => s.kinds);
  const liveSkills = useDrillStats((s) => s.skills);
  const [frozen, setFrozen] = useState<{ kinds: typeof liveKinds; skills: typeof liveSkills } | null>(null);
  const kinds = frozen?.kinds ?? liveKinds;
  const skills = frozen?.skills ?? liveSkills;
  const plan: SessionPlan = useMemo(() => {
    const radar = skillRadar(kinds);
    return type === 'warmup' ? warmUpPlan(venue, radar) : quickDrillPlan(radar, venue);
  }, [type, venue, kinds]);

  const byKind = useMemo(() => {
    const six = charts['cash-6max-100bb']!;
    const home = charts['home-40bb']!;
    const all: DrillDef[] = [
      ...MATH_DRILLS,
      ...makePreflopDrills({ chart: venue === 'home' ? home : six, skills }),
      ...makePostflopDrills({ chart: six, shortChart: home, model: REGULAR_MODEL, filters: {}, solver }),
      ...makeExploitDrills({ chart: six }),
      ...makeEquityDrills(venue === 'home' ? home : six),
    ];
    return new Map(all.map((d) => [d.kind, d]));
  }, [charts, venue, skills, solver]);

  const exit = () => navigate('/');

  if (started) {
    return (
      <DrillRunner
        key={plan.id}
        title={plan.title}
        spec={{ drills: plan.segments.flatMap((s) => s.kinds.map((k) => byKind.get(k)!).filter(Boolean)), difficulty: plan.segments[0]!.difficulty }}
        length={planLength(plan)}
        makeQuestion={(spec, i) => {
          const seg = segmentAt(plan, i);
          const drills = seg.kinds.map((k) => byKind.get(k)).filter((d): d is DrillDef => !!d);
          return buildQuestion({ ...spec, drills, difficulty: seg.difficulty }, i);
        }}
        onExit={exit}
      />
    );
  }

  return (
    <div className="space-y-4">
      <ScreenHeader title={plan.title} subtitle={`${plan.subtitle} · ${minutes(plan.estimatedSeconds)}`} />
      {type === 'warmup' && (
        <Panel tone="night">
          <ChipGroup
            label="Tonight I'm playing"
            options={(['home', 'casino'] as Venue[]).map((v) => ({ value: v, label: VENUE_NAMES[v] }))}
            value={[venue]}
            onChange={(v) => {
              const next = v[0] ?? 'home';
              setVenue(next);
              navigate(`/train/session?type=warmup&venue=${next}`, { replace: true });
            }}
          />
          <p className="mt-2 text-xs font-bold text-cream/80">
            {venue === 'home'
              ? 'Home-game mix: 40bb preflop chart, short-stack and value spots, pot odds for loose multi-way pots.'
              : 'Casino mix: 100bb 6-max chart, c-bets, bluff-catching and bet-sizing math.'}
          </p>
        </Panel>
      )}
      <Panel tone="wood" title="The plan">
        <ol className="space-y-2">
          {plan.segments.map((s, i) => (
            <motion.li
              key={s.area}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.06 }}
              className="flex items-center justify-between rounded-2xl border-2 border-ink bg-ink/40 px-3 py-2"
            >
              <span className="font-display text-lg">{s.label}</span>
              <span className="text-sm font-bold text-gold-300">
                {s.count} question{s.count > 1 ? 's' : ''}
              </span>
            </motion.li>
          ))}
        </ol>
        <p className="mt-2 text-xs font-bold text-cream/85">
          {planLength(plan)} questions. {type === 'quick' ? `Focus: ${AREA_NAMES[plan.segments[0]!.area]}, your weakest area right now.` : 'Your weakest area gets extra time.'}
        </p>
      </Panel>
      <div className="grid grid-cols-2 gap-3">
        <GameButton color="cream" onClick={exit}>
          Back
        </GameButton>
        <GameButton
          color="gold"
          disabled={!hydrated}
          onClick={() => {
            setFrozen({ kinds: liveKinds, skills: liveSkills });
            setStarted(true);
          }}
        >
          Start
        </GameButton>
      </div>
    </div>
  );
}

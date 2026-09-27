import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { answerXp, actionStats, formatPercent, scorePaint, type Chart, type Grade, type Range } from '../../engine';
import { useActiveChart } from '../../state/chartStore';
import { useRewards } from '../../state/rewardsStore';
import { useDrillStats } from '../../state/drillStatsStore';
import { useProgress } from '../../state/progressStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Celebration, FeedbackBanner, GameButton, Panel, RangeGrid } from '../../components/ui';

/** What you paint: the open range, or the iso-raise / squeeze range of a home-game spot. */
interface PaintMode {
  id: string;
  label: string;
  seats: (c: Chart) => string[];
  range: (c: Chart, seat: string) => Range | undefined;
  task: (seat: string) => string;
}

const MODES: PaintMode[] = [
  { id: 'rfi', label: 'Opens', seats: (c) => c.openingSeats, range: (c, s) => c.rfi(s)?.ranges.raise, task: (s) => `Paint every hand the ${s} opens when folded to.` },
  {
    id: 'iso1',
    label: 'Iso vs 1 limper',
    seats: (c) => c.seats.filter((s) => c.vsLimpers(s, 1)),
    range: (c, s) => c.vsLimpers(s, 1)?.ranges.raise,
    task: (s) => `One player limps. Paint every hand the ${s} iso-raises.`,
  },
  {
    id: 'iso3',
    label: 'Iso vs 3+ limpers',
    seats: (c) => c.seats.filter((s) => c.vsLimpers(s, 3)),
    range: (c, s) => c.vsLimpers(s, 3)?.ranges.raise,
    task: (s) => `Three or more limp. Paint every hand the ${s} iso-raises.`,
  },
  {
    id: 'squeeze',
    label: 'Squeeze',
    seats: (c) => c.seats.filter((s) => c.squeeze(s, 1)),
    range: (c, s) => c.squeeze(s, 1)?.ranges['3bet'],
    task: (s) => `An open and one caller. Paint every hand the ${s} squeezes.`,
  },
];

export function PaintRangeScreen() {
  const navigate = useNavigate();
  const chart = useActiveChart();
  const [modeId, setModeId] = useState('rfi');
  const mode = MODES.find((m) => m.id === modeId)!;
  const seats = mode.seats(chart);
  const [seatPick, setSeat] = useState(() => chart.openingSeats[Math.floor(Math.random() * chart.openingSeats.length)]!);
  const seat = seats.includes(seatPick) ? seatPick : seats[seats.length - 1]!;
  const [painted, setPainted] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [start, setStart] = useState(() => performance.now());
  const record = useDrillStats((s) => s.record);
  const addXp = useProgress((s) => s.addXp);
  const recordPractice = useProgress((s) => s.recordPractice);
  const recordPaint = useRewards((s) => s.recordPaint);

  const range = mode.range(chart, seat)!;
  const stats = actionStats(range);
  const score = useMemo(() => scorePaint(painted, range), [painted, range]);
  const grade: Grade = score.accuracy >= 0.85 ? 'best' : score.accuracy >= 0.65 ? 'acceptable' : 'mistake';

  const submit = () => {
    setSubmitted(true);
    record('preflop.paint', [`preflop.paint:${mode.id === 'rfi' ? seat : `${mode.id}:${seat}`}`, `preflop.seat:${seat}`], grade, performance.now() - start);
    addXp(answerXp(grade, 'silver') * 2);
    // Range Master counts opening ranges only.
    if (mode.id === 'rfi') recordPaint(chart.id, seat, score.accuracy);
    recordPractice();
  };
  const next = (s = seats[Math.floor(Math.random() * seats.length)]!) => {
    setSeat(s);
    setPainted(new Set());
    setSubmitted(false);
    setStart(performance.now());
  };

  const overlay = (label: string) => {
    if (!submitted) return undefined;
    const inRange = scorePaint(new Set([label]), range).correct > 0;
    const mine = painted.has(label);
    if (mine && inRange) return 'bg-gradient-to-b from-felt-300 to-emerald-dark text-white';
    if (!mine && inRange) return 'bg-gold-500 text-ink ring-2 ring-inset ring-white';
    if (mine && !inRange) return 'bg-ruby text-white';
    return undefined;
  };

  return (
    <div className="relative space-y-3">
      <ScreenHeader
        title="Paint the Range"
        subtitle={chart.name}
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate('/train/preflop')}>
            Back
          </GameButton>
        }
      />
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="What to paint">
        {MODES.filter((m) => m.seats(chart).length).map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={m.id === modeId}
            onClick={() => {
              setModeId(m.id);
              setPainted(new Set());
              setSubmitted(false);
              setStart(performance.now());
            }}
            className={`min-h-11 rounded-xl border-2 border-ink px-3 font-display text-sm ${m.id === modeId ? 'bg-sapphire text-white' : 'bg-ink/40 text-cream'}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {seats.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => next(s)}
            className={`min-h-11 min-w-11 rounded-xl border-2 border-ink px-2 font-display text-sm ${s === seat ? 'bg-gold-500 text-ink' : 'bg-ink/40 text-cream'}`}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="text-center font-display text-lg">
        {mode.task(seat)}
      </p>

      <RangeGrid selected={painted} onChange={submitted ? undefined : setPainted} highlight={overlay} showStats={!submitted} />

      {submitted && (
        <>
          {grade === 'best' && <Celebration />}
          <FeedbackBanner
            tone={grade}
            title={`${formatPercent(score.accuracy, 0)} combo accuracy`}
            math={[
              `Real ${seat} ${mode.id === 'rfi' ? 'open' : mode.label.toLowerCase()} range: ${formatPercent(stats.fraction)} of hands (${stats.combos} combos)`,
              `Correct: ${score.correct} combos · Missed: ${score.missed} · Extra: ${score.extra}`,
              `Accuracy = correct / (correct + missed + extra) = ${score.correct} / ${score.correct + score.missed + score.extra}`,
              ...(score.missedLabels.length ? [`Missed: ${score.missedLabels.slice(0, 14).join(', ')}${score.missedLabels.length > 14 ? '…' : ''}`] : []),
              ...(score.extraLabels.length ? [`Extra: ${score.extraLabels.slice(0, 14).join(', ')}${score.extraLabels.length > 14 ? '…' : ''}`] : []),
            ]}
          >
            Green = correct, gold = missed, red = shouldn’t be in the range. These charts are close approximations, not solver output.
          </FeedbackBanner>
        </>
      )}

      <Panel tone="night" className="!py-3">
        {submitted ? (
          <GameButton color="gold" size="lg" fullWidth onClick={() => next()}>
            Next seat
          </GameButton>
        ) : (
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <GameButton color="cream" onClick={() => setPainted(new Set())}>
              Clear
            </GameButton>
            <GameButton color="gold" onClick={submit}>
              Check my range
            </GameButton>
          </div>
        )}
      </Panel>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GRADE_XP, actionStats, formatPercent, scorePaint, type Grade } from '../../engine';
import { useActiveChart } from '../../state/chartStore';
import { useDrillStats } from '../../state/drillStatsStore';
import { useProgress } from '../../state/progressStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Celebration, FeedbackBanner, GameButton, Panel, RangeGrid } from '../../components/ui';

export function PaintRangeScreen() {
  const navigate = useNavigate();
  const chart = useActiveChart();
  const seats = chart.openingSeats;
  const [seat, setSeat] = useState(() => seats[Math.floor(Math.random() * seats.length)]!);
  const [painted, setPainted] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [start, setStart] = useState(() => performance.now());
  const record = useDrillStats((s) => s.record);
  const addXp = useProgress((s) => s.addXp);
  const recordPractice = useProgress((s) => s.recordPractice);

  const range = chart.rfi(seat)!.ranges.raise!;
  const stats = actionStats(range);
  const score = useMemo(() => scorePaint(painted, range), [painted, range]);
  const grade: Grade = score.accuracy >= 0.85 ? 'best' : score.accuracy >= 0.65 ? 'acceptable' : 'mistake';

  const submit = () => {
    setSubmitted(true);
    record('preflop.paint', [`preflop.paint:${seat}`, `preflop.seat:${seat}`], grade, performance.now() - start);
    addXp(GRADE_XP[grade] * 2);
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
        Paint every hand the <span className="text-gold-300">{seat}</span> opens when folded to.
      </p>

      <RangeGrid selected={painted} onChange={submitted ? undefined : setPainted} highlight={overlay} showStats={!submitted} />

      {submitted && (
        <>
          {grade === 'best' && <Celebration />}
          <FeedbackBanner
            tone={grade}
            title={`${formatPercent(score.accuracy, 0)} combo accuracy`}
            math={[
              `Real ${seat} range: ${formatPercent(stats.fraction)} of hands (${stats.combos} combos)`,
              `Correct: ${score.correct} combos · Missed: ${score.missed} · Extra: ${score.extra}`,
              `Accuracy = correct / (correct + missed + extra) = ${score.correct} / ${score.correct + score.missed + score.extra}`,
              ...(score.missedLabels.length ? [`Missed: ${score.missedLabels.slice(0, 14).join(', ')}${score.missedLabels.length > 14 ? '…' : ''}`] : []),
              ...(score.extraLabels.length ? [`Extra: ${score.extraLabels.slice(0, 14).join(', ')}${score.extraLabels.length > 14 ? '…' : ''}`] : []),
            ]}
          >
            Green = correct, gold = missed, red = shouldn’t open. These charts are close approximations, not solver output.
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

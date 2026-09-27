import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DIFFICULTY_INFO,
  GRADE_LABEL,
  GRADE_XP,
  ROUND_LENGTH,
  buildQuestion,
  formatPercent,
  type Choice,
  type Grade,
  type Question,
  type RoundSpec,
} from '../../engine';
import { useDrillStats } from '../../state/drillStatsStore';
import { useProgress } from '../../state/progressStore';
import { toast } from '../../state/toastStore';
import { Celebration, FeedbackBanner, GameButton, Panel, ProgressBar, RichText } from '../ui';
import { QuestionContextView } from './QuestionView';
import { StrategyGrid } from '../ui/StrategyGrid';
import { FlameIcon } from '../icons/FlameIcon';

export interface RoundResult {
  kind: string;
  grade: Grade;
  ms: number;
}

interface DrillRunnerProps {
  title: string;
  spec: Omit<RoundSpec, 'skills' | 'seed'>;
  /** Called when the player leaves (back button or after the summary). */
  onExit: () => void;
  /** Optional custom question source (e.g. preflop drills); defaults to buildQuestion. */
  makeQuestion?: (spec: RoundSpec, index: number) => Question;
  length?: number;
}

function Timer({ start, limit, stopped }: { start: number; limit: number | null; stopped: boolean }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (stopped) return;
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, [stopped]);
  const elapsed = Math.max(0, (now - start) / 1000);
  const shown = limit ? Math.max(0, limit - elapsed) : elapsed;
  const urgent = limit !== null && shown < 5;
  return (
    <span className={`font-display text-lg tabular-nums ${urgent ? 'animate-pulse text-[#ff9c94]' : 'text-cream'}`}>
      {shown.toFixed(1)}s
    </span>
  );
}

/** Plays one round of questions with timer, streak, graded feedback and a summary. */
export function DrillRunner({ title, spec, onExit, makeQuestion = buildQuestion, length = ROUND_LENGTH }: DrillRunnerProps) {
  const skills = useDrillStats((s) => s.skills);
  const record = useDrillStats((s) => s.record);
  const recordStreak = useDrillStats((s) => s.recordStreak);
  const addXp = useProgress((s) => s.addXp);
  const recordPractice = useProgress((s) => s.recordPractice);

  // Skills are snapshotted at round start so answers mid-round don't reshuffle upcoming questions.
  const [roundSeed, setRoundSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const skillSnapshot = useMemo(() => skills, [roundSeed]); // eslint-disable-line react-hooks/exhaustive-deps
  const fullSpec: RoundSpec = { ...spec, skills: skillSnapshot, seed: roundSeed };

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Choice | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [xpEarned, setXpEarned] = useState(0);
  const [start, setStart] = useState(() => performance.now());
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const question = useMemo(() => {
    try {
      return makeQuestion(fullSpec, index);
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, [roundSeed, index]); // eslint-disable-line react-hooks/exhaustive-deps

  const limit = DIFFICULTY_INFO[spec.difficulty].secondsPerQuestion;
  const answered = answer !== null || timedOut;
  const multiplier = DIFFICULTY_INFO[spec.difficulty].xpMultiplier;

  const finishAnswer = (grade: Grade) => {
    if (!question) return;
    const ms = performance.now() - start;
    record(question.kind, [question.skill, ...(question.tags ?? [])], grade, ms);
    setResults((r) => [...r, { kind: question.kind, grade, ms }]);
    const xp = Math.round(GRADE_XP[grade] * multiplier);
    addXp(xp);
    setXpEarned((x) => x + xp);
    if (grade === 'mistake') {
      setStreak(0);
    } else {
      const s = streak + 1;
      setStreak(s);
      setBestStreak((b) => Math.max(b, s));
      recordStreak(question.kind, s);
      if (grade === 'best') toast({ tone: 'best', title: s >= 3 ? `${s} in a row!` : 'Nice!', message: `+${xp} XP` });
    }
  };

  // Diamond: running out of time counts as a mistake.
  const timeoutRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!limit || answered || !question) return;
    timeoutRef.current = window.setTimeout(() => {
      setTimedOut(true);
      finishAnswer('mistake');
    }, limit * 1000);
    return () => window.clearTimeout(timeoutRef.current);
  }, [index, roundSeed, answered, question]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (c: Choice) => {
    if (answered) return;
    window.clearTimeout(timeoutRef.current);
    setAnswer(c);
    finishAnswer(c.grade);
  };

  const next = () => {
    if (index >= length - 1) {
      recordPractice();
      setShowSummary(true);
      return;
    }
    setIndex((i) => i + 1);
    setAnswer(null);
    setTimedOut(false);
    setStart(performance.now());
  };

  const restart = () => {
    setRoundSeed(Math.floor(Math.random() * 1e9));
    setIndex(0);
    setAnswer(null);
    setTimedOut(false);
    setStreak(0);
    setBestStreak(0);
    setResults([]);
    setXpEarned(0);
    setShowSummary(false);
    setStart(performance.now());
  };

  if (error) {
    return (
      <Panel tone="night" title="Oops">
        <p className="font-bold">Couldn't build a question: {error}</p>
        <GameButton className="mt-3" color="gold" onClick={restart}>
          Try again
        </GameButton>
      </Panel>
    );
  }

  if (showSummary) {
    return <RoundSummary title={title} results={results} bestStreak={bestStreak} xp={xpEarned} onAgain={restart} onExit={onExit} />;
  }
  if (!question) return null;

  const outcome: Grade | null = answer ? answer.grade : timedOut ? 'mistake' : null;
  const bestLabel = question.choices.find((c) => c.grade === 'best')?.label;

  return (
    <div className="flex min-h-[calc(100dvh-2rem)] flex-col gap-3">
      <div className="flex items-center gap-3">
        <GameButton size="sm" color="cream" aria-label="Quit drill" onClick={onExit}>
          ✕
        </GameButton>
        <ProgressBar className="flex-1" value={(index + (answered ? 1 : 0)) / length} color="gold" label={`${index + 1} / ${length}`} />
        <div className="flex min-w-16 flex-col items-end leading-none">
          <Timer key={`${roundSeed}-${index}`} start={start} limit={limit} stopped={answered} />
          <span className="flex items-center gap-0.5 font-display text-xs text-gold-300">
            <FlameIcon className="h-3.5 w-3.5" /> {streak}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          className="space-y-3"
        >
          <div className="text-center font-display text-xs tracking-widest text-cream/70">
            {title.toUpperCase()} · {DIFFICULTY_INFO[spec.difficulty].label.toUpperCase()}
          </div>
          <QuestionContextView context={question.context} />
          <h2 className="text-outline-sm text-center font-display text-2xl leading-tight text-white">
            <RichText text={question.prompt} />
          </h2>

          {answered && outcome && (
            <FeedbackBanner
              tone={outcome}
              title={timedOut ? "Time's up" : outcome === 'best' ? 'Correct!' : outcome === 'acceptable' ? 'Close enough' : `Answer: ${bestLabel}`}
              math={question.explanation.steps}
            >
              <RichText text={answer?.feedback ?? question.explanation.summary} />
              {question.visual && <StrategyGrid visual={question.visual} className="mt-2" />}
            </FeedbackBanner>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-auto space-y-2 pb-3">
        {answered ? (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              {question.choices.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-xl border-2 border-ink px-2 py-1 text-center text-xs font-bold ${
                    c.grade === 'best'
                      ? 'bg-felt-300 text-ink'
                      : c.grade === 'acceptable'
                        ? 'bg-[#6fb2ff] text-ink'
                        : c.id === answer?.id
                          ? 'bg-ruby text-white'
                          : 'bg-cream/80 text-ink/70'
                  }`}
                >
                  {c.label} · {GRADE_LABEL[c.grade]}
                  {c.note && <span className="block font-mono text-[11px]">{c.note}</span>}
                </div>
              ))}
            </div>
            <GameButton color="gold" size="lg" fullWidth onClick={next}>
              {index >= length - 1 ? 'See results' : 'Next'}
            </GameButton>
          </>
        ) : (
          <div className={`grid gap-2.5 ${question.choices.length === 3 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {question.choices.map((c) => (
              <GameButton key={c.id} color="cream" size="lg" className="min-h-16" onClick={() => choose(c)}>
                {c.label}
              </GameButton>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RoundSummary({
  title,
  results,
  bestStreak,
  xp,
  onAgain,
  onExit,
}: {
  title: string;
  results: RoundResult[];
  bestStreak: number;
  xp: number;
  onAgain: () => void;
  onExit: () => void;
}) {
  const right = results.filter((r) => r.grade !== 'mistake').length;
  const acc = results.length ? right / results.length : 0;
  const avg = results.length ? results.reduce((s, r) => s + r.ms, 0) / results.length / 1000 : 0;
  return (
    <div className="relative space-y-4 pt-4">
      {acc >= 0.7 && <Celebration count={40} />}
      <Panel tone="wood" title="Round complete">
        <div className="text-center">
          <div className="text-outline font-display text-5xl text-gold-300">
            {right}/{results.length}
          </div>
          <div className="font-display text-lg">{title}</div>
        </div>
      </Panel>
      <div className="grid grid-cols-3 gap-2">
        {[
          ['Accuracy', formatPercent(acc, 0)],
          ['Avg speed', `${avg.toFixed(1)}s`],
          ['Best streak', String(bestStreak)],
        ].map(([label, value]) => (
          <Panel key={label} tone="night" className="!px-2 text-center">
            <div className="font-display text-2xl text-gold-300">{value}</div>
            <div className="text-xs font-bold text-cream/80">{label}</div>
          </Panel>
        ))}
      </div>
      <Panel tone="felt" className="text-center">
        <div className="font-display text-3xl text-gold-300">+{xp} XP</div>
      </Panel>
      <div className="grid grid-cols-2 gap-3">
        <GameButton color="cream" onClick={onExit}>
          Done
        </GameButton>
        <GameButton color="gold" onClick={onAgain}>
          Play again
        </GameButton>
      </div>
    </div>
  );
}

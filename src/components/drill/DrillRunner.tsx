import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DIFFICULTY_INFO,
  GRADE_LABEL,
  ROUND_LENGTH,
  answerXp,
  buildQuestion,
  formatPercent,
  roundBonusXp,
  type Choice,
  type Grade,
  type Question,
  type RoundSpec,
} from '../../engine';
import { useDrillStats } from '../../state/drillStatsStore';
import { useProgress } from '../../state/progressStore';
import { useRewards } from '../../state/rewardsStore';
import { toast } from '../../state/toastStore';
import { ActionDock, Celebration, FeedbackBanner, GameButton, Panel, ProgressBar, RichText } from '../ui';
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
  const runs = useDrillStats((s) => s.runs);
  const recordRound = useRewards((s) => s.recordRound);
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
  const [bonus, setBonus] = useState<{ xp: number; working: string } | null>(null);

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

  const finishAnswer = (grade: Grade) => {
    if (!question) return;
    const ms = performance.now() - start;
    record(question.kind, [question.skill, ...(question.tags ?? [])], grade, ms);
    setResults((r) => [...r, { kind: question.kind, grade, ms }]);
    const xp = answerXp(grade, question.difficulty ?? spec.difficulty, question.confidence);
    addXp(xp);
    setXpEarned((x) => x + xp);
    if (grade === 'mistake') {
      setStreak(0);
    } else {
      const s = streak + 1;
      setStreak(s);
      setBestStreak((b) => Math.max(b, s));
      // The kind's run carries across rounds (Pot Odds Pro counts 50 in a row).
      const run = (runs[question.kind] ?? 0) + 1;
      if (grade === 'best') toast({ tone: 'best', title: s >= 3 ? `${s} in a row!` : 'Nice!', message: run > s && run >= 5 ? `+${xp} XP · ${run} straight on this drill` : `+${xp} XP` });
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

  // After answering, bring the explanation into view (the Next button is pinned at the bottom).
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (answered) feedbackRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [answered]);
  // Each new question starts at the top.
  useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, [index, roundSeed]);

  const choose = (c: Choice) => {
    if (answered) return;
    window.clearTimeout(timeoutRef.current);
    setAnswer(c);
    finishAnswer(c.grade);
  };

  const next = () => {
    if (index >= length - 1) {
      const right = results.filter((r) => r.grade !== 'mistake').length;
      const bonus = roundBonusXp(right, results.length, spec.difficulty);
      setBonus(bonus);
      if (bonus.xp) addXp(bonus.xp);
      recordRound(right, results.length, spec.difficulty);
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
    setBonus(null);
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
    return <RoundSummary title={title} results={results} bestStreak={bestStreak} xp={xpEarned} bonus={bonus} onAgain={restart} onExit={onExit} />;
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
            <div ref={feedbackRef} className="scroll-mt-3 space-y-3">
            <FeedbackBanner
              tone={outcome}
              title={timedOut ? "Time's up" : outcome === 'best' ? 'Correct!' : outcome === 'acceptable' ? 'Close enough' : `Answer: ${bestLabel}`}
              math={question.explanation.steps}
              confidence={question.confidence}
              confidenceNote={question.confidenceNote}
              source={question.source}
            >
              <RichText text={answer?.feedback ?? question.explanation.summary} />
              {question.visual && <StrategyGrid visual={question.visual} className="mt-2" />}
              {question.visuals?.map((v, i) => <StrategyGrid key={i} visual={v} className="mt-2" />)}
            </FeedbackBanner>
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
                  <RichText text={c.label} /> · {GRADE_LABEL[c.grade]}
                  {c.note && <span className="block font-mono text-[11px]">{c.note}</span>}
                </div>
              ))}
            </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* The current action is always pinned at the bottom: the choices, then Next. */}
      <ActionDock className="mt-auto">
        {answered ? (
          <GameButton color="gold" size="lg" fullWidth onClick={next}>
            {index >= length - 1 ? 'See results' : 'Next'}
          </GameButton>
        ) : (
          <div className={`grid gap-2.5 ${question.choices.length === 3 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {question.choices.map((c) => (
              <GameButton key={c.id} color="cream" size={question.choices.length > 4 ? 'md' : 'lg'} className="min-h-14" onClick={() => choose(c)}>
                <RichText text={c.label} />
              </GameButton>
            ))}
          </div>
        )}
      </ActionDock>
    </div>
  );
}

function RoundSummary({
  title,
  results,
  bestStreak,
  xp,
  bonus,
  onAgain,
  onExit,
}: {
  bonus: { xp: number; working: string } | null;
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
        <div className="font-display text-3xl text-gold-300">+{xp + (bonus?.xp ?? 0)} XP</div>
        {bonus && (
          <div className="mt-1 text-xs font-bold text-cream/85">
            {xp} from answers + {bonus.xp} accuracy bonus
            <div className="mt-1 rounded-lg bg-ink/60 px-2 py-1 font-mono text-[11px] text-gold-300">{bonus.working}</div>
          </div>
        )}
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

import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ALL_LESSONS, dyn, lessonById, type Block } from '../../content/learn';
import { useLearn } from '../../state/learnStore';
import { useProgress } from '../../state/progressStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ActionDock, Celebration, FeedbackBanner, GameButton, Panel, RichText } from '../../components/ui';
import { LessonExample } from '../../components/learn/Examples';

function BlockView({ b }: { b: Block }) {
  switch (b.kind) {
    case 'h':
      return <h3 className="text-outline-sm font-display text-xl text-gold-300">{b.text}</h3>;
    case 'p':
      return (
        <p className="text-[15px] font-semibold leading-relaxed text-cream">
          <RichText text={dyn(b.text)} />
        </p>
      );
    case 'list':
      return (
        <ul className="space-y-1 pl-1">
          {b.items.map((it, i) => (
            <li key={i} className="flex gap-2 text-[15px] font-semibold text-cream">
              <span className="mt-2 h-2 w-2 shrink-0 rotate-45 rounded-[2px] bg-gold-500" />
              <span>
                <RichText text={dyn(it)} />
              </span>
            </li>
          ))}
        </ul>
      );
    case 'tip':
      return (
        <div className="rounded-2xl border-[3px] border-ink bg-felt-300/90 p-2.5 text-sm font-bold text-ink">
          Tip: <RichText text={dyn(b.text)} />
        </div>
      );
    case 'todo':
      return (
        <div className="rounded-2xl border-[3px] border-dashed border-gold-300 bg-ink/40 p-2.5 text-xs font-bold text-gold-300" role="note">
          REVIEW (TODO): {b.text}
        </div>
      );
    case 'example':
      return <LessonExample id={b.example} />;
  }
}

function Quiz({ lessonId, onDone }: { lessonId: string; onDone: (score: number, total: number) => void }) {
  const lesson = lessonById(lessonId)!;
  const questions = useMemo(
    () => lesson.quiz.map((q) => ({ prompt: dyn(q.prompt), choices: q.choices.map(dyn), answer: q.answer, why: dyn(q.why) })),
    [lesson],
  );
  // Shuffle choice order once per quiz so the answer isn't always first.
  const orders = useMemo(() => questions.map((q) => q.choices.map((_, i) => i).sort(() => Math.random() - 0.5)), [questions]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const q = questions[i]!;
  const correct = picked === q.answer;
  return (
    <>
    <Panel tone="cream" title={`Quiz ${i + 1}/${questions.length}`}>
      <p className="mb-2 font-display text-lg text-ink">
        <RichText text={q.prompt} />
      </p>
      <div className="grid gap-2">
        {orders[i]!.map((ci) => (
          <GameButton
            key={ci}
            color={picked === null ? 'cream' : ci === q.answer ? 'green' : ci === picked ? 'red' : 'cream'}
            size="sm"
            className="!h-auto min-h-11 py-2"
            disabled={picked !== null && ci !== picked && ci !== q.answer}
            onClick={() => {
              if (picked !== null) return;
              setPicked(ci);
              if (ci === q.answer) setScore((s) => s + 1);
            }}
          >
            <RichText text={q.choices[ci]!} />
          </GameButton>
        ))}
      </div>
      <AnimatePresence>
        {picked !== null && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-3">
            <FeedbackBanner tone={correct ? 'best' : 'mistake'} title={correct ? 'Correct!' : 'Not quite'}>
              <RichText text={q.why} />
            </FeedbackBanner>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
    {picked !== null && (
      <ActionDock tabs>
        <GameButton
          color="gold"
          size="lg"
          fullWidth
          onClick={() => {
            if (i + 1 >= questions.length) onDone(score, questions.length);
            else {
              setI(i + 1);
              setPicked(null);
            }
          }}
        >
          {i + 1 >= questions.length ? 'Finish' : 'Next question'}
        </GameButton>
      </ActionDock>
    )}
    </>
  );
}

export function LessonScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const lesson = lessonById(id ?? '');
  const complete = useLearn((s) => s.complete);
  const addXp = useProgress((s) => s.addXp);
  const recordPractice = useProgress((s) => s.recordPractice);
  const [phase, setPhase] = useState<'read' | 'quiz' | 'done'>('read');
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  if (!lesson) {
    return (
      <Panel tone="night" title="Lesson not found">
        <GameButton color="gold" onClick={() => navigate('/learn')}>
          Back to Learn
        </GameButton>
      </Panel>
    );
  }
  const idx = ALL_LESSONS.findIndex((l) => l.id === lesson.id);
  const next = ALL_LESSONS[idx + 1];

  return (
    <div className="relative space-y-4">
      <ScreenHeader
        title={lesson.title}
        subtitle={`Unit ${lesson.unitNumber} · ${lesson.minutes} min`}
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate('/learn')}>
            Back
          </GameButton>
        }
      />
      {phase === 'read' && (
        <>
          <div className="space-y-3">
            {lesson.blocks.map((b, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 6) * 0.05 }}>
                <BlockView b={b} />
              </motion.div>
            ))}
          </div>
          <ActionDock tabs>
            <GameButton color="gold" size="lg" fullWidth onClick={() => setPhase('quiz')}>
              Take the quiz
            </GameButton>
          </ActionDock>
        </>
      )}
      {phase === 'quiz' && (
        <Quiz
          lessonId={lesson.id}
          onDone={(score, total) => {
            complete(lesson.id, score, total);
            addXp(Math.round(30 * (score / total)) + (score === total ? 10 : 0));
            recordPractice();
            setResult({ score, total });
            setPhase('done');
          }}
        />
      )}
      {phase === 'done' && result && (
        <>
          {result.score === result.total && <Celebration count={36} />}
          <Panel tone="wood" title="Lesson complete">
            <div className="text-center">
              <div className="text-outline font-display text-5xl text-gold-300">
                {result.score}/{result.total}
              </div>
              <div className="font-display">+{Math.round(30 * (result.score / result.total)) + (result.score === result.total ? 10 : 0)} XP</div>
            </div>
          </Panel>
          <GameButton color="green" size="lg" fullWidth onClick={() => navigate(lesson.drill.route)}>
            Practice: {lesson.drill.label}
          </GameButton>
          {lesson.moreDrills?.map((d) => (
            <GameButton key={d.route} color="blue" size="sm" fullWidth onClick={() => navigate(d.route)}>
              Also: {d.label}
            </GameButton>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <GameButton color="cream" onClick={() => setPhase('read')}>
              Re-read
            </GameButton>
            {next ? (
              <GameButton
                color="gold"
                onClick={() => {
                  setPhase('read');
                  setResult(null);
                  navigate(`/learn/${next.id}`);
                }}
              >
                Next lesson
              </GameButton>
            ) : (
              <GameButton color="gold" onClick={() => navigate('/learn')}>
                All lessons
              </GameButton>
            )}
          </div>
        </>
      )}
    </div>
  );
}

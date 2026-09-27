import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CURRICULUM } from '../content/learn';
import { useLearn } from '../state/learnStore';
import { ScreenHeader } from '../components/ScreenHeader';
import { GameButton, Panel, ProgressBar } from '../components/ui';

export function LearnScreen() {
  const navigate = useNavigate();
  const done = useLearn((s) => s.lessons);
  const total = CURRICULUM.reduce((s, u) => s + u.lessons.length, 0);
  const completed = Object.keys(done).length;
  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Learn"
        subtitle={`${completed}/${total} lessons complete`}
        right={
          <GameButton size="sm" color="purple" onClick={() => navigate('/learn/glossary')}>
            Glossary
          </GameButton>
        }
      />
      <ProgressBar value={completed / total} color="purple" label={`${completed} / ${total}`} />
      {CURRICULUM.map((u, ui) => {
        const unitDone = u.lessons.filter((l) => done[l.id]).length;
        return (
          <Panel key={u.id} tone={ui % 2 ? 'night' : 'cream'} title={`Unit ${u.number}: ${u.title}`}>
            <p className={`mb-2 text-sm font-bold ${ui % 2 ? 'text-cream/80' : 'text-ink/70'}`}>
              {u.blurb} · {unitDone}/{u.lessons.length}
            </p>
            <div className="space-y-1.5">
              {u.lessons.map((l, i) => {
                const rec = done[l.id];
                return (
                  <motion.button
                    key={l.id}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/learn/${l.id}`)}
                    className="flex min-h-12 w-full items-center gap-2 rounded-xl border-2 border-ink bg-white/80 px-2.5 py-1.5 text-left text-ink"
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-ink font-display ${rec ? 'bg-felt-300' : 'bg-cream-dark'}`}>
                      {rec ? '✓' : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display leading-tight">{l.title}</span>
                      <span className="block truncate text-xs font-semibold text-ink/65">{l.blurb}</span>
                    </span>
                    <span className="shrink-0 text-right text-[11px] font-bold text-ink/60">
                      {l.minutes} min
                      {rec && (
                        <span className="block">
                          {rec.bestScore}/{rec.total}
                        </span>
                      )}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}

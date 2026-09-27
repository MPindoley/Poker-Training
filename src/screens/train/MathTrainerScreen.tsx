import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { DIFFICULTIES, DIFFICULTY_INFO, MATH_DRILLS, accuracy, averageMs, formatPercent, type Difficulty } from '../../engine';
import { useDrillStats } from '../../state/drillStatsStore';
import { useSettings } from '../../state/settingsStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GameButton, Panel } from '../../components/ui';
import { MedalIcon } from '../../components/icons/MedalIcon';

export function MathTrainerScreen() {
  const navigate = useNavigate();
  const kinds = useDrillStats((s) => s.kinds);
  const difficulty = useSettings((s) => s.mathDifficulty);
  const setDifficulty = useSettings((s) => s.setMathDifficulty);

  const play = (kind: string) => navigate(`/train/math/play?kind=${encodeURIComponent(kind)}&d=${difficulty}`);

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Math Trainer"
        subtitle="10-question rounds. Every answer computed by the engine."
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate('/train')}>
            Back
          </GameButton>
        }
      />

      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Difficulty">
        {DIFFICULTIES.map((d: Difficulty) => (
          <motion.button
            key={d}
            type="button"
            role="radio"
            aria-checked={difficulty === d}
            whileTap={{ scale: 0.9 }}
            onClick={() => setDifficulty(d)}
            className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border-[3px] border-ink py-1.5 shadow-chunky-sm ${
              difficulty === d ? 'bg-gradient-to-b from-gold-300 to-gold-700 text-ink' : 'bg-ink/40 text-cream'
            }`}
          >
            <MedalIcon tier={d} className="h-7 w-7" />
            <span className="font-display text-sm">{DIFFICULTY_INFO[d].label}</span>
          </motion.button>
        ))}
      </div>
      <p className="-mt-2 text-center text-sm font-bold text-cream/85">{DIFFICULTY_INFO[difficulty].blurb}</p>

      {difficulty === 'diamond' ? (
        <GameButton color="purple" size="lg" fullWidth onClick={() => play('mixed')}>
          Start Diamond Mix
        </GameButton>
      ) : (
        <GameButton color="gold" size="lg" fullWidth onClick={() => play('mixed')}>
          Mixed round
        </GameButton>
      )}

      <div className="grid grid-cols-2 gap-3">
        {MATH_DRILLS.map((d, i) => {
          const rec = kinds[d.kind];
          const acc = accuracy(rec);
          const ms = averageMs(rec);
          return (
            <motion.button
              key={d.kind}
              type="button"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 24 }}
              whileTap={{ scaleX: 1.04, scaleY: 0.92 }}
              onClick={() => play(d.kind)}
              className="gloss flex min-h-32 flex-col justify-between rounded-3xl border-[3px] border-ink bg-gradient-to-b from-cream to-cream-dark p-3 text-left text-ink shadow-chunky"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl border-[3px] border-ink bg-ruby font-display text-lg text-white">
                {d.glyph}
              </span>
              <span>
                <span className="block font-display text-lg leading-tight">{d.title}</span>
                <span className="block text-xs font-bold text-ink/70">{d.blurb}</span>
                <span className="mt-1 block text-[11px] font-bold text-emerald-dark">
                  {acc === null ? 'Not played yet' : `${formatPercent(acc, 0)} · ${((ms ?? 0) / 1000).toFixed(1)}s avg`}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <Panel tone="wood">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-xl">Cheat Sheet</div>
            <div className="text-sm font-semibold text-cream/85">Outs, pot odds and MDF tables</div>
          </div>
          <GameButton color="gold" size="sm" onClick={() => navigate('/train/math/cheatsheet')}>
            Open
          </GameButton>
        </div>
      </Panel>
    </div>
  );
}

import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AREA_NAMES, arenaForLevel, dayKey, taskProgress } from '../engine';
import { routeForKind } from '../lib/routes';
import { liveStreak, useProgress } from '../state/progressStore';
import { useLevel } from '../state/progression';
import { useRewards } from '../state/rewardsStore';
import { useEvents } from '../state/eventsStore';
import { useLive } from '../state/liveStore';
import { ScreenHeader } from '../components/ScreenHeader';
import { GameButton, Panel, ProgressBar, XPBadge } from '../components/ui';
import { FlameIcon } from '../components/icons/FlameIcon';
import { ChestIcon } from '../components/icons/ChestIcon';

export function HomeScreen() {
  const navigate = useNavigate();
  const lvl = useLevel();
  const streak = useProgress((s) => s.streak);
  const last = useProgress((s) => s.lastPracticeDay);
  const daily = useRewards((s) => s.daily);
  const chests = useRewards((s) => s.chests);
  const setChestOpen = useEvents((s) => s.setChestOpen);
  const liveActive = useLive((s) => !!s.active);
  const arena = arenaForLevel(lvl.level);
  const shownStreak = liveStreak(streak, last);
  const practisedToday = last === dayKey(new Date());
  const tasks = daily.day === dayKey(new Date()) ? daily.tasks : [];
  const doneCount = tasks.filter((t) => taskProgress(t, daily.counts) >= 1).length;

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Felt Academy"
        subtitle={`${arena.name} · Master the math. Read the people.`}
        right={
          <button type="button" aria-label="Open profile" onClick={() => navigate('/profile')} className="min-h-11 min-w-11">
            <XPBadge level={lvl.level} progress={lvl.progress} />
          </button>
        }
      />

      <Panel tone="night">
        <div className="flex items-center justify-between font-display">
          <span className="text-lg">Level {lvl.level}</span>
          <motion.span
            className="flex items-center gap-1.5 text-lg text-gold-300"
            animate={practisedToday ? { scale: [1, 1.15, 1] } : undefined}
            transition={{ duration: 0.6 }}
          >
            <FlameIcon className={`h-6 w-6 ${practisedToday ? '' : 'opacity-60 grayscale'}`} /> {shownStreak} day streak
          </motion.span>
        </div>
        <ProgressBar className="mt-2" value={lvl.progress} color="gold" label={`${lvl.xpIntoLevel} / ${lvl.xpForNextLevel} XP`} />
        {!practisedToday && shownStreak > 0 && <p className="mt-1.5 text-xs font-bold text-cream/80">Train today to keep your streak alive.</p>}
      </Panel>

      {chests > 0 && (
        <motion.button
          type="button"
          onClick={() => setChestOpen(true)}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileTap={{ scale: 0.95 }}
          className="gloss flex min-h-14 w-full items-center gap-3 rounded-3xl border-[3px] border-ink bg-gradient-to-b from-gold-300 to-gold-700 px-4 py-2 text-left text-ink shadow-chunky"
        >
          <motion.span animate={{ rotate: [0, -6, 6, 0] }} transition={{ repeat: Infinity, duration: 1.4, repeatDelay: 1 }}>
            <ChestIcon className="h-12 w-12" />
          </motion.span>
          <span className="flex-1 font-display text-xl">
            {chests} reward chest{chests > 1 ? 's' : ''} waiting
          </span>
          <span className="font-display text-lg">Open</span>
        </motion.button>
      )}

      <Panel tone="wood" title={`Daily Training ${doneCount}/${tasks.length || 3}`}>
        {tasks.length === 0 ? (
          <p className="text-center font-semibold text-cream/90">Picking today's tasks…</p>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t, i) => {
              const p = taskProgress(t, daily.counts);
              const done = p >= 1;
              return (
                <motion.li
                  key={t.id}
                  initial={{ x: -16, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.07 }}
                  className={`flex items-center gap-2 rounded-2xl border-2 border-ink px-3 py-2 ${done ? 'bg-felt-500' : 'bg-ink/40'}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base leading-tight">{t.title}</div>
                    <div className="text-[11px] font-bold text-cream/80">
                      {AREA_NAMES[t.area]} · {Math.min(t.target, daily.counts[t.kind] ?? 0)}/{t.target} answers
                    </div>
                    <ProgressBar className="mt-1" value={p} color={done ? 'gold' : 'green'} />
                  </div>
                  {done ? (
                    <span className="grid h-11 w-11 place-items-center rounded-full border-[3px] border-ink bg-gold-500 font-display text-xl text-ink">✓</span>
                  ) : (
                    <GameButton size="sm" color="gold" onClick={() => navigate(routeForKind(t.kind))}>
                      Go
                    </GameButton>
                  )}
                </motion.li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 flex items-center justify-center gap-1 text-xs font-bold text-cream/90">
          <ChestIcon className="h-5 w-5" /> {daily.chestGiven ? 'Chest earned today!' : 'Finish all three for a reward chest. Picked from your weakest areas.'}
        </p>
      </Panel>

      <div className="space-y-3">
        <GameButton color="green" size="lg" fullWidth onClick={() => navigate('/train/session?type=quick')}>
          Quick Drill (2 min)
        </GameButton>
        <GameButton color="blue" size="lg" fullWidth onClick={() => navigate('/train/session?type=warmup')}>
          Pre-Game Warm-Up
        </GameButton>
        <GameButton color="purple" size="lg" fullWidth onClick={() => navigate('/review/log')}>
          Log Last Night's Hands
        </GameButton>
        <GameButton color="gold" size="lg" fullWidth onClick={() => navigate('/review/live')}>
          {liveActive ? 'Back to Live Session' : 'Start Live Session'}
        </GameButton>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <GameButton color="cream" size="sm" onClick={() => navigate('/profile')}>
          Profile
        </GameButton>
        <GameButton color="cream" size="sm" onClick={() => navigate('/styleguide')}>
          Styleguide
        </GameButton>
      </div>
    </div>
  );
}

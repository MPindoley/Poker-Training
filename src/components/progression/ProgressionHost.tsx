import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ACHIEVEMENTS, arenasUnlocked, dailyTasks, dayKey, skillRadar, taskProgress } from '../../engine';
import { haptic } from '../../lib/haptics';
import { sfx } from '../../lib/sound';
import { useDrillStats } from '../../state/drillStatsStore';
import { useEvents } from '../../state/eventsStore';
import { useAchievementSnapshot, useProgressHydrated } from '../../state/progression';
import { useRewards } from '../../state/rewardsStore';
import { toast } from '../../state/toastStore';
import { unlockedAchievements } from '../../engine';
import { ChestIcon } from '../icons/ChestIcon';
import { Celebration, GameButton } from '../ui';
import { ChestSheet } from './ChestSheet';

/** Drills and the table: celebrations wait until the player leaves them. */
const IMMERSIVE = [/^\/train\/[^/]+\/play/, /^\/train\/session/, /^\/play\/table/];

/**
 * Watches saved progress and turns milestones into rewards: level-ups, achievements and daily-task
 * completion each grant chests and a celebration. Mounted once in App.
 */
export function ProgressionHost() {
  const hydrated = useProgressHydrated();
  const location = useLocation();
  const immersive = IMMERSIVE.some((re) => re.test(location.pathname));
  const snapshot = useAchievementSnapshot();
  const rewards = useRewards();
  const queue = useEvents((s) => s.queue);
  const shift = useEvents((s) => s.shift);
  const setChestOpen = useEvents((s) => s.setChestOpen);
  const toasted = useRef(new Set<string>());

  // Daily tasks: roll today's list (after hydration, so it reflects real stats).
  useEffect(() => {
    if (!hydrated) return;
    const roll = () => {
      const today = dayKey(new Date());
      const kinds = useDrillStats.getState().kinds;
      useRewards.getState().ensureDaily(today, () => dailyTasks(today, skillRadar(kinds), kinds));
    };
    roll();
    const onVisible = () => document.visibilityState === 'visible' && roll();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [hydrated]);

  // Daily task completion.
  const { daily } = rewards;
  useEffect(() => {
    if (!hydrated || daily.day !== dayKey(new Date())) return;
    for (const t of daily.tasks) {
      if (!daily.done.includes(t.id) && taskProgress(t, daily.counts) >= 1) {
        rewards.markTaskDone(t.id);
        toast({ tone: 'best', title: 'Daily task done!', message: t.title });
        sfx('achievement');
      }
    }
    const allDone = daily.tasks.length > 0 && daily.tasks.every((t) => taskProgress(t, daily.counts) >= 1);
    if (allDone && !daily.chestGiven) {
      rewards.markDailyChest();
      rewards.grantChests(1);
      useEvents.getState().push({ type: 'daily' });
    }
  }, [hydrated, daily]); // eslint-disable-line react-hooks/exhaustive-deps

  // Achievements.
  useEffect(() => {
    if (!hydrated) return;
    const have = useRewards.getState().achievements;
    for (const id of unlockedAchievements(snapshot)) {
      if (have[id]) continue;
      const a = ACHIEVEMENTS.find((x) => x.id === id)!;
      useRewards.getState().unlockAchievement(id);
      if (a.chest) useRewards.getState().grantChests(1);
      useEvents.getState().push({ type: 'achievement', id });
    }
  }, [hydrated, snapshot]);

  // Small notices show immediately; the level-up modal waits for a calm screen.
  const head = queue[0];
  useEffect(() => {
    if (!head) return;
    if (head.type === 'achievement') {
      const a = ACHIEVEMENTS.find((x) => x.id === head.id)!;
      toast({ tone: 'best', title: `Achievement: ${a.name}`, message: a.chest ? `${a.description} · +1 chest` : a.description });
      sfx('achievement');
      haptic('success');
      shift();
    } else if (head.type === 'daily') {
      toast({ tone: 'best', title: 'Daily Training complete!', message: '+1 reward chest' });
      sfx('levelUp');
      shift();
    } else if (head.type === 'levelUp' && immersive) {
      const key = `lvl-${head.to}`;
      if (!toasted.current.has(key)) {
        toasted.current.add(key);
        toast({ tone: 'best', title: `Level ${head.to}!`, message: '+1 reward chest' });
        sfx('levelUp');
      }
    }
  }, [head, immersive, shift]);

  const levelUp = head?.type === 'levelUp' && !immersive ? head : null;
  const arenas = levelUp ? arenasUnlocked(levelUp.from, levelUp.to) : [];
  useEffect(() => {
    if (levelUp && !toasted.current.has(`lvl-${levelUp.to}`)) {
      toasted.current.add(`lvl-${levelUp.to}`);
      sfx('levelUp');
      haptic('success');
    }
  }, [levelUp]);

  return (
    <>
      <AnimatePresence>
        {levelUp && (
          <motion.div
            key={`lvl-${levelUp.to}`}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/75 px-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Level up"
          >
            <motion.div
              initial={{ scale: 0.5, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14 }}
              className="relative w-full max-w-[340px] rounded-3xl border-[3px] border-ink bg-gradient-to-b from-[#3a2d5c] to-[#241a3d] p-5 text-center shadow-chunky"
            >
              <Celebration count={48} />
              <div className="font-display text-lg tracking-widest text-cream/80">LEVEL UP</div>
              <motion.div
                initial={{ scale: 0.2, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 10, delay: 0.15 }}
                className="text-outline mx-auto my-2 grid h-28 w-28 place-items-center rounded-full border-4 border-ink bg-gradient-to-b from-gold-300 to-gold-700 font-display text-6xl text-white shadow-chunky"
              >
                {levelUp.to}
              </motion.div>
              {arenas.map((a) => (
                <div key={a.id} className="mt-2 rounded-2xl border-2 border-ink bg-felt-700 px-3 py-2">
                  <div className="font-display text-sm text-cream/80">NEW ARENA UNLOCKED</div>
                  <div className="text-outline-sm font-display text-2xl text-gold-300">{a.name}</div>
                  <div className="text-xs font-bold text-cream/85">{a.blurb} · new table theme</div>
                </div>
              ))}
              <div className="mt-3 flex items-center justify-center gap-2 font-display text-lg text-gold-300">
                <ChestIcon className="h-10 w-10" /> +{levelUp.to - levelUp.from} reward chest{levelUp.to - levelUp.from > 1 ? 's' : ''}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <GameButton color="cream" onClick={shift}>
                  Later
                </GameButton>
                <GameButton
                  color="gold"
                  onClick={() => {
                    shift();
                    setChestOpen(true);
                  }}
                >
                  Open it!
                </GameButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ChestSheet />
    </>
  );
}

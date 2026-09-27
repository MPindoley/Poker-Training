/** Hooks that combine the saved stores into the snapshots the progression engine needs. */
import { useEffect, useMemo, useState } from 'react';
import { levelFromXp, skillRadar, type AchievementSnapshot, type AreaScore, type SkillArea } from '../engine';
import { ALL_LESSONS } from '../content/learn';
import { useChartStore, useCharts } from './chartStore';
import { useProfiles } from './profilesStore';
import { useSettings } from './settingsStore';
import { useLive } from './liveStore';
import { useDrillStats } from './drillStatsStore';
import { useHandLog } from './handLogStore';
import { useLearn } from './learnStore';
import { usePlayLog } from './playLogStore';
import { useProgress } from './progressStore';
import { ownedSet, useRewards } from './rewardsStore';

interface Persisted {
  persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void };
}
const PERSISTED: Persisted[] = [useProgress, useDrillStats, useRewards, useLearn, usePlayLog, useHandLog];

/** True once every progress-related store has loaded from IndexedDB. */
export function useProgressHydrated(): boolean {
  return useHydrated(PERSISTED);
}

const APP_STORES: Persisted[] = [...PERSISTED, useSettings, useChartStore, useProfiles, useLive];
/** True once every saved store has loaded (the app shows a splash until then). */
export function useAppHydrated(): boolean {
  return useHydrated(APP_STORES);
}

function useHydrated(stores: Persisted[]): boolean {
  const all = () => stores.every((s) => s.persist.hasHydrated());
  const [ready, setReady] = useState(all);
  useEffect(() => {
    if (ready) return;
    const unsubs = stores.map((s) => s.persist.onFinishHydration(() => setReady(all())));
    setReady(all());
    return () => unsubs.forEach((u) => u());
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  return ready;
}

export function useRadar(): Record<SkillArea, AreaScore> {
  const kinds = useDrillStats((s) => s.kinds);
  return useMemo(() => skillRadar(kinds), [kinds]);
}

export function useLevel() {
  const xp = useProgress((s) => s.xp);
  return levelFromXp(xp);
}

export function useAchievementSnapshot(): AchievementSnapshot {
  const xp = useProgress((s) => s.xp);
  const streak = useProgress((s) => s.streak);
  const bestStreak = useProgress((s) => s.bestStreak);
  const kinds = useDrillStats((s) => s.kinds);
  const bestRuns = useDrillStats((s) => s.bestStreaks);
  const rewards = useRewards();
  const lessons = useLearn((s) => s.lessons);
  const sessions = usePlayLog((s) => s.sessions);
  const hands = useHandLog((s) => s.hands);
  const charts = useCharts();
  return useMemo(() => {
    const level = levelFromXp(xp).level;
    return {
      level,
      bestDayStreak: Math.max(streak, bestStreak ?? 0),
      kinds,
      bestRuns,
      paintBest: rewards.paintBest,
      paintSeats: Object.fromEntries(Object.values(charts).map((c) => [c.id, c.openingSeats])),
      lessonsDone: ALL_LESSONS.filter((l) => lessons[l.id]).length,
      lessonsTotal: ALL_LESSONS.length,
      perfectRounds: rewards.perfectRounds,
      diamondRounds: rewards.diamondRounds,
      tableHands: sessions.reduce((n, s) => n + s.hands.length, 0),
      loggedHands: hands.length,
      cosmeticsOwned: ownedSet(rewards.owned, level).size,
      dailyTasksDone: rewards.dailyTasksDone,
    };
  }, [xp, streak, bestStreak, kinds, bestRuns, rewards, lessons, sessions, hands, charts]);
}

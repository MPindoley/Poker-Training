import { useEffect, useState } from 'react';
import { REGULAR_MODEL, heroOf, migrateLoggedHand, opponentsOf, profileModel, type AnalyzeLoggedOptions, type LoggedHand, type LoggedHandAnalysis, type PlayerStats, type Profile, type VillainModel } from '../../engine';
import { CHART_LIBRARY } from '../../data/ranges';
import { useChartStore } from '../../state/chartStore';
import { useHandLog } from '../../state/handLogStore';
import { useProfiles } from '../../state/profilesStore';
import { analyzeLoggedInWorker } from '../../workers/engineClient';
import { usePostflopSolver } from '../../state/postflopSolverStore';

export function chartIdFor(h: LoggedHand): string {
  return h.stackBb <= 60 ? 'home-40bb' : 'cash-9max-100bb';
}

/** Models, preflop stats and names for each tagged opponent. */
export function playerOptions(h: LoggedHand, profiles: Profile[]): AnalyzeLoggedOptions {
  const models: Record<string, VillainModel> = {};
  const stats: Record<string, PlayerStats> = {};
  const names: Record<string, string> = {};
  for (const p of opponentsOf(h)) {
    const prof = profiles.find((x) => x.id === p.profileId);
    if (prof) {
      models[p.id] = profileModel(prof);
      stats[p.id] = prof.stats;
      names[p.id] = prof.name;
    } else if (p.name) names[p.id] = p.name;
  }
  names[heroOf(h).id] = 'You';
  return { models, stats, names };
}

/** Display name for a player of a logged hand. */
export function playerName(h: LoggedHand, id: string, profiles: Profile[]): string {
  const p = h.players.find((x) => x.id === id);
  if (!p) return id;
  if (p.hero) return 'You';
  return profiles.find((x) => x.id === p.profileId)?.name ?? p.name ?? p.seat;
}

/** Analyse a logged hand in the worker and cache its graded decisions for the leak finder. */
export function useLoggedAnalysis(raw: LoggedHand | undefined) {
  const overrides = useChartStore((s) => s.overrides);
  const profiles = useProfiles((s) => s.profiles);
  const solverImports = usePostflopSolver((s) => s.imports);
  const setAnalysis = useHandLog((s) => s.setAnalysis);
  const [state, setState] = useState<{ loading: boolean; result: LoggedHandAnalysis | null; error: string | null }>({ loading: true, result: null, error: null });
  useEffect(() => {
    if (!raw) return;
    const hand = migrateLoggedHand(raw);
    let live = true;
    setState({ loading: true, result: null, error: null });
    analyzeLoggedInWorker(hand, CHART_LIBRARY, overrides, chartIdFor(hand), REGULAR_MODEL, { ...playerOptions(hand, profiles), solver: solverImports.flatMap((i) => i.entries) })
      .then((result) => {
        if (!live) return;
        setState({ loading: false, result, error: result.error });
        setAnalysis(hand.id, result.decisions.map((d) => d.review));
      })
      .catch((e: Error) => live && setState({ loading: false, result: null, error: e.message }));
    return () => {
      live = false;
    };
  }, [raw?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

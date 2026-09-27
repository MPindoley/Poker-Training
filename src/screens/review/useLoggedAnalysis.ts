import { useEffect, useState } from 'react';
import { REGULAR_MODEL, type LoggedHand, type LoggedHandAnalysis, type VillainModel } from '../../engine';
import { CHART_LIBRARY } from '../../data/ranges';
import { useChartStore } from '../../state/chartStore';
import { useHandLog } from '../../state/handLogStore';
import { useProfileModels } from '../../state/profileModels';
import { analyzeLoggedInWorker } from '../../workers/engineClient';

export function chartIdFor(h: LoggedHand): string {
  return h.stackBb <= 60 ? 'home-40bb' : 'cash-9max-100bb';
}

export function modelFor(h: LoggedHand, models: VillainModel[]): VillainModel {
  return models.find((m) => m.id === h.villainProfileId) ?? REGULAR_MODEL;
}

/** Analyse a logged hand in the worker and cache its graded decisions for the leak finder. */
export function useLoggedAnalysis(hand: LoggedHand | undefined) {
  const overrides = useChartStore((s) => s.overrides);
  const models = useProfileModels();
  const setAnalysis = useHandLog((s) => s.setAnalysis);
  const [state, setState] = useState<{ loading: boolean; result: LoggedHandAnalysis | null; error: string | null }>({ loading: true, result: null, error: null });
  useEffect(() => {
    if (!hand) return;
    let live = true;
    setState({ loading: true, result: null, error: null });
    analyzeLoggedInWorker(hand, CHART_LIBRARY, overrides, chartIdFor(hand), modelFor(hand, models))
      .then((result) => {
        if (!live) return;
        setState({ loading: false, result, error: result.error });
        setAnalysis(hand.id, result.decisions.map((d) => d.review));
      })
      .catch((e: Error) => live && setState({ loading: false, result: null, error: e.message }));
    return () => {
      live = false;
    };
  }, [hand?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

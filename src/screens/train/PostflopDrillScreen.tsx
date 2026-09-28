import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { REGULAR_MODEL, THEMES, makePostflopDrills, type Theme } from '../../engine';
import { useCharts } from '../../state/chartStore';
import { useSettings } from '../../state/settingsStore';
import { usePostflopSolverDb } from '../../state/postflopSolverStore';
import { DrillRunner } from '../../components/drill/DrillRunner';

export function PostflopDrillScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const charts = useCharts();
  const filters = useSettings((s) => s.postflopFilters);
  const solver = usePostflopSolverDb();
  const theme = (THEMES.includes(params.get('theme') as Theme) ? params.get('theme') : 'cbet') as Theme;
  const drills = useMemo(
    () => makePostflopDrills({ chart: charts['cash-6max-100bb']!, shortChart: charts['home-40bb']!, model: REGULAR_MODEL, filters, solver }),
    [charts, filters, solver],
  );
  const drill = drills.find((d) => d.kind === `postflop.${theme}`)!;
  return <DrillRunner key={theme} title={drill.title} spec={{ drills: [drill], difficulty: 'silver' }} onExit={() => navigate('/train/postflop')} length={8} />;
}

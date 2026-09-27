import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMemo } from 'react';
import { DIFFICULTIES, MATH_DRILLS, MATH_DRILL_BY_KIND, makeEquityDrills, type Difficulty } from '../../engine';
import { useCharts } from '../../state/chartStore';
import { DrillRunner } from '../../components/drill/DrillRunner';

export function MathDrillScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const kind = params.get('kind') ?? 'mixed';
  const d = params.get('d');
  const difficulty: Difficulty = DIFFICULTIES.includes(d as Difficulty) ? (d as Difficulty) : 'bronze';
  const charts = useCharts();
  // Equity Eye needs a real opening range, so it is built from the home-game chart.
  const equity = useMemo(() => makeEquityDrills(charts['home-40bb']!)[0]!, [charts]);
  const drill = kind === equity.kind ? equity : MATH_DRILL_BY_KIND.get(kind);
  const drills = drill ? [drill] : MATH_DRILLS;
  return (
    <DrillRunner
      key={`${kind}-${difficulty}`}
      title={drill?.title ?? 'Math Mix'}
      spec={{ drills, difficulty }}
      onExit={() => navigate('/train/math')}
    />
  );
}

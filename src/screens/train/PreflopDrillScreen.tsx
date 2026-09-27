import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DIFFICULTIES, makePreflopDrills, type Difficulty } from '../../engine';
import { useActiveChart } from '../../state/chartStore';
import { useDrillStats } from '../../state/drillStatsStore';
import { DrillRunner } from '../../components/drill/DrillRunner';

export function PreflopDrillScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const chart = useActiveChart();
  const kind = params.get('kind') ?? 'preflop.flash';
  const d = params.get('d');
  const difficulty: Difficulty = DIFFICULTIES.includes(d as Difficulty) ? (d as Difficulty) : 'bronze';
  // Snapshot skills once so weak spots shape this round without reshuffling mid-round.
  const skills = useMemo(() => useDrillStats.getState().skills, []);
  const drills = useMemo(() => makePreflopDrills({ chart, skills }), [chart, skills]);
  const selected = kind === 'mixed' || difficulty === 'diamond' ? drills : drills.filter((x) => x.kind === kind);
  const title = selected.length === 1 ? selected[0]!.title : 'Preflop Mix';
  return (
    <DrillRunner key={`${kind}-${difficulty}-${chart.id}`} title={title} spec={{ drills: selected, difficulty }} onExit={() => navigate('/train/preflop')} />
  );
}

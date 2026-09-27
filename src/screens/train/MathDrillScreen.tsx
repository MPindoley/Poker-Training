import { useNavigate, useSearchParams } from 'react-router-dom';
import { DIFFICULTIES, MATH_DRILLS, MATH_DRILL_BY_KIND, type Difficulty } from '../../engine';
import { DrillRunner } from '../../components/drill/DrillRunner';

export function MathDrillScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const kind = params.get('kind') ?? 'mixed';
  const d = params.get('d');
  const difficulty: Difficulty = DIFFICULTIES.includes(d as Difficulty) ? (d as Difficulty) : 'bronze';
  const drill = MATH_DRILL_BY_KIND.get(kind);
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

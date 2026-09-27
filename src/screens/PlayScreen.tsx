import { ScreenHeader } from '../components/ScreenHeader';
import { ComingSoon } from '../components/ComingSoon';

export function PlayScreen() {
  return (
    <div className="space-y-4">
      <ScreenHeader title="Play" subtitle="Sit down against bots with a coach" />
      <ComingSoon
        items={[
          'Simulated table vs bots at 40bb (home game) or 100bb (casino)',
          'Coach grades each decision: Best / Acceptable / Mistake',
          'Live pot odds and equity readouts from the engine',
        ]}
      />
    </div>
  );
}

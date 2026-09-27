import { ScreenHeader } from '../components/ScreenHeader';
import { ComingSoon } from '../components/ComingSoon';

export function ReviewScreen() {
  return (
    <div className="space-y-4">
      <ScreenHeader title="Review" subtitle="Log real hands, find your leaks" />
      <ComingSoon
        items={['Quick hand logger for live sessions', 'Session results and bankroll graph', 'Leak finder across your drills and hands']}
      />
    </div>
  );
}

import { ScreenHeader } from '../components/ScreenHeader';
import { ComingSoon } from '../components/ComingSoon';

export function LearnScreen() {
  return (
    <div className="space-y-4">
      <ScreenHeader title="Learn" subtitle="Lessons and glossary" />
      <ComingSoon
        items={['Bite-sized lessons with worked math', 'Searchable glossary of poker terms', 'Cheat sheets for pot odds and outs']}
      />
    </div>
  );
}

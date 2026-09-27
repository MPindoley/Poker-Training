import { useNavigate } from 'react-router-dom';
import { levelFromXp } from '../engine';
import { useProgress } from '../state/progressStore';
import { toast } from '../state/toastStore';
import { ScreenHeader } from '../components/ScreenHeader';
import { GameButton, Panel, ProgressBar, XPBadge } from '../components/ui';

export function HomeScreen() {
  const navigate = useNavigate();
  const xp = useProgress((s) => s.xp);
  const streak = useProgress((s) => s.streak);
  const lvl = levelFromXp(xp);

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Felt Academy"
        subtitle="Master the math. Read the people."
        right={<XPBadge level={lvl.level} progress={lvl.progress} />}
      />

      <Panel tone="night">
        <div className="flex items-center justify-between font-display">
          <span className="text-lg">Level {lvl.level}</span>
          <span className="flex items-center gap-1.5 text-lg text-gold-300">
            <FlameIcon /> {streak} day streak
          </span>
        </div>
        <ProgressBar
          className="mt-2"
          value={lvl.progress}
          color="gold"
          label={`${lvl.xpIntoLevel} / ${lvl.xpForNextLevel} XP`}
        />
      </Panel>

      <Panel tone="wood" title="Daily Drills">
        <p className="text-center font-semibold text-cream/90">
          Your daily drills will appear here once the trainers are built.
        </p>
      </Panel>

      <Panel tone="felt" title="Quick Start">
        <div className="grid grid-cols-2 gap-3">
          <GameButton color="gold" onClick={() => navigate('/train')}>Train</GameButton>
          <GameButton color="blue" onClick={() => navigate('/play')}>Play</GameButton>
          <GameButton color="red" onClick={() => toast({ tone: 'info', title: 'Coming soon', message: 'Pot odds drill is next.' })}>
            Odds Drill
          </GameButton>
          <GameButton color="purple" onClick={() => navigate('/review')}>Log Hand</GameButton>
        </div>
      </Panel>

      <GameButton color="cream" size="sm" fullWidth onClick={() => navigate('/styleguide')}>
        Open Styleguide
      </GameButton>
    </div>
  );
}

function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden>
      <path
        d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z"
        fill="#ff8a3d"
        stroke="#1b1230"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 12c1.5 1.5 3 3 3 5a3 3 0 0 1-6 0c0-1.5 1.5-3 3-5z" fill="#ffe27a" />
    </svg>
  );
}

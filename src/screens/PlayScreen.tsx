import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCharts } from '../state/chartStore';
import { useProfiles } from '../state/profilesStore';
import { DEFAULT_CONFIG, useTable, type Speed, type TableConfig } from '../state/tableStore';
import { ScreenHeader } from '../components/ScreenHeader';
import { ChipGroup, GameButton, Panel } from '../components/ui';

const BLINDS = [
  { value: '0.5', label: '$0.25/$0.50' },
  { value: '1', label: '$0.50/$1' },
  { value: '2', label: '$1/$2' },
  { value: '0', label: 'Big blinds only' },
];

export function PlayScreen() {
  const navigate = useNavigate();
  const active = useTable((s) => s.active);
  const start = useTable((s) => s.startSession);
  const profiles = useProfiles((s) => s.profiles);
  const charts = useCharts();
  const [cfg, setCfg] = useState<TableConfig>(DEFAULT_CONFIG);
  const set = (patch: Partial<TableConfig>) => setCfg((c) => ({ ...c, ...patch }));

  const go = () => {
    const chart = cfg.stackBb === 40 ? charts['home-40bb']! : cfg.players === 6 ? charts['cash-6max-100bb']! : charts['cash-9max-100bb']!;
    start(cfg, profiles, chart);
    navigate('/play/table');
  };

  return (
    <div className="space-y-4">
      <ScreenHeader title="Play" subtitle="Sit down against bots with a coach" />
      {active && (
        <GameButton color="green" size="lg" fullWidth onClick={() => navigate('/play/table')}>
          Resume table
        </GameButton>
      )}
      <Panel tone="night" title="Game settings">
        <div className="space-y-3">
          <ChipGroup
            label="Stack depth"
            options={[
              { value: '40', label: '40bb home game' },
              { value: '100', label: '100bb casino' },
            ]}
            value={[String(cfg.stackBb)]}
            onChange={(v) => set({ stackBb: Number(v[0]) as 40 | 100 })}
          />
          <ChipGroup label="Blinds" options={BLINDS} value={[String(cfg.bigBlindDollars)]} onChange={(v) => set({ bigBlindDollars: Number(v[0]) })} />
          <ChipGroup
            label="Players"
            options={[
              { value: '6', label: '6 seats' },
              { value: '9', label: '9 seats' },
            ]}
            value={[String(cfg.players)]}
            onChange={(v) => set({ players: Number(v[0]) as 6 | 9 })}
          />
          <ChipGroup
            label="Speed"
            options={(['slow', 'normal', 'fast'] as Speed[]).map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }))}
            value={[cfg.speed]}
            onChange={(v) => set({ speed: v[0] as Speed })}
          />
          <ChipGroup
            label="Options"
            multi
            options={[
              { value: 'coach', label: 'Coach mode' },
              { value: 'badges', label: 'Show player types' },
              { value: 'home', label: `Home Game preset (${profiles.length} players)` },
              { value: 'straddle', label: 'UTG straddle (2bb)' },
              { value: 'meter', label: 'Table image meter' },
              { value: 'hard', label: 'Hard mode' },
            ]}
            value={[
              ...(cfg.coach ? ['coach'] : []),
              ...(cfg.showBadges ? ['badges'] : []),
              ...(cfg.homeGame ? ['home'] : []),
              ...(cfg.straddle ? ['straddle'] : []),
              ...(cfg.imageMeter !== false ? ['meter'] : []),
              ...(cfg.hardMode ? ['hard'] : []),
            ]}
            onChange={(v) =>
              set({
                coach: v.includes('coach'),
                showBadges: v.includes('badges'),
                homeGame: v.includes('home'),
                straddle: v.includes('straddle'),
                imageMeter: v.includes('meter'),
                hardMode: v.includes('hard'),
              })
            }
          />
          <p className="text-xs font-semibold text-cream/70">
            Coach off: no hints while you play, graded afterwards only. Player types hidden: figure them out yourself. Home Game fills the table with your
            profiles from the Exploit Lab. Straddle: UTG posts 2bb and acts last preflop; the coach reads every seat one position tighter. Table image: bots remember what you show them and adjust; the meter shows how
            they see you (Home Game starts you as Tight and Feared). Hard mode: no coach and no meter.
          </p>
        </div>
      </Panel>
      <GameButton color="gold" size="lg" fullWidth onClick={go}>
        {active ? 'Start new session' : 'Deal me in'}
      </GameButton>
    </div>
  );
}

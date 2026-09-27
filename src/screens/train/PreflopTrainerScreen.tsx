import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  DIFFICULTIES,
  DIFFICULTY_INFO,
  HAND_GROUPS,
  HAND_GROUP_NAMES,
  accuracy,
  formatPercent,
  type Difficulty,
} from '../../engine';
import { useActiveChart, useChartStore, useCharts } from '../../state/chartStore';
import { useDrillStats } from '../../state/drillStatsStore';
import { useSettings } from '../../state/settingsStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GameButton, Panel, ProgressBar } from '../../components/ui';
import { MedalIcon } from '../../components/icons/MedalIcon';

const DRILLS = [
  { kind: 'preflop.flash', title: 'Flash Cards', blurb: 'Seat + hand: raise, call or fold, fast', glyph: 'FC' },
  { kind: 'paint', title: 'Paint the Range', blurb: 'Draw a seat’s range from memory', glyph: '▦' },
  { kind: 'preflop.ladder', title: 'Seat Ladder', blurb: 'Where a hand turns into an open', glyph: 'UP' },
  { kind: 'preflop.sizing', title: 'Sizing', blurb: '2.5x, 3x, 4x, +1 per limper', glyph: 'bb' },
  { kind: 'preflop.defense', title: 'Blind Defense', blurb: 'Big blind vs every seat, with pot odds', glyph: 'BB' },
];

export function PreflopTrainerScreen() {
  const navigate = useNavigate();
  const charts = useCharts();
  const chart = useActiveChart();
  const setChart = useChartStore((s) => s.setChart);
  const skills = useDrillStats((s) => s.skills);
  const difficulty = useSettings((s) => s.preflopDifficulty);
  const setDifficulty = useSettings((s) => s.setPreflopDifficulty);

  const seatStats = chart.seats
    .map((s) => ({ name: s, acc: accuracy(skills[`preflop.seat:${s}`]), n: skills[`preflop.seat:${s}`]?.attempts ?? 0 }))
    .filter((s) => s.n > 0);
  const groupStats = HAND_GROUPS.map((g) => ({ name: HAND_GROUP_NAMES[g], acc: accuracy(skills[`preflop.group:${g}`]), n: skills[`preflop.group:${g}`]?.attempts ?? 0 })).filter(
    (g) => g.n > 0,
  );

  const go = (kind: string) =>
    kind === 'paint' ? navigate('/train/preflop/paint') : navigate(`/train/preflop/play?kind=${kind}&d=${difficulty}`);

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Preflop"
        subtitle="Ranges by seat, sizing and defense"
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate('/train')}>
            Back
          </GameButton>
        }
      />

      <Panel tone="cream" title="Chart">
        <div className="grid gap-2">
          {Object.values(charts).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setChart(c.id)}
              className={`min-h-11 rounded-xl border-[3px] border-ink px-3 py-2 text-left font-display text-base ${
                chart.id === c.id ? 'bg-gradient-to-b from-gold-300 to-gold-500' : 'bg-white/70'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs font-bold text-ink/75">
          Heads up: these charts are close approximations of widely published solver-informed charts, not solver output. Edit any range in the Range
          Editor.
        </p>
      </Panel>

      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Difficulty">
        {DIFFICULTIES.map((d: Difficulty) => (
          <motion.button
            key={d}
            type="button"
            role="radio"
            aria-checked={difficulty === d}
            whileTap={{ scale: 0.9 }}
            onClick={() => setDifficulty(d)}
            className={`flex min-h-14 flex-col items-center justify-center rounded-2xl border-[3px] border-ink shadow-chunky-sm ${
              difficulty === d ? 'bg-gradient-to-b from-gold-300 to-gold-700 text-ink' : 'bg-ink/40 text-cream'
            }`}
          >
            <MedalIcon tier={d} className="h-6 w-6" />
            <span className="font-display text-xs">{DIFFICULTY_INFO[d].label}</span>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {DRILLS.map((d, i) => (
          <motion.button
            key={d.kind}
            type="button"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 24 }}
            whileTap={{ scaleX: 1.04, scaleY: 0.92 }}
            onClick={() => go(d.kind)}
            className="gloss flex min-h-28 flex-col justify-between rounded-3xl border-[3px] border-ink bg-gradient-to-b from-cream to-cream-dark p-3 text-left text-ink shadow-chunky"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl border-[3px] border-ink bg-gold-500 font-display text-lg">{d.glyph}</span>
            <span>
              <span className="block font-display text-lg leading-tight">{d.title}</span>
              <span className="block text-xs font-bold text-ink/70">{d.blurb}</span>
            </span>
          </motion.button>
        ))}
        <motion.button
          type="button"
          whileTap={{ scaleX: 1.04, scaleY: 0.92 }}
          onClick={() => navigate('/train/preflop/editor')}
          className="gloss flex min-h-28 flex-col justify-between rounded-3xl border-[3px] border-ink bg-gradient-to-b from-[#b88bff] to-grape-dark p-3 text-left text-white shadow-chunky"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl border-[3px] border-ink bg-ink/30 font-display text-lg">✎</span>
          <span>
            <span className="text-outline-sm block font-display text-lg leading-tight">Range Editor</span>
            <span className="block text-xs font-bold text-white/85">View and edit every chart</span>
          </span>
        </motion.button>
      </div>

      <Panel tone="night" title="Weak spots">
        {seatStats.length === 0 && groupStats.length === 0 ? (
          <p className="text-center text-sm font-semibold text-cream/80">Play a few drills and your accuracy by seat and hand group shows up here.</p>
        ) : (
          <div className="space-y-3">
            {[
              ['By seat', seatStats],
              ['By hand group', groupStats],
            ].map(([title, rows]) => (
              <div key={title as string}>
                <div className="mb-1 font-display text-sm text-gold-300">{title as string}</div>
                <div className="space-y-1.5">
                  {(rows as { name: string; acc: number | null; n: number }[])
                    .sort((a, b) => (a.acc ?? 0) - (b.acc ?? 0))
                    .map((r) => (
                      <div key={r.name} className="flex items-center gap-2">
                        <span className="w-32 shrink-0 truncate text-xs font-bold">{r.name}</span>
                        <ProgressBar className="flex-1" size="sm" value={r.acc ?? 0} color={(r.acc ?? 0) < 0.6 ? 'red' : (r.acc ?? 0) < 0.8 ? 'gold' : 'green'} />
                        <span className="w-16 text-right font-display text-xs">
                          {formatPercent(r.acc ?? 0, 0)} <span className="text-cream/60">({r.n})</span>
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
            <p className="text-xs font-semibold text-cream/70">Weak seats and hand groups come up more often in your drills.</p>
          </div>
        )}
      </Panel>
    </div>
  );
}

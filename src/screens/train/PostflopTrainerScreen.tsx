import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { POT_TYPES, POT_TYPE_NAMES, STREETS, THEMES, THEME_NAMES, accuracy, formatPercent, type PotType, type Street, type Theme } from '../../engine';
import { useDrillStats } from '../../state/drillStatsStore';
import { useSettings } from '../../state/settingsStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ChipGroup, GameButton, Panel } from '../../components/ui';

const THEME_INFO: Record<Theme, { blurb: string; glyph: string; color: string }> = {
  cbet: { blurb: 'Bet or check, and what size', glyph: 'CB', color: 'from-gold-300 to-gold-700' },
  value: { blurb: 'Thin value and max-value sizing', glyph: '$', color: 'from-felt-300 to-emerald-dark' },
  bluff: { blurb: 'Draws, blockers, bluff boards', glyph: '!', color: 'from-[#ff7a6e] to-ruby-dark' },
  facing: { blurb: 'Call, raise or fold vs bets', glyph: 'VS', color: 'from-[#6fb2ff] to-sapphire-dark' },
  reading: { blurb: 'Narrow ranges street by street', glyph: '?', color: 'from-[#b88bff] to-grape-dark' },
  short: { blurb: '~40bb: when to get it in', glyph: '40', color: 'from-wood-300 to-wood-700' },
  checkraise: { blurb: 'Make them, and face them', glyph: 'XR', color: 'from-[#ff9f5a] to-[#b3470f]' },
  turn: { blurb: 'Which turn cards to keep firing on', glyph: 'T', color: 'from-[#5fd6c9] to-[#0f6f66]' },
  river: { blurb: 'Bluff-catching, thin value, overbets', glyph: 'R', color: 'from-[#8fa0ff] to-[#2f3fa8]' },
  multiway: { blurb: '3 and 4 players: tighter bets and calls', glyph: '3+', color: 'from-[#f78fd1] to-[#9c1f6d]' },
};

export function PostflopTrainerScreen() {
  const navigate = useNavigate();
  const filters = useSettings((s) => s.postflopFilters);
  const setFilters = useSettings((s) => s.setPostflopFilters);
  const kinds = useDrillStats((s) => s.kinds);

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Postflop"
        subtitle="Realistic spots, graded by documented rules"
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate('/train')}>
            Back
          </GameButton>
        }
      />
      <Panel tone="night" title="Filters">
        <div className="space-y-3">
          <ChipGroup<Street>
            label="Street (none = all)"
            multi
            options={STREETS.map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }))}
            value={filters.streets ?? []}
            onChange={(streets) => setFilters({ ...filters, streets })}
          />
          <ChipGroup<PotType>
            label="Pot type (none = all)"
            multi
            options={POT_TYPES.map((p) => ({ value: p, label: POT_TYPE_NAMES[p] }))}
            value={filters.potTypes ?? []}
            onChange={(potTypes) => setFilters({ ...filters, potTypes })}
          />
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-3">
        {THEMES.map((t, i) => {
          const acc = accuracy(kinds[`postflop.${t}`]);
          return (
            <motion.button
              key={t}
              type="button"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.04, type: 'spring', stiffness: 400, damping: 24 }}
              whileTap={{ scaleX: 1.04, scaleY: 0.92 }}
              onClick={() => navigate(`/train/postflop/play?theme=${t}`)}
              className={`gloss flex min-h-32 flex-col justify-between rounded-3xl border-[3px] border-ink bg-gradient-to-b ${THEME_INFO[t].color} p-3 text-left text-white shadow-chunky`}
            >
              <span className="text-outline-sm grid h-10 w-10 place-items-center rounded-xl border-[3px] border-ink bg-ink/25 font-display text-lg">
                {THEME_INFO[t].glyph}
              </span>
              <span>
                <span className="text-outline-sm block font-display text-lg leading-tight">{THEME_NAMES[t]}</span>
                <span className="block text-xs font-bold text-white/90">{THEME_INFO[t].blurb}</span>
                <span className="block text-[11px] font-bold text-white/80">{acc === null ? 'Not played yet' : `${formatPercent(acc, 0)} accuracy`}</span>
              </span>
            </motion.button>
          );
        })}
      </div>

      <Panel tone="wood">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-xl">Replay my spot</div>
            <div className="text-sm font-semibold text-cream/85">Enter a hand from your game, get the same analysis</div>
          </div>
          <GameButton color="gold" size="sm" onClick={() => navigate('/train/postflop/replay')}>
            Open
          </GameButton>
        </div>
      </Panel>
      <p className="text-center text-xs font-semibold text-cream/70">
        Grades come from readable rules in src/engine/strategy/rules.ts and the villain model in villainModel.ts (which folds, calls and
        raises). EVs are simplified one-street estimates.
      </p>
    </div>
  );
}

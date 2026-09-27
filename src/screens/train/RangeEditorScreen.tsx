import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ACTION_COLORS,
  ACTION_NAMES,
  countCombos,
  formatPercent,
  gridToRange,
  overlappingCombos,
  parseRange,
  rangeFraction,
  rangeToClassWeights,
  rangeToString,
  HAND_GRID,
  type ActionRanges,
  type PreflopAction,
} from '../../engine';
import { useChartStore, useCharts } from '../../state/chartStore';
import { toast } from '../../state/toastStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GameButton, Panel, WeightGrid } from '../../components/ui';

type Section = 'rfi' | 'vsOpen' | 'vs3bet';
const BRUSHES = [1, 0.75, 0.5, 0.25, 0];

function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) {
  return (
    <label className="block">
      <span className="font-display text-xs text-ink/70">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 min-h-11 w-full rounded-xl border-[3px] border-ink bg-white px-2 font-display text-base text-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function RangeEditorScreen() {
  const navigate = useNavigate();
  const charts = useCharts();
  const activeId = useChartStore((s) => s.chartId);
  const overrides = useChartStore((s) => s.overrides);
  const setOverride = useChartStore((s) => s.setOverride);
  const clearOverride = useChartStore((s) => s.clearOverride);
  const resetChart = useChartStore((s) => s.resetChart);

  const [chartId, setChartId] = useState(activeId);
  const chart = charts[chartId]!;
  const [section, setSection] = useState<Section>('rfi');
  const spotOptions = useMemo(() => {
    if (section === 'rfi') return chart.openingSeats.map((s) => ({ value: s, label: `${s} open` }));
    if (section === 'vsOpen') return chart.facingOpenPairs().map((p) => ({ value: `${p.seat}|${p.opener}`, label: `${p.seat} vs ${p.opener} open` }));
    return chart.facing3betSeats().map((s) => ({ value: s, label: `${s} open, facing 3-bet` }));
  }, [chart, section]);
  const [spotKey, setSpotKey] = useState(spotOptions[0]?.value ?? '');
  useEffect(() => setSpotKey(spotOptions[0]?.value ?? ''), [spotOptions]);

  const spot: ActionRanges | null = useMemo(() => {
    if (!spotKey) return null;
    if (section === 'rfi') return chart.rfi(spotKey);
    if (section === 'vsOpen') {
      const [seat, opener] = spotKey.split('|');
      return chart.vsOpen(seat!, opener!);
    }
    return chart.vs3bet(spotKey);
  }, [chart, section, spotKey]);

  const actions = spot ? (Object.keys(spot.ranges) as PreflopAction[]) : [];
  const [action, setAction] = useState<PreflopAction>('raise');
  useEffect(() => {
    if (actions.length && !actions.includes(action)) setAction(actions[0]!);
  }, [actions, action]);

  const notation = spot?.notation[action] ?? '';
  const [text, setText] = useState(notation);
  const [textError, setTextError] = useState<string | null>(null);
  useEffect(() => {
    setText(notation);
    setTextError(null);
  }, [notation]);
  const [brush, setBrush] = useState(1);

  if (!spot) return null;
  const range = spot.ranges[action]!;
  const weights = rangeToClassWeights(range);
  const key = `${spot.path}.${action}`;
  const edited = overrides[chartId]?.[key] !== undefined;
  const overlaps = overlappingCombos(spot).length;

  const save = (next: string) => {
    try {
      parseRange(next);
      setOverride(chartId, key, next);
      setTextError(null);
    } catch (e) {
      setTextError((e as Error).message);
    }
  };
  const paint = (next: Map<string, number>) => {
    const grid = HAND_GRID.map((row) => row.map((h) => next.get(h.label) ?? 0));
    save(rangeToString(gridToRange(grid)));
  };

  return (
    <div className="space-y-3">
      <ScreenHeader
        title="Range Editor"
        subtitle="Your edits are saved on this device"
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate('/train/preflop')}>
            Back
          </GameButton>
        }
      />
      <Panel tone="cream">
        <div className="grid gap-2">
          <Select label="Chart" value={chartId} onChange={setChartId} options={Object.values(charts).map((c) => ({ value: c.id, label: c.name }))} />
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="Situation"
              value={section}
              onChange={(v) => setSection(v as Section)}
              options={[
                { value: 'rfi', label: 'Open (RFI)' },
                { value: 'vsOpen', label: 'Facing an open' },
                { value: 'vs3bet', label: 'Facing a 3-bet' },
              ]}
            />
            <Select label="Spot" value={spotKey} onChange={setSpotKey} options={spotOptions} />
          </div>
        </div>
        <p className="mt-2 text-xs font-bold text-ink/70">{chart.json.description}</p>
      </Panel>

      <div className="flex gap-2">
        {actions.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAction(a)}
            className={`min-h-11 flex-1 rounded-xl border-[3px] border-ink font-display text-base ${a === action ? 'text-white' : 'bg-ink/40 text-cream'}`}
            style={a === action ? { background: ACTION_COLORS[a] } : undefined}
          >
            {ACTION_NAMES[a]}
          </button>
        ))}
      </div>

      <WeightGrid weights={weights} brush={brush} onChange={paint} color={ACTION_COLORS[action]} />

      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-sm">Brush</span>
        <div className="flex gap-1.5">
          {BRUSHES.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrush(b)}
              className={`min-h-11 min-w-12 rounded-xl border-2 border-ink font-display text-sm ${brush === b ? 'bg-gold-500 text-ink' : 'bg-ink/40 text-cream'}`}
            >
              {b === 0 ? 'Erase' : `${b * 100}%`}
            </button>
          ))}
        </div>
      </div>

      <Panel tone="night">
        <div className="flex justify-between font-display text-sm">
          <span>{formatPercent(rangeFraction(range))} of hands</span>
          <span>{Math.round(countCombos(range) * 10) / 10} combos</span>
          <span className={edited ? 'text-gold-300' : 'text-cream/60'}>{edited ? 'Edited' : 'Built-in'}</span>
        </div>
        {overlaps > 0 && (
          <p className="mt-1 text-xs font-bold text-[#ff9c94]">{overlaps} combos have action frequencies adding up to more than 100% — lower one of the actions.</p>
        )}
        <label className="mt-2 block">
          <span className="font-display text-xs text-cream/70">Notation</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => text !== notation && save(text)}
            rows={3}
            spellCheck={false}
            className="mt-0.5 w-full select-text rounded-xl border-2 border-ink bg-white p-2 font-mono text-sm text-ink"
          />
        </label>
        {textError && <p className="text-xs font-bold text-[#ff9c94]">{textError}</p>}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <GameButton
            size="sm"
            color="cream"
            disabled={!edited}
            onClick={() => {
              clearOverride(chartId, key);
              toast({ tone: 'info', title: 'Range restored' });
            }}
          >
            Reset range
          </GameButton>
          <GameButton
            size="sm"
            color="red"
            disabled={!overrides[chartId] || Object.keys(overrides[chartId]!).length === 0}
            onClick={() => {
              if (confirm(`Reset every edit in "${chart.name}"?`)) resetChart(chartId);
            }}
          >
            Reset chart
          </GameButton>
        </div>
      </Panel>
    </div>
  );
}

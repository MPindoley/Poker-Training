import { useMemo, useState } from 'react';
import {
  chartRangeOptions,
  countCombos,
  formatPercent,
  parseRange,
  rangeFromLabels,
  rangeToClassWeights,
  rangeToString,
  statsPreflopRanges,
  type LabPlayer,
  type Range,
} from '../../engine';
import { useCharts } from '../../state/chartStore';
import { useProfiles } from '../../state/profilesStore';
import { CardPicker, CardView, GameButton, RangeGrid } from '../ui';

const PLAYER_TONES = ['bg-gold-500', 'bg-sapphire', 'bg-ruby', 'bg-[#9b59d0]', 'bg-felt-300', 'bg-cream'] as const;
export const playerTone = (i: number) => PLAYER_TONES[i % PLAYER_TONES.length]!;
export const playerName = (i: number) => (i === 0 ? 'You' : `Player ${i + 1}`);

function rangeInfo(text: string): { combos: number; error: string | null } {
  try {
    const r = parseRange(text);
    return { combos: countCombos(r), error: null };
  } catch (e) {
    return { combos: 0, error: (e as Error).message };
  }
}

const union = (a: Range, b: Range): Range => ({ weights: a.weights.map((w, i) => Math.min(1, w + b.weights[i]!)) });

/** One player's seat: a specific hand (card picker) or a range (notation / paint / chart / profile). */
export function PlayerEditor({
  index,
  player,
  used,
  onChange,
  onRemove,
}: {
  index: number;
  player: LabPlayer;
  /** Cards used elsewhere (board, dead, other hands). */
  used: string[];
  onChange: (p: LabPlayer) => void;
  onRemove?: () => void;
}) {
  const charts = useCharts();
  const profiles = useProfiles((s) => s.profiles);
  const [picking, setPicking] = useState(false);
  const [painting, setPainting] = useState<Set<string> | null>(null);
  const [chartId, setChartId] = useState('home-40bb');
  const options = useMemo(() => (charts[chartId] ? chartRangeOptions(charts[chartId]!) : []), [charts, chartId]);
  const handCards = player.kind === 'hand' ? (player.text.match(/[2-9TJQKA][shdc]/gi) ?? []) : [];
  const info = player.kind === 'range' ? rangeInfo(player.text) : null;
  const setRange = (r: Range, source?: string) => onChange({ kind: 'range', text: rangeToString(r), source });

  return (
    <div className="rounded-2xl border-[3px] border-ink bg-white/80 p-2 text-ink shadow-chunky-sm">
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-full border-2 border-ink font-display text-sm ${playerTone(index)}`}>{index + 1}</span>
        <span className="font-display">{playerName(index)}</span>
        <div className="ml-auto flex gap-1" role="radiogroup" aria-label={`${playerName(index)}: hand or range`}>
          {(['hand', 'range'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={player.kind === k}
              onClick={() => player.kind !== k && onChange(k === 'hand' ? { kind: 'hand', text: '' } : { kind: 'range', text: 'random' })}
              className={`min-h-11 rounded-xl border-2 border-ink px-2.5 font-display text-sm ${player.kind === k ? 'bg-gold-500' : 'bg-ink/10'}`}
            >
              {k === 'hand' ? 'Hand' : 'Range'}
            </button>
          ))}
          {onRemove && (
            <button type="button" aria-label={`Remove ${playerName(index)}`} onClick={onRemove} className="min-h-11 min-w-11 rounded-xl border-2 border-ink bg-ruby font-display text-white">
              ✕
            </button>
          )}
        </div>
      </div>

      {player.kind === 'hand' ? (
        <div className="mt-2">
          <button type="button" onClick={() => setPicking(!picking)} className="flex min-h-11 items-center gap-1" aria-label="Pick the two cards">
            {[0, 1].map((i) =>
              handCards[i] ? (
                <CardView key={i} card={handCards[i]!} size="sm" />
              ) : (
                <span key={i} className="grid h-14 w-10 place-items-center rounded-lg border-2 border-dashed border-ink/50 font-display text-ink/50">
                  ?
                </span>
              ),
            )}
            <span className="ml-2 text-sm font-bold underline">{picking ? 'Done' : 'Pick cards'}</span>
          </button>
          {picking && (
            <CardPicker
              className="mt-2"
              value={handCards}
              max={2}
              disabled={used}
              onChange={(v) => {
                onChange({ kind: 'hand', text: v.join('') });
                if (v.length === 2) setPicking(false);
              }}
            />
          )}
        </div>
      ) : (
        <div className="mt-2 space-y-1.5">
          <input
            value={player.text}
            onChange={(e) => onChange({ kind: 'range', text: e.target.value })}
            aria-label={`${playerName(index)} range`}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-11 w-full rounded-xl border-[3px] border-ink bg-white px-2 font-mono text-sm outline-none select-text focus:ring-4 focus:ring-gold-300"
          />
          <div className="text-xs font-bold text-ink/70">
            {info?.error ? <span className="text-ruby">{info.error}</span> : `${info!.combos} combos · ${formatPercent(info!.combos / 1326, 1)} of hands`}
            {player.source && ` · ${player.source}`}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <GameButton
              size="sm"
              color="blue"
              onClick={() => {
                let labels = new Set<string>();
                try {
                  labels = new Set([...rangeToClassWeights(parseRange(player.text))].filter(([, w]) => w > 0).map(([l]) => l));
                } catch {
                  /* start empty */
                }
                setPainting(labels);
              }}
            >
              Paint
            </GameButton>
            <select
              aria-label="Chart"
              value={chartId}
              onChange={(e) => setChartId(e.target.value)}
              className="min-h-11 rounded-xl border-2 border-ink bg-cream px-1 text-sm font-bold"
            >
              {Object.values(charts).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name.split(',')[0]}
                </option>
              ))}
            </select>
            <select
              aria-label="Chart spot"
              value=""
              onChange={(e) => {
                const o = options.find((x) => x.id === e.target.value);
                if (o) setRange(o.range, `${o.label} · ${chartId}`);
              }}
              className="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-ink bg-cream px-1 text-sm font-bold"
            >
              <option value="">From a chart spot…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            {profiles.length > 0 && (
              <select
                aria-label="Player profile"
                value=""
                onChange={(e) => {
                  const [id, part] = e.target.value.split('|');
                  const p = profiles.find((x) => x.id === id);
                  if (!p) return;
                  const r = statsPreflopRanges(p.stats);
                  setRange(part === 'raise' ? r.raise : part === 'call' ? r.call : union(r.raise, r.call), `${p.name} ${part === 'all' ? 'plays' : part === 'raise' ? 'raises' : 'calls'}`);
                }}
                className="min-h-11 w-full rounded-xl border-2 border-ink bg-cream px-1 text-sm font-bold"
              >
                <option value="">From a player profile…</option>
                {profiles.flatMap((p) => [
                  <option key={`${p.id}a`} value={`${p.id}|all`}>
                    {p.name}: every hand they play
                  </option>,
                  <option key={`${p.id}r`} value={`${p.id}|raise`}>
                    {p.name}: raising hands
                  </option>,
                  <option key={`${p.id}c`} value={`${p.id}|call`}>
                    {p.name}: calling hands
                  </option>,
                ])}
              </select>
            )}
          </div>
          {painting && (
            <div className="space-y-2 rounded-xl border-2 border-ink bg-ink p-2">
              <RangeGrid selected={painting} onChange={setPainting} />
              <div className="grid grid-cols-2 gap-2">
                <GameButton size="sm" color="cream" onClick={() => setPainting(null)}>
                  Cancel
                </GameButton>
                <GameButton
                  size="sm"
                  color="gold"
                  onClick={() => {
                    setRange(rangeFromLabels(painting), 'painted');
                    setPainting(null);
                  }}
                >
                  Use this range
                </GameButton>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

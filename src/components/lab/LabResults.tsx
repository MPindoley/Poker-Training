import { useState } from 'react';
import { BUCKETS, BUCKET_NAMES, RANKS, formatPercent, type Bucket, type LabResult, type LabScenario, type NextCardGrid } from '../../engine';
import { MiniCard, Panel, ProgressBar, RangeGrid } from '../ui';
import { playerName, playerTone } from './PlayerEditor';

const BAR_COLORS = ['gold', 'blue', 'red', 'purple', 'green', 'green'] as const;
export const BUCKET_COLOR: Record<Bucket, string> = {
  monster: '#f5b31b',
  strong: '#35c46a',
  medium: '#3d8bff',
  draw: '#b06ee8',
  weak: '#c9b99a',
  air: '#5a5570',
};
const pct = (x: number, d = 1) => formatPercent(x, d);

export function EquityPanel({ result, scenario }: { result: LabResult; scenario: LabScenario }) {
  const eq = result.equity;
  return (
    <Panel tone="night" title="Equity">
      <div className="space-y-2.5">
        {eq.players.map((p, i) => (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 font-display text-sm">
                <span className={`h-3 w-3 shrink-0 rounded-full border-2 border-ink ${playerTone(i)}`} />
                {playerName(i)}
                <span className="truncate font-body text-xs font-bold text-cream/70">{scenario.players[i]!.kind === 'hand' ? scenario.players[i]!.text : scenario.players[i]!.source ?? 'range'}</span>
              </span>
              <span className="font-display text-xl text-gold-300">{pct(p.equity)}</span>
            </div>
            <ProgressBar value={p.equity} size="sm" color={BAR_COLORS[i]} className="my-1" />
            <div className="flex flex-wrap gap-x-3 text-xs font-semibold text-cream/85">
              <span>Win {pct(p.win)}</span>
              <span>Tie {pct(p.tie)}</span>
              <span>{Number.isInteger(p.combos) ? p.combos : p.combos.toFixed(1)} combos</span>
            </div>
          </div>
        ))}
        <p className="text-xs font-semibold text-cream/70">
          {eq.method === 'exact' ? `Exact: every run-out counted (${eq.samples.toLocaleString()}).` : `Monte Carlo: ${eq.samples.toLocaleString()} run-outs, accurate to ±${pct(eq.maxMargin95)} (95%).`}
        </p>
      </div>
    </Panel>
  );
}

export function BucketsPanel({ result }: { result: LabResult }) {
  if (!result.buckets) return null;
  return (
    <Panel tone="cream" title="What each player holds here">
      <div className="space-y-2 text-ink">
        {result.buckets.map((b, i) => (
          <div key={i}>
            <div className="mb-0.5 flex justify-between text-xs font-bold">
              <span>{playerName(i)}</span>
              <span className="text-ink/60">{b.combos} combos</span>
            </div>
            <div className="flex h-5 overflow-hidden rounded-full border-2 border-ink bg-ink/10" role="img" aria-label={BUCKETS.map((k) => `${BUCKET_NAMES[k]} ${pct(b.shares[k], 0)}`).join(', ')}>
              {BUCKETS.filter((k) => b.shares[k] > 0).map((k) => (
                <div key={k} style={{ width: `${b.shares[k] * 100}%`, background: BUCKET_COLOR[k] }} className="border-r-2 border-white/70 last:border-r-0" />
              ))}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 pt-1 text-[11px] font-bold">
          {BUCKETS.map((k) => (
            <div key={k} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-ink" style={{ background: BUCKET_COLOR[k] }} />
              {BUCKET_NAMES[k]}
              <span className="ml-auto text-ink/60">{result.buckets!.map((b) => pct(b.shares[k], 0)).join(' / ')}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

export function ShowdownPanel({ result }: { result: LabResult }) {
  const [open, setOpen] = useState<string | null>(null);
  const s = result.showdown;
  if (!s) return null;
  return (
    <Panel tone="cream" title="Right now vs their range">
      <div className="space-y-2 text-ink">
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[
            ['You beat', s.beats, 'bg-felt-300'],
            ['Tie', s.ties, 'bg-cream'],
            ['Beats you', s.loses, 'bg-ruby text-white'],
          ].map(([k, v, c]) => (
            <div key={k as string} className={`rounded-xl border-2 border-ink py-1 ${c}`}>
              <div className="font-display text-lg">{pct(v as number, 0)}</div>
              <div className="text-[11px] font-bold">{k as string}</div>
            </div>
          ))}
        </div>
        <p className="text-xs font-semibold text-ink/70">Who is ahead with the cards out now (not equity: draws still count as behind).</p>
        {s.beatenBy.length > 0 && (
          <div>
            <div className="font-display text-sm">What beats you ({s.beatenBy.reduce((a, b) => a + b.combos, 0)} combos)</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {s.beatenBy.map((b) => {
                const key = `${b.label}|${b.hand}`;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setOpen(open === key ? null : key)}
                    className={`min-h-11 rounded-xl border-2 border-ink px-2 text-left text-xs font-bold ${open === key ? 'bg-ruby text-white' : 'bg-white'}`}
                  >
                    <span className="font-display text-sm">{b.label}</span> · {b.combos}
                    {open === key && <div className="font-semibold">{b.hand}: {pct(b.combos / s.combos, 1)} of their range</div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

export function BlockersPanel({ result }: { result: LabResult }) {
  const [on, setOn] = useState(false);
  const b = result.blockers;
  if (!b) return null;
  return (
    <Panel tone="cream" title="Blockers">
      <div className="space-y-2 text-ink">
        <button type="button" onClick={() => setOn(!on)} aria-expanded={on} className="flex min-h-11 w-full items-center justify-between font-bold">
          <span>
            Their range: {b.before} → {b.after} combos
          </span>
          <span className="text-sm underline">{on ? 'Hide' : 'Show'} what your cards remove</span>
        </button>
        {on && (
          <>
            <p className="text-xs font-semibold">
              Your two cards remove {b.before - b.after} combos ({pct((b.before - b.after) / Math.max(1, b.before), 1)} of their range). Red = hands you block.
            </p>
            <RangeGrid selected={new Set(b.removed.map((r) => r.label))} showStats={false} highlight={(l) => (b.removed.some((r) => r.label === l) ? 'bg-ruby text-white' : undefined)} />
            <div className="flex flex-wrap gap-1 text-xs font-bold">
              {b.removed.slice(0, 12).map((r) => (
                <span key={r.label} className="rounded-md bg-ink/10 px-1.5 py-0.5">
                  {r.label} {r.before}→{r.after}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}

export function AdvantagePanel({ result }: { result: LabResult }) {
  const a = result.advantage;
  if (!a) return null;
  return (
    <Panel tone="night" title="Range and nut advantage">
      <div className="space-y-1 text-sm font-semibold">
        <div className="grid grid-cols-2 gap-1.5 text-center">
          <div className="rounded-xl border-2 border-ink bg-ink/40 py-1">
            <div className="font-display text-lg text-gold-300">{pct(a.equityA, 0)}</div>
            <div className="text-[11px]">Player 1 range equity</div>
          </div>
          <div className="rounded-xl border-2 border-ink bg-ink/40 py-1">
            <div className="font-display text-lg text-gold-300">
              {pct(a.nutA, 0)} / {pct(a.nutB, 0)}
            </div>
            <div className="text-[11px]">Monsters: P1 / P2</div>
          </div>
        </div>
        <p>{a.line}</p>
      </div>
    </Panel>
  );
}

const SUIT_ROWS = ['s', 'h', 'd', 'c'] as const;

export function NextCardPanel({ grid, onClose }: { grid: NextCardGrid; onClose?: () => void }) {
  const byCode = new Map(grid.cards.map((c) => [c.card, c]));
  const ranks = [...RANKS].reverse();
  const cell = (eq: number | null) => {
    if (eq === null) return { background: 'rgba(0,0,0,0.35)' };
    const d = eq - grid.now;
    const a = Math.min(1, Math.abs(d) / 0.3);
    return { background: d >= 0 ? `rgba(53,196,106,${0.15 + 0.85 * a})` : `rgba(229,72,77,${0.15 + 0.85 * a})` };
  };
  return (
    <Panel tone="night" title="Next card explorer">
      <div className="space-y-2">
        <p className="text-xs font-semibold text-cream/80">
          Your equity now: <b className="text-gold-300">{pct(grid.now)}</b>. Green cards help you, red cards hurt (darker = bigger swing). Grey = not in the deck.
        </p>
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(13, minmax(0, 1fr))` }}>
          {SUIT_ROWS.flatMap((s) =>
            ranks.map((r) => {
              const c = byCode.get(`${r}${s}`);
              return (
                <div key={`${r}${s}`} className="flex h-9 flex-col items-center justify-center rounded border border-ink/60 text-[9px] font-bold leading-tight" style={cell(c?.equity ?? null)} title={c?.change}>
                  <MiniCard code={`${r}${s}`} />
                  <span>{c?.equity === null || !c ? '' : Math.round(c.equity * 100)}</span>
                </div>
              );
            }),
          )}
        </div>
        {[
          ['Best cards', grid.best],
          ['Worst cards', grid.worst],
        ].map(([k, list]) => (
          <div key={k as string}>
            <div className="font-display text-sm text-gold-300">{k as string}</div>
            <ul className="space-y-0.5 text-xs font-semibold">
              {(list as NextCardGrid['best']).map((c) => (
                <li key={c.card} className="flex items-center gap-1">
                  <MiniCard code={c.card} /> {pct(c.equity!)} — {c.change}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {onClose && (
          <button type="button" className="min-h-11 text-sm font-bold underline" onClick={onClose}>
            Hide explorer
          </button>
        )}
      </div>
    </Panel>
  );
}

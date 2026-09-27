import { useMemo, useState } from 'react';
import { classifyBoard, evaluateHand, formatPercent, parseCards, type EquityResult } from '../engine';
import { runEquity } from '../workers/equityClient';
import { ScreenHeader } from '../components/ScreenHeader';
import { CardView, GameButton, Panel, ProgressBar } from '../components/ui';

const HAND_RE = /^([2-9TJQKA][shdc]){2}$/i;
const BAR_COLORS = ['gold', 'blue', 'red', 'purple', 'green'] as const;

function tryCards(text: string) {
  try {
    return { cards: parseCards(text), error: null };
  } catch (e) {
    return { cards: [], error: (e as Error).message };
  }
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="font-display text-sm text-ink/80">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        className="mt-0.5 w-full rounded-xl border-[3px] border-ink bg-white px-3 py-2 font-mono text-base text-ink shadow-chunky-sm outline-none select-text focus:ring-4 focus:ring-gold-300"
      />
    </label>
  );
}

/** Hidden sanity-check screen: type hands/ranges and a board, see engine equity. */
export function DebugEquityScreen() {
  const [players, setPlayers] = useState(['AhAs', 'KdKc']);
  const [board, setBoard] = useState('');
  const [result, setResult] = useState<EquityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const boardParsed = useMemo(() => tryCards(board), [board]);
  const texture = useMemo(() => {
    if (boardParsed.error || boardParsed.cards.length < 3) return null;
    try {
      return classifyBoard(boardParsed.cards);
    } catch {
      return null;
    }
  }, [boardParsed]);

  const madeHand = (spec: string) => {
    const compact = spec.replace(/[\s,]+/g, '');
    if (!HAND_RE.test(compact) || boardParsed.error || boardParsed.cards.length < 3) return null;
    try {
      return evaluateHand([...parseCards(compact), ...boardParsed.cards]).description;
    } catch {
      return null;
    }
  };

  const calculate = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await runEquity(players, { board }));
    } catch (e) {
      setResult(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const update = (i: number, v: string) => setPlayers((ps) => ps.map((p, k) => (k === i ? v : p)));

  return (
    <div className="space-y-4">
      <ScreenHeader title="Equity Debug" subtitle="Sanity-check the engine by hand" />

      <Panel tone="cream">
        <div className="space-y-3">
          {players.map((p, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Field label={`Player ${i + 1} — hand or range`} value={p} onChange={(v) => update(i, v)} placeholder="AsKd or QQ+, AKs or random" />
              </div>
              {players.length > 2 && (
                <GameButton size="sm" color="red" aria-label={`Remove player ${i + 1}`} onClick={() => setPlayers((ps) => ps.filter((_, k) => k !== i))}>
                  ✕
                </GameButton>
              )}
            </div>
          ))}
          {players.length < 9 && (
            <GameButton size="sm" color="cream" onClick={() => setPlayers((ps) => [...ps, 'random'])}>
              + Add player
            </GameButton>
          )}
          <Field label="Board (0, 3, 4 or 5 cards)" value={board} onChange={setBoard} placeholder="Kh 7h 2c" />
          {boardParsed.error && <p className="text-sm font-bold text-ruby">{boardParsed.error}</p>}
          {boardParsed.cards.length > 0 && (
            <div className="flex gap-1.5">
              {boardParsed.cards.map((c) => (
                <CardView key={c.rank + c.suit} card={c} size="sm" />
              ))}
            </div>
          )}
          {texture && (
            <p className="text-sm font-semibold">
              Texture: <b>{texture.summary}</b> · favours {texture.favors.replace('-', ' ')}
            </p>
          )}
        </div>
      </Panel>

      <GameButton color="gold" size="lg" fullWidth disabled={busy} onClick={calculate}>
        {busy ? 'Calculating…' : 'Calculate'}
      </GameButton>

      {error && (
        <Panel tone="night">
          <p className="font-bold text-[#ff9c94]">{error}</p>
        </Panel>
      )}

      {result && (
        <Panel tone="night" title="Result">
          <div className="space-y-3">
            {result.players.map((p, i) => {
              const made = madeHand(players[i] ?? '');
              return (
                <div key={i}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-mono text-sm">{p.input}</span>
                    <span className="font-display text-xl text-gold-300">{formatPercent(p.equity, 2)}</span>
                  </div>
                  <ProgressBar value={p.equity} size="sm" color={BAR_COLORS[i % BAR_COLORS.length]} className="my-1" />
                  <div className="flex flex-wrap gap-x-3 text-xs font-semibold text-cream/85">
                    <span>Win {formatPercent(p.win, 2)}</span>
                    <span>Tie {formatPercent(p.tie, 2)}</span>
                    {result.method === 'monte-carlo' && <span>± {formatPercent(p.margin95, 2)}</span>}
                    <span>
                      {Number.isInteger(p.combos) ? p.combos : p.combos.toFixed(1)} {p.combos === 1 ? 'combo' : 'combos'}
                    </span>
                    {made && <span className="text-gold-300">{made}</span>}
                  </div>
                </div>
              );
            })}
            <p className="border-t-2 border-cream/20 pt-2 text-xs font-semibold text-cream/70">
              {result.method === 'exact'
                ? `Exact: ${result.samples.toLocaleString()} run-outs`
                : `Monte Carlo: ${result.samples.toLocaleString()} trials, 95% confidence ± ${formatPercent(result.maxMargin95, 2)}`}{' '}
              · {Math.round(result.elapsedMs)} ms
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}

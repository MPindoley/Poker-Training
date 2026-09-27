import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { importPostflopSolver, SOLVER_ACCEPTABLE_FREQ } from '../../engine';
import { usePostflopSolver } from '../../state/postflopSolverStore';
import { toast } from '../../state/toastStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GameButton, Panel } from '../../components/ui';

const PLACEHOLDER = `pot,positions,stack,flop,actor,facing,hand,action,frequency
srp,BB-BTN,100,As7h2c,BTN,,AKo,bet33,…`;

/** Import postflop (flop) solver strategies. Matching drill and review spots are graded from them. */
export function PostflopSolverImportScreen() {
  const navigate = useNavigate();
  const imports = usePostflopSolver((s) => s.imports);
  const add = usePostflopSolver((s) => s.add);
  const remove = usePostflopSolver((s) => s.remove);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('Pasted text');
  const fileRef = useRef<HTMLInputElement>(null);
  const result = useMemo(() => (text.trim() ? importPostflopSolver(text, { name: fileName }) : null), [text, fileName]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 5_000_000) {
      toast({ tone: 'mistake', title: 'File too big', message: 'Keep solver exports under 5 MB.' });
      return;
    }
    setFileName(f.name);
    setText(await f.text());
  };

  const apply = () => {
    if (!result || result.errors.length || !result.entries.length) return;
    add(result.name === 'Postflop import' ? fileName : result.name, result.entries);
    toast({ tone: 'best', title: 'Postflop strategy imported', message: `${result.entries.length} flop spot${result.entries.length > 1 ? 's' : ''} (every suit-equivalent flop counts)` });
    setText('');
  };

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Postflop Import"
        subtitle="Grade flop spots from your solver's frequencies"
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate('/train/postflop')}>
            Back
          </GameButton>
        }
      />

      <Panel tone="cream" title="1. Load the file">
        <input ref={fileRef} type="file" accept=".json,.csv,.txt,application/json,text/csv,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <GameButton color="blue" fullWidth onClick={() => fileRef.current?.click()}>
          Choose JSON or CSV file
        </GameButton>
        <label className="mt-3 block text-xs font-bold text-ink/70" htmlFor="pf-solver-text">
          …or paste it here
        </label>
        <textarea
          id="pf-solver-text"
          value={text}
          onChange={(e) => {
            setFileName('Pasted text');
            setText(e.target.value);
          }}
          rows={6}
          spellCheck={false}
          className="mt-1 w-full rounded-2xl border-[3px] border-ink bg-white p-2 font-mono text-[12px] text-ink select-text"
          placeholder={PLACEHOLDER}
        />
        <p className="mt-2 text-xs font-bold text-ink/70">
          Format files (hand-made placeholders, <b>not solver output</b>, and they can’t be imported):{' '}
          <a className="underline" href="/examples/postflop-FORMAT-EXAMPLE.json" download>
            JSON
          </a>{' '}
          ·{' '}
          <a className="underline" href="/examples/postflop-FORMAT-EXAMPLE.csv" download>
            CSV
          </a>
        </p>
      </Panel>

      {result && (
        <Panel tone={result.errors.length ? 'night' : 'felt'} title="2. Check and apply">
          {result.errors.length > 0 ? (
            <>
              <p className="font-display text-lg text-[#ff9c94]">
                Can't import yet — {result.errors.length} problem{result.errors.length > 1 ? 's' : ''}
              </p>
              <ul className="mt-1 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs font-bold">
                {result.errors.slice(0, 30).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="font-display text-lg">
                {result.rows} rows · {result.entries.length} flop spot{result.entries.length === 1 ? '' : 's'}
              </p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {result.entries.slice(0, 40).map((e, i) => (
                  <li key={i} className="rounded-lg border-2 border-ink bg-ink/40 px-2 py-0.5 font-mono text-xs">
                    {e.pot} {e.positions} {e.stack}bb {e.flop} · {e.actor}
                    {e.facing !== null ? ` vs ${Math.round(e.facing * 100)}%` : ''} · {Object.keys(e.strategy).length} hands
                  </li>
                ))}
              </ul>
            </>
          )}
          {result.warnings.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs font-bold text-gold-300">
              {result.warnings.slice(0, 20).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <GameButton className="mt-3" color="gold" fullWidth disabled={result.errors.length > 0 || !result.entries.length} onClick={apply}>
            Apply import
          </GameButton>
        </Panel>
      )}

      <Panel tone="wood" title="Active imports">
        {imports.length === 0 ? (
          <p className="text-center text-sm font-bold text-cream/85">No postflop imports yet. Postflop grades come from the model (labelled “Model estimate”).</p>
        ) : (
          <ul className="space-y-2">
            {imports.map((rec, i) => (
              <li key={i} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-ink/40 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display">{rec.name}</div>
                  <div className="text-[11px] font-bold text-cream/80">
                    {rec.entries.length} flop spots · {new Date(rec.date).toLocaleDateString()}
                  </div>
                </div>
                <GameButton size="sm" color="red" onClick={() => remove(i)}>
                  Remove
                </GameButton>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs font-bold text-cream/85">
          A spot = pot type (srp / 3bet / limped), positions “OOP-IP”, stack in bb, flop, the player to act, and the bet faced (% of pot, blank if none). Hands: classes (AKs) or exact
          combos (AhKd). Actions: check, fold, call, bet33, bet75, raise3x. Grading: the most frequent action is Best, anything played {Math.round(SOLVER_ACCEPTABLE_FREQ * 100)}%+ is
          Acceptable. Heads-up flop spots only; see README for details.
        </p>
      </Panel>
    </div>
  );
}

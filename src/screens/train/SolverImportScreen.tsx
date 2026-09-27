import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { importSolverOutput } from '../../engine';
import { useChartStore, useCharts } from '../../state/chartStore';
import { toast } from '../../state/toastStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ChipGroup } from '../../components/ui/Chips';
import { GameButton, Panel } from '../../components/ui';

const EXAMPLE_CSV = `spot,hand,action,frequency
rfi.CO,AA,raise,1
rfi.CO,A5s,raise,0.5
vsOpen.BB.BTN,A5s,3bet,40%
vsOpen.BB.BTN,A5s,call,60%`;

const EXAMPLE_JSON = `{
  "chart": "cash-6max-100bb",
  "spots": [
    { "spot": "rfi.CO", "strategy": { "AA": { "raise": 1 }, "A5s": { "raise": 0.5 } } },
    { "spot": "vs3bet.BTN", "ranges": { "4bet": "QQ+,AKs,A5s", "call": "JJ-77,AQs+,KQs" } }
  ]
}`;

/** Import solver output (JSON/CSV). Imported spots override the built-in preflop charts everywhere. */
export function SolverImportScreen() {
  const navigate = useNavigate();
  const charts = useCharts();
  const activeId = useChartStore((s) => s.chartId);
  const imports = useChartStore((s) => s.solverImports ?? {});
  const applyImport = useChartStore((s) => s.applyImport);
  const removeImport = useChartStore((s) => s.removeImport);
  const [chartId, setChartId] = useState(activeId);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('Pasted text');
  const fileRef = useRef<HTMLInputElement>(null);

  const result = useMemo(() => (text.trim() ? importSolverOutput(text, charts, chartId) : null), [text, charts, chartId]);

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
    if (!result || result.errors.length || !result.chartId) return;
    applyImport(result.chartId, result.overrides, fileName);
    toast({ tone: 'best', title: 'Solver strategy imported', message: `${result.spots.length} spot${result.spots.length > 1 ? 's' : ''} now override ${charts[result.chartId]!.name}` });
    setText('');
  };

  const allImports = Object.entries(imports).flatMap(([id, list]) => list.map((rec, i) => ({ id, i, rec })));

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Solver Import"
        subtitle="Your solver's strategy replaces the built-in chart"
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate('/train/preflop')}>
            Back
          </GameButton>
        }
      />

      <Panel tone="night" title="1. Pick the chart">
        <ChipGroup options={Object.values(charts).map((c) => ({ value: c.id, label: c.name }))} value={[chartId]} onChange={(v) => v[0] && setChartId(v[0])} />
        <p className="mt-2 text-xs font-bold text-cream/80">A JSON file's "chart" field (or a CSV "chart" column) takes priority over this.</p>
      </Panel>

      <Panel tone="cream" title="2. Load the file">
        <input ref={fileRef} type="file" accept=".json,.csv,.txt,application/json,text/csv,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <GameButton color="blue" fullWidth onClick={() => fileRef.current?.click()}>
          Choose JSON or CSV file
        </GameButton>
        <label className="mt-3 block text-xs font-bold text-ink/70" htmlFor="solver-text">
          …or paste it here
        </label>
        <textarea
          id="solver-text"
          value={text}
          onChange={(e) => {
            setFileName('Pasted text');
            setText(e.target.value);
          }}
          rows={6}
          spellCheck={false}
          className="mt-1 w-full rounded-2xl border-[3px] border-ink bg-white p-2 font-mono text-[12px] text-ink select-text"
          placeholder={EXAMPLE_CSV}
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <GameButton size="sm" color="cream" onClick={() => setText(EXAMPLE_CSV)}>
            CSV example
          </GameButton>
          <GameButton size="sm" color="cream" onClick={() => setText(EXAMPLE_JSON)}>
            JSON example
          </GameButton>
        </div>
      </Panel>

      {result && (
        <Panel tone={result.errors.length ? 'night' : 'felt'} title="3. Check and apply">
          {result.errors.length > 0 ? (
            <>
              <p className="font-display text-lg text-[#ff9c94]">Can't import yet — {result.errors.length} problem{result.errors.length > 1 ? 's' : ''}</p>
              <ul className="mt-1 max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-xs font-bold">
                {result.errors.slice(0, 30).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <p className="font-display text-lg">
                {result.rows} rows · {result.spots.length} spot{result.spots.length > 1 ? 's' : ''} for {charts[result.chartId!]!.name}
              </p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {result.spots.map((s) => (
                  <li key={s} className="rounded-lg border-2 border-ink bg-ink/40 px-2 py-0.5 font-mono text-xs">
                    {s}
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
          <GameButton className="mt-3" color="gold" fullWidth disabled={result.errors.length > 0} onClick={apply}>
            Apply import
          </GameButton>
        </Panel>
      )}

      <Panel tone="wood" title="Active imports">
        {allImports.length === 0 ? (
          <p className="text-center text-sm font-bold text-cream/85">No solver imports yet. The built-in charts are in use.</p>
        ) : (
          <ul className="space-y-2">
            {allImports.map(({ id, i, rec }) => (
              <li key={`${id}-${i}`} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-ink/40 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display">{rec.name}</div>
                  <div className="text-[11px] font-bold text-cream/80">
                    {charts[id]?.name ?? id} · {new Set(rec.keys.map((k) => k.split('.').slice(0, -1).join('.'))).size} spots · {new Date(rec.date).toLocaleDateString()}
                  </div>
                </div>
                <GameButton size="sm" color="red" onClick={() => removeImport(id, i)}>
                  Remove
                </GameButton>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs font-bold text-cream/85">
          Format: spot (rfi.CO, vsOpen.BB.BTN, vs3bet.CO), hand (AKs, QQ or AhKh), action (raise / 3bet / call / 4bet), frequency (0–1 or %). Unlisted hands fold.
        </p>
      </Panel>
    </div>
  );
}

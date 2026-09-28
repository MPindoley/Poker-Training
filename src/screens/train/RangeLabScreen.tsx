import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  EQUITY_GUESS_BEST,
  EQUITY_GUESS_OK,
  LAB_MAX_PLAYERS,
  answerXp,
  createRng,
  decodeScenario,
  encodeScenario,
  formatPercent,
  gradeEquityGuess,
  shuffledDeck,
  cardToString,
  validateScenario,
  type LabPlayer,
  type LabResult,
  type LabScenario,
  type NextCardGrid,
} from '../../engine';
import { nextCardGridInWorker, runLabInWorker } from '../../workers/engineClient';
import { useLab } from '../../state/labStore';
import { useDrillStats } from '../../state/drillStatsStore';
import { useProgress } from '../../state/progressStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ActionDock, CardPicker, CardView, Celebration, FeedbackBanner, GameButton, Panel, Toggle } from '../../components/ui';
import { toast } from '../../state/toastStore';
import { PlayerEditor } from '../../components/lab/PlayerEditor';
import { AdvantagePanel, BlockersPanel, BucketsPanel, EquityPanel, NextCardPanel, ShowdownPanel } from '../../components/lab/LabResults';
import { Slider } from '../../components/learn/Slider';

const STREETS = [
  { n: 0, label: 'Preflop' },
  { n: 3, label: 'Flop' },
  { n: 4, label: 'Turn' },
  { n: 5, label: 'River' },
] as const;

const DEFAULT: LabScenario = {
  players: [
    { kind: 'hand', text: 'AhKh' },
    { kind: 'range', text: 'random' },
  ],
  board: [],
  dead: [],
};

const cardsOf = (p: LabPlayer) => (p.kind === 'hand' ? (p.text.match(/[2-9TJQKA][shdc]/gi) ?? []) : []);

function Busy({ text }: { text: string }) {
  return (
    <Panel tone="night">
      <p className="text-center font-bold">{text}</p>
      <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-ink bg-ink/60">
        <div className="h-full w-1/3 animate-[lab-slide_1.1s_ease-in-out_infinite] rounded-full bg-gold-500" />
      </div>
      <style>{'@keyframes lab-slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}'}</style>
    </Panel>
  );
}

/** Range Lab: set up any spot and study it (equity, buckets, blockers, advantage, next cards). */
export function RangeLabScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const fromUrl = useMemo(() => decodeScenario(location.search), [location.search]);
  const [scenario, setScenario] = useState<LabScenario>(() => fromUrl ?? DEFAULT);
  const [street, setStreet] = useState<number>(() => (fromUrl ? fromUrl.board.length : 0));
  const [boardPool, setBoardPool] = useState<string[]>(() => fromUrl?.board ?? []);
  const [showDead, setShowDead] = useState((fromUrl?.dead.length ?? 0) > 0);
  const [guessMode, setGuessMode] = useState(() => new URLSearchParams(location.search).get('guess') === '1');
  const [guess, setGuess] = useState(50);
  const [guessResult, setGuessResult] = useState<{ grade: 'best' | 'acceptable' | 'mistake'; error: number; actual: number; xp: number } | null>(null);
  const [result, setResult] = useState<{ r: LabResult; s: LabScenario } | null>(null);
  const [grid, setGrid] = useState<NextCardGrid | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState(fromUrl?.name ?? '');
  const started = useRef(performance.now());
  const saved = useLab((s) => s.saved);
  const save = useLab((s) => s.save);
  const removeSaved = useLab((s) => s.remove);
  const addGuess = useLab((s) => s.addGuess);
  const record = useDrillStats((s) => s.record);
  const addXp = useProgress((s) => s.addXp);
  const recordPractice = useProgress((s) => s.recordPractice);

  // The analysed board is the first `street` cards of the picked pool.
  const board = boardPool.slice(0, street);
  const current: LabScenario = { ...scenario, board };
  const usedBy = (except: 'board' | 'dead' | number) => [
    ...(except === 'board' ? [] : boardPool),
    ...(except === 'dead' ? [] : scenario.dead),
    ...scenario.players.flatMap((p, i) => (i === except ? [] : cardsOf(p))),
  ];

  const invalid = (() => {
    try {
      validateScenario(current);
      return boardPool.length < street ? `Pick ${street} board cards for the ${STREETS.find((s) => s.n === street)!.label.toLowerCase()}.` : null;
    } catch (e) {
      return (e as Error).message;
    }
  })();

  // Any change clears the old result.
  useEffect(() => {
    setResult(null);
    setGrid(null);
    setGuessResult(null);
    setError(null);
    started.current = performance.now();
  }, [JSON.stringify(current)]); // eslint-disable-line react-hooks/exhaustive-deps

  const setPlayer = (i: number, p: LabPlayer) => setScenario((s) => ({ ...s, players: s.players.map((x, k) => (k === i ? p : x)) }));

  const run = async () => {
    if (invalid) return;
    setBusy(scenario.players.length > 2 ? 'Dealing out every run-out for each player…' : 'Counting every run-out…');
    setError(null);
    try {
      const r = await runLabInWorker(current);
      setResult({ r, s: current });
      if (guessMode) {
        const actual = r.equity.players[0]!.equity;
        const g = gradeEquityGuess(guess / 100, actual);
        const xp = answerXp(g.grade, 'silver');
        addXp(xp);
        record('lab.guess', ['lab.guess', `lab.guess:${current.board.length}`], g.grade, performance.now() - started.current);
        addGuess({ at: Date.now(), guess: guess / 100, actual });
        recordPractice();
        setGuessResult({ ...g, actual, xp });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const explore = async () => {
    setBusy('Trying every possible next card…');
    try {
      setGrid(await nextCardGridInWorker(current));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const dealRandom = () => {
    const used = new Set(usedBy('board'));
    const deck = shuffledDeck(createRng(Date.now()))
      .map(cardToString)
      .filter((c) => !used.has(c));
    setBoardPool(deck.slice(0, 5));
    if (street === 0) setStreet(3);
  };

  const share = async () => {
    const url = `${window.location.origin}/train/lab?${encodeScenario({ ...current, name: saveName || undefined })}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Felt Academy Range Lab', url });
      else {
        await navigator.clipboard.writeText(url);
        toast({ tone: 'info', title: 'Link copied', message: 'Anyone with the link opens this exact spot.' });
      }
    } catch {
      /* user cancelled */
    }
  };

  const guessStats = useLab((s) => s.guesses);
  const within = guessStats.filter((g) => Math.abs(g.guess - g.actual) <= EQUITY_GUESS_BEST).length;

  return (
    <div className="space-y-3">
      <ScreenHeader
        title="Range Lab"
        subtitle="Build any spot and see the math"
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate('/train')}>
            Back
          </GameButton>
        }
      />

      <div className="space-y-2">
        {scenario.players.map((p, i) => (
          <PlayerEditor
            key={i}
            index={i}
            player={p}
            used={usedBy(i)}
            onChange={(np) => setPlayer(i, np)}
            onRemove={scenario.players.length > 2 ? () => setScenario((s) => ({ ...s, players: s.players.filter((_, k) => k !== i) })) : undefined}
          />
        ))}
        {scenario.players.length < LAB_MAX_PLAYERS && (
          <GameButton size="sm" color="cream" fullWidth onClick={() => setScenario((s) => ({ ...s, players: [...s.players, { kind: 'range', text: 'random' }] }))}>
            + Add player ({scenario.players.length}/{LAB_MAX_PLAYERS})
          </GameButton>
        )}
      </div>

      <Panel tone="felt" title="Board">
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Street">
            {STREETS.map((s) => (
              <button
                key={s.n}
                type="button"
                role="radio"
                aria-checked={street === s.n}
                onClick={() => setStreet(s.n)}
                className={`min-h-11 rounded-xl border-2 border-ink font-display text-sm ${street === s.n ? 'bg-gold-500 text-ink' : 'bg-ink/40 text-cream'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {street > 0 && (
            <>
              <div className="flex min-h-14 items-center justify-center gap-1">
                {Array.from({ length: street }, (_, i) =>
                  boardPool[i] ? (
                    <CardView key={i} card={boardPool[i]!} size="sm" />
                  ) : (
                    <span key={i} className="grid h-14 w-10 place-items-center rounded-lg border-2 border-dashed border-cream/50 font-display text-cream/50">
                      ?
                    </span>
                  ),
                )}
              </div>
              <CardPicker value={boardPool.slice(0, street)} max={street} disabled={usedBy('board')} onChange={(v) => setBoardPool([...v, ...boardPool.slice(street).filter((c) => !v.includes(c))])} />
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <GameButton size="sm" color="cream" onClick={dealRandom}>
              Random board
            </GameButton>
            <GameButton size="sm" color="cream" onClick={() => setShowDead(!showDead)}>
              {showDead ? 'Hide dead cards' : `Dead cards${scenario.dead.length ? ` (${scenario.dead.length})` : ''}`}
            </GameButton>
          </div>
          {showDead && (
            <div>
              <p className="mb-1 text-xs font-bold text-cream/80">Cards you know are out (folded, flashed): they can’t come on the board or be in anyone’s hand.</p>
              <CardPicker value={scenario.dead} max={8} disabled={usedBy('dead')} onChange={(v) => setScenario((s) => ({ ...s, dead: v }))} />
            </div>
          )}
        </div>
      </Panel>

      <Toggle label="Guess mode" on={guessMode} onChange={setGuessMode} hint="Guess your equity before you see it. Earns XP and trains your Equity Intuition." />
      {guessMode && !result && (
        <Panel tone="night">
          <Slider label="Your equity guess (player 1)" value={guess} min={0} max={100} step={1} onChange={setGuess} format={(v) => `${v}%`} />
          <p className="mt-1 text-xs font-semibold text-cream/70">
            Within {Math.round(EQUITY_GUESS_BEST * 100)} points = Best, within {Math.round(EQUITY_GUESS_OK * 100)} = Acceptable.
            {guessStats.length > 0 && ` So far: ${within} of ${guessStats.length} guesses within ${Math.round(EQUITY_GUESS_BEST * 100)} points.`}
          </p>
        </Panel>
      )}

      {!result && (
        <ActionDock tabs className="space-y-1">
          {invalid && <p className="text-center text-sm font-bold text-gold-300">{invalid}</p>}
          <GameButton color="gold" size="lg" fullWidth disabled={!!invalid || !!busy} onClick={run}>
            {guessMode ? 'Lock in my guess' : 'Run the numbers'}
          </GameButton>
        </ActionDock>
      )}
      {busy && <Busy text={busy} />}
      {error && (
        <Panel tone="night">
          <p className="font-bold text-[#ff9c94]">{error}</p>
        </Panel>
      )}

      {guessResult && (
        <>
          {guessResult.grade === 'best' && <Celebration />}
          <FeedbackBanner
            tone={guessResult.grade}
            title={`Off by ${Math.round(guessResult.error * 1000) / 10} points · +${guessResult.xp} XP`}
            math={[`Your guess: ${guess}%`, `Real equity: ${formatPercent(guessResult.actual)}`, `Error = |${guess}% − ${formatPercent(guessResult.actual)}| = ${formatPercent(guessResult.error)}`]}
          >
            Equity is your share of the pot on average over every way the rest of the board can come. The breakdown below shows why.
          </FeedbackBanner>
        </>
      )}

      {result && (
        <>
          <EquityPanel result={result.r} scenario={result.s} />
          <BucketsPanel result={result.r} />
          <ShowdownPanel result={result.r} />
          <AdvantagePanel result={result.r} />
          {!result.r.advantage && result.s.board.length >= 3 && result.s.players[0]!.kind === 'hand' && result.s.players[1]!.kind === 'range' && (
            <p className="text-center text-xs font-bold text-cream/70">Tip: make player 1 a range too to compare range and nut advantage.</p>
          )}
          <BlockersPanel result={result.r} />
          {(result.s.board.length === 3 || result.s.board.length === 4) &&
            (grid ? (
              <NextCardPanel grid={grid} onClose={() => setGrid(null)} />
            ) : (
              <GameButton color="purple" fullWidth disabled={!!busy} onClick={explore}>
                Explore the {result.s.board.length === 3 ? 'turn' : 'river'} card
              </GameButton>
            ))}
          <GameButton color="cream" size="sm" fullWidth onClick={() => setResult(null)}>
            {guessMode ? 'Guess again' : 'Edit the spot'}
          </GameButton>
        </>
      )}

      <Panel tone="cream" title="Save and share">
        <div className="space-y-2 text-ink">
          <div className="flex gap-2">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Name this spot"
              aria-label="Scenario name"
              className="min-h-11 min-w-0 flex-1 rounded-xl border-[3px] border-ink bg-white px-2 text-sm outline-none select-text focus:ring-4 focus:ring-gold-300"
            />
            <GameButton
              size="sm"
              color="green"
              disabled={!saveName.trim() || !!invalid}
              onClick={() => {
                save(saveName.trim(), current);
                toast({ tone: 'info', title: 'Saved', message: saveName.trim() });
              }}
            >
              Save
            </GameButton>
          </div>
          <GameButton size="sm" color="blue" fullWidth disabled={!!invalid} onClick={share}>
            Share as a link
          </GameButton>
          {saved.length > 0 && (
            <ul className="space-y-1">
              {saved.map((s) => (
                <li key={s.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    className="min-h-11 min-w-0 flex-1 truncate rounded-xl border-2 border-ink bg-white px-2 text-left text-sm font-bold"
                    onClick={() => {
                      setScenario({ players: s.scenario.players, board: [], dead: s.scenario.dead });
                      setBoardPool(s.scenario.board);
                      setStreet(s.scenario.board.length);
                      setShowDead(s.scenario.dead.length > 0);
                      setSaveName(s.name);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    {s.name}
                    <span className="ml-1 text-xs text-ink/60">
                      {s.scenario.players.length} players{s.scenario.board.length ? ` · ${s.scenario.board.join(' ')}` : ''}
                    </span>
                  </button>
                  <button type="button" aria-label={`Delete ${s.name}`} onClick={() => removeSaved(s.id)} className="min-h-11 min-w-11 rounded-xl border-2 border-ink bg-ruby font-display text-white">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
      <p className="pb-2 text-center text-xs font-semibold text-cream/60">All math runs on your phone in the background (equity engine in a worker).</p>
    </div>
  );
}

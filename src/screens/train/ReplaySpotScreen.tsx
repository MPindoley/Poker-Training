import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { REGULAR_MODEL, analyzeSpot, buildReplaySpot, type PreflopLine, type ReplayInput, type Spot, type SpotAnalysis, type StreetLine } from '../../engine';
import { useActiveChart } from '../../state/chartStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SpotAnalysisView } from '../../components/SpotAnalysisView';
import { ActionDock, CardPicker, ChipGroup, GameButton, Panel } from '../../components/ui';
import { useProfileModels } from '../../state/profileModels';

const SEATS = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const PREFLOP: { value: PreflopLine; label: string }[] = [
  { value: 'hero-open', label: 'I opened, villain called' },
  { value: 'villain-open', label: 'Villain opened, I called' },
  { value: 'hero-3bet', label: 'I 3-bet, villain called' },
  { value: 'villain-3bet', label: 'Villain 3-bet, I called' },
  { value: 'limped', label: 'Limped pot' },
];
const LINES: { value: StreetLine; label: string }[] = [
  { value: 'hero-bet-call', label: 'I bet, villain called' },
  { value: 'villain-bet-call', label: 'Villain bet, I called' },
  { value: 'check-check', label: 'Checked through' },
];

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="font-display text-xs text-ink/70">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 min-h-11 w-full select-text rounded-xl border-[3px] border-ink bg-white px-3 font-display text-lg text-ink"
      />
    </label>
  );
}

export function ReplaySpotScreen() {
  const navigate = useNavigate();
  const chart = useActiveChart();
  const models = useProfileModels();
  const [hero, setHeroCards] = useState<string[]>([]);
  const [mode, setMode] = useState<'hero' | 'board'>('hero');
  const setHero = (cards: string[]) => {
    setHeroCards(cards);
    if (cards.length === 2) setMode('board');
  };
  const [board, setBoard] = useState<string[]>([]);
  const [heroSeat, setHeroSeat] = useState('BTN');
  const [villainSeat, setVillainSeat] = useState('BB');
  const [preflop, setPreflop] = useState<PreflopLine>('hero-open');
  const [earlier, setEarlier] = useState<StreetLine[]>(['hero-bet-call', 'hero-bet-call']);
  const [pot, setPot] = useState('12');
  const [stack, setStack] = useState('90');
  const [facing, setFacing] = useState('');
  const [modelId, setModelId] = useState(REGULAR_MODEL.id);
  const [result, setResult] = useState<{ spot: Spot; analysis: SpotAnalysis } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const analyze = () => {
    setBusy(true);
    setError(null);
    // Let the button repaint before the (short) synchronous analysis.
    setTimeout(() => {
      try {
        const input: ReplayInput = {
          hero: hero.join(''),
          board: board.join(''),
          heroSeat,
          villainSeat,
          preflop,
          earlier,
          pot: Number(pot),
          effectiveStack: Number(stack),
          facingBet: facing.trim() ? Number(facing) : null,
          model: models.find((m) => m.id === modelId) ?? REGULAR_MODEL,
        };
        if (!(input.pot > 0) || !(input.effectiveStack > 0)) throw new Error('Pot and stack must be positive numbers (in big blinds)');
        if (input.facingBet !== null && !(input.facingBet > 0)) throw new Error('Villain’s bet must be a positive number');
        const spot = buildReplaySpot(chart, input);
        setResult({ spot, analysis: analyzeSpot(spot, { gradeBy: spot.theme === 'cbet' ? 'cbet' : 'ev', sizes: [0.33, 0.5, 0.75, 1, 1.5] }) });
      } catch (e) {
        setResult(null);
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  const streetsBefore = Math.max(0, board.length - 3);

  return (
    <div className="space-y-3">
      <ScreenHeader
        title="Replay my spot"
        subtitle={`Ranges from: ${chart.name}`}
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate('/train/postflop')}>
            Back
          </GameButton>
        }
      />
      <Panel tone="night">
        <div className="mb-1 flex justify-between font-display text-sm">
          <span>Your cards ({hero.length}/2)</span>
          <span>Board ({board.length}/5)</span>
        </div>
        <div className="mb-2 flex gap-2">
          <ChipGroup
            options={[
              { value: 'hero', label: 'Pick my cards' },
              { value: 'board', label: 'Pick board' },
            ]}
            value={[mode]}
            onChange={(v) => setMode(v[0] as 'hero' | 'board')}
          />
        </div>
        {mode === 'hero' ? (
          <CardPicker value={hero} onChange={setHero} max={2} disabled={board} />
        ) : (
          <CardPicker value={board} onChange={setBoard} max={5} disabled={hero} />
        )}
        <div className="mt-2 flex flex-wrap gap-2 text-sm font-bold">
          <button type="button" className="min-h-11 rounded-xl border-2 border-ink bg-cream px-3 text-ink" onClick={() => {
              setHeroCards([]);
              setMode('hero');
            }}>
            Clear my cards {hero.join(' ')}
          </button>
          <button type="button" className="min-h-11 rounded-xl border-2 border-ink bg-cream px-3 text-ink" onClick={() => setBoard([])}>
            Clear board {board.join(' ')}
          </button>
        </div>
      </Panel>

      <Panel tone="cream">
        <div className="space-y-3 text-ink">
          <ChipGroup label="My seat" options={SEATS.map((s) => ({ value: s, label: s }))} value={[heroSeat]} onChange={(v) => setHeroSeat(v[0]!)} />
          <ChipGroup label="Villain's seat" options={SEATS.filter((s) => s !== heroSeat).map((s) => ({ value: s, label: s }))} value={[villainSeat]} onChange={(v) => setVillainSeat(v[0]!)} />
          <ChipGroup label="Preflop" options={PREFLOP} value={[preflop]} onChange={(v) => setPreflop(v[0]!)} />
          {Array.from({ length: streetsBefore }, (_, i) => (
            <ChipGroup
              key={i}
              label={i === 0 ? 'Flop action' : 'Turn action'}
              options={LINES}
              value={[earlier[i] ?? 'check-check']}
              onChange={(v) => setEarlier((e) => e.map((x, k) => (k === i ? v[0]! : x)))}
            />
          ))}
          <div className="grid grid-cols-3 gap-2">
            <NumberField label="Pot now (bb)" value={pot} onChange={setPot} />
            <NumberField label="Eff. stack (bb)" value={stack} onChange={setStack} />
            <NumberField label="Villain bets (bb)" value={facing} onChange={setFacing} />
          </div>
          <ChipGroup label="Villain plays like" options={models.map((m) => ({ value: m.id, label: m.name }))} value={[modelId]} onChange={(v) => setModelId(v[0]!)} />
          <p className="text-xs font-semibold text-ink/70">Leave “Villain bets” empty if you act first or it was checked to you. Amounts in big blinds.</p>
        </div>
      </Panel>

      <ActionDock tabs>
        <GameButton color="gold" size="lg" fullWidth disabled={busy || hero.length < 2 || board.length < 3} onClick={analyze}>
          {busy ? 'Analyzing…' : 'Analyze'}
        </GameButton>
      </ActionDock>
      {error && (
        <Panel tone="night">
          <p className="font-bold text-[#ff9c94]">{error}</p>
        </Panel>
      )}
      {result && <SpotAnalysisView spot={result.spot} analysis={result.analysis} />}
    </div>
  );
}

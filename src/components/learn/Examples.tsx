import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  ARCHETYPES,
  CATEGORY_NAMES,
  HandCategory,
  REGULAR_MODEL,
  RULES,
  applyAction,
  archetypeModel,
  bigBlindPrice,
  bluffBreakeven,
  choose,
  classifyBoard,
  comboWorking,
  createRng,
  evCall,
  fiveCardCategoryCounts,
  forStreet,
  formatPercent,
  generateSpot,
  hitProbability,
  icmEquity,
  impliedOddsNeeded,
  legalActions,
  minimumDefenseFrequency,
  parseCardIndices,
  rangeAdvantage,
  rangeFraction,
  rangeVisual,
  referenceFold,
  requiredEquity,
  resultRange,
  riskOfRuin,
  shuffledDeck,
  sizingRule,
  stackToPotRatio,
  startHand,
  strategyGrid,
  evaluateHand,
  cardToString,
  indexToString,
  countCombos,
  classifyRange,
  type ArchetypeId,
  type ShoveResult,
  type StrategyVisual,
} from '../../engine';
import { useCharts } from '../../state/chartStore';
import { isoSize, squeezeSize, straddleView, type ActionRanges } from '../../engine';
import { runEquity } from '../../workers/equityClient';
import { pushChartInWorker } from '../../workers/engineClient';
import { CardPicker, CardView, ChipGroup, GameButton, StrategyGrid } from '../ui';
import { ArchetypeBadge } from '../icons/ArchetypeBadge';
import { Readout, Slider } from './Slider';
import type { ExampleId } from '../../content/learn/types';

const pct = (x: number, d = 1) => formatPercent(x, d);
const bbf = (x: number) => `${Math.round(x * 10) / 10}bb`;

function HandRankings() {
  const counts = fiveCardCategoryCounts();
  const total = choose(52, 5);
  const [cards, setCards] = useState<string[]>([]);
  const deal = () => setCards(shuffledDeck(createRng(Date.now())).slice(0, 7).map(cardToString));
  const ev = cards.length === 7 ? evaluateHand(cards.map((c) => ({ rank: c[0] as never, suit: c[1] as never }))) : null;
  return (
    <div>
      <div className="space-y-0.5 text-xs font-bold">
        {[...Array(9).keys()].reverse().map((c) => (
          <div key={c} className="flex justify-between rounded bg-ink/30 px-2 py-0.5">
            <span>{CATEGORY_NAMES[c as HandCategory]}</span>
            <span className="font-mono text-gold-300">{pct(counts[c as HandCategory] / total, 4)}</span>
          </div>
        ))}
      </div>
      <GameButton className="mt-2" size="sm" color="gold" onClick={deal}>
        Deal 7 cards
      </GameButton>
      {ev && (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1">
            {cards.map((c) => (
              <CardView key={c} card={c} size="sm" dealt className={ev.best.some((b) => cardToString(b) === c) ? 'ring-2 ring-gold-300' : 'opacity-60'} />
            ))}
          </div>
          <div className="mt-1 font-display text-gold-300">{ev.description}</div>
        </div>
      )}
    </div>
  );
}

function Positions() {
  const charts = useCharts();
  const chart = charts['cash-9max-100bb']!;
  const [seat, setSeat] = useState('CO');
  const behind = chart.seatsBehind(seat).length;
  return (
    <div>
      <ChipGroup options={chart.openingSeats.map((s) => ({ value: s, label: s }))} value={[seat]} onChange={(v) => setSeat(v[0]!)} />
      <Readout items={[['Opens (built-in chart)', pct(rangeFraction(chart.rfi(seat)!.ranges.raise!), 0)], ['Players left to act', String(behind)]]} />
    </div>
  );
}

function MinRaise() {
  const [to, setTo] = useState(3);
  const s0 = startHand([{ name: 'A', stack: 100 }, { name: 'B', stack: 100 }, { name: 'C', stack: 100 }], 0, { sb: 0.5, bb: 1 }, createRng(1));
  const s1 = applyAction(s0, { type: 'raise', to });
  return (
    <div>
      <Slider label="First raise to" value={to} min={2} max={10} step={0.5} onChange={setTo} format={bbf} />
      <Readout items={[['Raise size', bbf(to - 1)], ['Min re-raise to', bbf(legalActions(s1)!.minTo)]]} />
    </div>
  );
}

const DRAWS: [string, number][] = [
  ['Gutshot', 4],
  ['Open-ender', 8],
  ['Flush draw', 9],
  ['Flush + over', 12],
  ['Combo draw', 15],
];

function Outs() {
  const [outs, setOuts] = useState(9);
  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-1">
        {DRAWS.map(([name, o]) => (
          <button key={name} type="button" onClick={() => setOuts(o)} className={`min-h-11 rounded-lg border-2 border-ink px-2 text-xs font-bold ${outs === o ? 'bg-gold-500 text-ink' : 'bg-ink/40'}`}>
            {name} ({o})
          </button>
        ))}
      </div>
      <Slider label="Outs" value={outs} min={1} max={21} onChange={setOuts} />
      <Readout
        items={[
          ['Flop → turn', `${pct(hitProbability(outs, 47, 1))} (rule ${outs * 2}%)`],
          ['Flop → river', `${pct(hitProbability(outs, 47, 2))} (rule ${outs * 4}%)`],
          ['Turn → river', `${pct(hitProbability(outs, 46, 1))} (rule ${outs * 2}%)`],
        ]}
      />
    </div>
  );
}

function PotOdds() {
  const [pot, setPot] = useState(20);
  const [bet, setBet] = useState(10);
  return (
    <div>
      <Slider label="Pot" value={pot} min={2} max={100} onChange={setPot} format={bbf} />
      <Slider label="Bet" value={bet} min={1} max={150} onChange={setBet} format={(v) => `${bbf(v)} (${Math.round((v / pot) * 100)}% pot)`} />
      <Readout
        items={[
          ['Equity to call', pct(requiredEquity(pot, bet).requiredEquity)],
          ['MDF', pct(minimumDefenseFrequency(pot, bet))],
          ['Bluff breakeven', pct(bluffBreakeven(pot, bet))],
          ['Odds', `${((pot + bet) / bet).toFixed(2)} : 1`],
        ]}
      />
    </div>
  );
}

function Implied() {
  const [pot, setPot] = useState(30);
  const [call, setCall] = useState(10);
  const [outs, setOuts] = useState(9);
  const eq = hitProbability(outs, 46, 1);
  const need = impliedOddsNeeded(pot, call, eq);
  return (
    <div>
      <Slider label="Pot (incl. bet)" value={pot} min={5} max={100} onChange={setPot} format={bbf} />
      <Slider label="To call" value={call} min={1} max={60} onChange={setCall} format={bbf} />
      <Slider label="Outs (turn)" value={outs} min={2} max={15} onChange={setOuts} />
      <Readout items={[['Equity', pct(eq)], ['Direct odds need', pct(requiredEquity(pot - call, call).requiredEquity)], ['Extra to win when you hit', need === 0 ? 'None — direct odds OK' : bbf(need)]]} />
    </div>
  );
}

function Equity() {
  const [a, setA] = useState('AhAs');
  const [b, setB] = useState('KdKc');
  const [board, setBoard] = useState('');
  const [res, setRes] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    runEquity([a, b], { board, iterations: 40000 })
      .then((r) => setRes(`${pct(r.players[0]!.equity)} vs ${pct(r.players[1]!.equity)}${r.method === 'monte-carlo' ? ` (±${pct(r.maxMargin95)})` : ' (exact)'}`))
      .catch((e: Error) => setRes(e.message))
      .finally(() => setBusy(false));
  };
  const input = 'min-h-11 w-full select-text rounded-lg border-2 border-ink bg-white px-2 font-mono text-ink';
  return (
    <div className="space-y-1.5">
      <input className={input} value={a} onChange={(e) => setA(e.target.value)} aria-label="Hand 1" />
      <input className={input} value={b} onChange={(e) => setB(e.target.value)} aria-label="Hand 2 or range" />
      <input className={input} value={board} onChange={(e) => setBoard(e.target.value)} placeholder="Board (optional)" aria-label="Board" />
      <GameButton size="sm" color="gold" disabled={busy} onClick={run}>
        {busy ? 'Running…' : 'Calculate'}
      </GameButton>
      {res && <div className="font-display text-gold-300">{res}</div>}
    </div>
  );
}

function Ev() {
  const [eq, setEq] = useState(0.35);
  const [pot, setPot] = useState(20);
  const [bet, setBet] = useState(10);
  const ev = evCall(pot, bet, eq);
  return (
    <div>
      <Slider label="Your equity" value={eq} min={0} max={1} step={0.01} onChange={setEq} format={(v) => pct(v, 0)} />
      <Slider label="Pot before bet" value={pot} min={2} max={100} onChange={setPot} format={bbf} />
      <Slider label="Villain bets" value={bet} min={1} max={100} onChange={setBet} format={bbf} />
      <Readout items={[['EV of calling', `${ev >= 0 ? '+' : ''}${bbf(ev)}`], ['Break-even equity', pct(requiredEquity(pot, bet).requiredEquity)]]} />
    </div>
  );
}

function Combos() {
  const [label, setLabel] = useState('AK');
  const [dead, setDead] = useState<string[]>(['Ah', 'Qc', 'Kd', '7s', '2c']);
  let out: { combos: number; steps: string[] } | null = null;
  try {
    out = comboWorking(label.trim(), parseCardIndices(dead.join('')));
  } catch {
    out = null;
  }
  return (
    <div>
      <ChipGroup options={['AK', 'AKs', 'AKo', 'KK', '77', 'KQ'].map((x) => ({ value: x, label: x }))} value={[label]} onChange={(v) => setLabel(v[0]!)} />
      <div className="my-1 text-xs font-bold text-cream/75">Cards you can see (your hand + board): tap to change</div>
      <CardPicker value={dead} onChange={setDead} max={7} />
      {out && (
        <div className="mt-1 font-mono text-xs text-gold-300">
          {out.steps.map((s) => (
            <div key={s}>{s.replace(/\{(\w\w)\}/g, '$1')}</div>
          ))}
          <div className="font-display text-base">= {out.combos} combos</div>
        </div>
      )}
    </div>
  );
}

function RangeChart() {
  const charts = useCharts();
  const [id, setId] = useState('cash-6max-100bb');
  const chart = charts[id]!;
  const [spot, setSpot] = useState('rfi:BTN');
  const options = [...chart.openingSeats.map((s) => ({ value: `rfi:${s}`, label: `${s} open` })), ...chart.facingOpenPairs().filter((p) => p.seat === 'BB').map((p) => ({ value: `bb:${p.opener}`, label: `BB vs ${p.opener}` }))];
  const [kind, seat] = spot.split(':') as [string, string];
  const s = kind === 'rfi' ? chart.rfi(seat) : chart.vsOpen('BB', seat);
  const visual: StrategyVisual | null = s
    ? {
        kind: 'strategy',
        cells: Object.fromEntries(Object.entries(strategyGrid(s)).map(([k, v]) => [k, v.freq])),
        actions: Object.keys(s.ranges).map((a) => ({ id: a, label: a === 'raise' ? 'Raise' : a === '3bet' ? '3-bet' : 'Call', color: a === 'call' ? '#22b35e' : '#e5383b' })),
        caption: `${chart.name} (approximation)`,
      }
    : null;
  return (
    <div className="space-y-2">
      <ChipGroup options={Object.values(charts).map((c) => ({ value: c.id, label: c.name.split(',')[0]! }))} value={[id]} onChange={(v) => setId(v[0]!)} />
      <select value={spot} onChange={(e) => setSpot(e.target.value)} className="min-h-11 w-full rounded-lg border-2 border-ink bg-white px-2 font-display text-ink">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {visual ? <StrategyGrid visual={visual} /> : <div className="text-sm font-bold">No data for this spot in this chart.</div>}
    </div>
  );
}

function SizingPrice() {
  const [size, setSize] = useState(2.5);
  const [limpers, setLimpers] = useState(0);
  return (
    <div>
      <Slider label="Open size" value={size} min={2} max={8} step={0.5} onChange={setSize} format={bbf} />
      <Slider label="Limpers" value={limpers} min={0} max={3} onChange={setLimpers} />
      <Readout
        items={[
          ['BB needs to call', pct(bigBlindPrice(size, limpers))],
          ['Casino suggestion', bbf(sizingRule('casino', 'CO', limpers).best)],
          ['Home-game suggestion', bbf(sizingRule('home', 'CO', limpers).best)],
        ]}
      />
    </div>
  );
}

function SetMining() {
  const [call, setCall] = useState(3);
  const [behind, setBehind] = useState(60);
  const p = hitProbability(2, 50, 3);
  const needed = ((1 - p) / p) * call;
  return (
    <div>
      <Slider label="Call" value={call} min={1} max={10} step={0.5} onChange={setCall} format={bbf} />
      <Slider label="Effective stack behind" value={behind} min={5} max={200} onChange={setBehind} format={bbf} />
      <Readout items={[['Set chance', pct(p)], ['Break-even payoff', bbf(needed)], ['Stack / call', `${(behind / call).toFixed(1)}×`], ['Verdict', behind >= needed * 1.5 ? 'Room to set-mine' : behind >= needed ? 'Thin' : 'Too shallow']]} />
    </div>
  );
}

function Texture() {
  const charts = useCharts();
  const [seed, setSeed] = useState(1);
  const board = useMemo(() => shuffledDeck(createRng(seed * 7919)).slice(0, 3).map(cardToString), [seed]);
  const t = classifyBoard(board.join(''));
  const chart = charts['cash-6max-100bb']!;
  const [adv, setAdv] = useState<number | null>(null);
  useEffect(() => {
    setAdv(null);
    const id = setTimeout(() => setAdv(rangeAdvantage(board.join(''), chart.rfi('BTN')!.ranges.raise!, chart.vsOpen('BB', 'BTN')!.ranges.call!, { iterations: 4000, seed: 3 })), 20);
    return () => clearTimeout(id);
  }, [board, chart]);
  return (
    <div>
      <div className="flex gap-1">
        {board.map((c) => (
          <CardView key={c} card={c} size="sm" dealt />
        ))}
      </div>
      <Readout
        items={[
          ['Texture', t.summary],
          ['Favours (heuristic)', t.favors.replace('-', ' ')],
          ['BTN raiser vs BB caller', adv === null ? '…' : `${pct(adv)} / ${pct(1 - adv)}`],
          ['Straight combos', String(t.straightCombosRanks)],
        ]}
      />
      <GameButton className="mt-2" size="sm" color="gold" onClick={() => setSeed((s) => s + 1)}>
        New flop
      </GameButton>
    </div>
  );
}

function Reading() {
  const charts = useCharts();
  const [seed, setSeed] = useState(3);
  const spot = useMemo(() => generateSpot(createRng(seed), { theme: 'reading', street: 'river', chart: charts['cash-6max-100bb']!, model: REGULAR_MODEL }), [seed, charts]);
  const v = spot.villains[0]!;
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {spot.board.map((c) => (
          <CardView key={c} card={indexToString(c)} size="sm" />
        ))}
      </div>
      <ol className="text-xs font-semibold text-cream/85">
        {spot.history.map((h, i) => (
          <li key={i}>{h.text.replace(/\{(\w\w)\}/g, '$1')}</li>
        ))}
      </ol>
      <div className="grid grid-cols-2 gap-2">
        {spot.rangeTrail.map((t, i) => (
          <div key={i}>
            <div className="text-[11px] font-bold">
              {t.label}: {Math.round(countCombos(t.range) * 10) / 10} combos
            </div>
            <StrategyGrid visual={rangeVisual(t.range, '')} />
          </div>
        ))}
      </div>
      <div className="text-xs font-bold text-cream/75">
        {v.seat}: {classifyRange(v.range, spot.board).length} live hands now
      </div>
      <GameButton size="sm" color="gold" onClick={() => setSeed((s) => s + 1)}>
        New hand
      </GameButton>
    </div>
  );
}

function Archetypes() {
  const [id, setId] = useState<ArchetypeId>('station');
  const m = archetypeModel(id);
  const a = ARCHETYPES[id];
  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {(Object.keys(ARCHETYPES) as ArchetypeId[]).map((k) => (
          <button key={k} type="button" onClick={() => setId(k)} className={`flex min-h-11 items-center gap-1 rounded-lg border-2 border-ink px-1.5 text-xs font-bold ${id === k ? 'bg-gold-500 text-ink' : 'bg-ink/40'}`}>
            <ArchetypeBadge id={k} className="h-6 w-6" /> {ARCHETYPES[k].short}
          </button>
        ))}
      </div>
      <Readout
        items={[
          ['Folds to flop bet', pct(referenceFold(forStreet(m, 'flop')), 0)],
          ['Folds to turn bet', pct(referenceFold(forStreet(m, 'turn')), 0)],
          ['Folds to river bet', pct(referenceFold(forStreet(m, 'river')), 0)],
          ['Bluffing vs balanced', `${m.bluffFactor.toFixed(1)}×`],
        ]}
      />
      <p className="mt-1 text-sm font-bold">{a.exploit}</p>
    </div>
  );
}

function Spr() {
  const [stack, setStack] = useState(36);
  const [pot, setPot] = useState(9);
  const spr = stackToPotRatio(stack, pot);
  return (
    <div>
      <Slider label="Effective stack" value={stack} min={5} max={200} onChange={setStack} format={bbf} />
      <Slider label="Pot on the flop" value={pot} min={2} max={60} onChange={setPot} format={bbf} />
      <Readout
        items={[
          ['SPR', spr.toFixed(1)],
          ['Rule of thumb', spr <= RULES.commitment.committedSpr ? 'Strong hands & draws: get it in' : spr <= RULES.commitment.topPairSpr ? 'Top pair good kicker+ is committed' : 'Deep: one pair is not a stack-off hand'],
        ]}
      />
    </div>
  );
}

function Icm() {
  const [stacks, setStacks] = useState([6000, 3000, 1000]);
  const payouts = [50, 30, 20];
  const eq = icmEquity(stacks, payouts);
  const total = stacks.reduce((a, b) => a + b, 0);
  return (
    <div>
      {stacks.map((s, i) => (
        <Slider key={i} label={`Player ${i + 1} chips`} value={s} min={0} max={10000} step={250} onChange={(v) => setStacks((x) => x.map((y, k) => (k === i ? v : y)))} />
      ))}
      <Readout items={stacks.map((s, i) => [`P${i + 1}: ${pct(total ? s / total : 0, 0)} chips`, `${pct(eq[i]! / 100)} of prizes`] as [string, string])} />
      <div className="mt-1 text-xs font-bold text-cream/70">Payouts 50 / 30 / 20</div>
    </div>
  );
}

function PushFold() {
  const [stack, setStack] = useState(10);
  const [call, setCall] = useState(0.25);
  const [chart, setChart] = useState<Record<string, ShoveResult> | null>(null);
  useEffect(() => {
    setChart(null);
    let live = true;
    const id = setTimeout(() => pushChartInWorker(stack, call).then((c) => live && setChart(c)), 150);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [stack, call]);
  const visual: StrategyVisual | null = chart
    ? { kind: 'strategy', cells: Object.fromEntries(Object.entries(chart).map(([k, v]) => [k, { shove: v.shove ? 1 : 0 }])), actions: [{ id: 'shove', label: 'Shove', color: '#e5383b' }], caption: 'Simplified model, not Nash' }
    : null;
  const share = chart ? Object.entries(chart).reduce((s, [k, v]) => s + (v.shove ? (k.length === 2 ? 6 : k.endsWith('s') ? 4 : 12) : 0), 0) / 1326 : 0;
  return (
    <div>
      <Slider label="SB stack" value={stack} min={3} max={20} onChange={setStack} format={bbf} />
      <Slider label="BB calls with top" value={call} min={0.05} max={0.6} step={0.05} onChange={setCall} format={(v) => pct(v, 0)} />
      {visual ? <StrategyGrid visual={visual} /> : <div className="animate-pulse py-6 text-center text-sm font-bold">Computing 169 hands…</div>}
      {chart && <div className="mt-1 text-sm font-bold">Shove {pct(share, 0)} of hands</div>}
    </div>
  );
}

function Variance() {
  const [wr, setWr] = useState(5);
  const [sd, setSd] = useState(90);
  const [hands, setHands] = useState(10000);
  const [br, setBr] = useState(3000);
  const r = resultRange(wr, sd, hands);
  return (
    <div>
      <Slider label="Win rate (bb/100)" value={wr} min={-5} max={20} onChange={setWr} />
      <Slider label="Std dev (bb/100)" value={sd} min={40} max={150} onChange={setSd} />
      <Slider label="Hands" value={hands} min={1000} max={100000} step={1000} onChange={setHands} format={(v) => v.toLocaleString()} />
      <Slider label="Bankroll" value={br} min={500} max={10000} step={100} onChange={setBr} format={bbf} />
      <Readout
        items={[
          ['Expected', bbf(r.expected)],
          ['95% range', `${Math.round(r.low)} to ${Math.round(r.high)}bb`],
          ['Chance you’re behind', pct(r.losingChance, 0)],
          ['Risk of ruin', pct(riskOfRuin(wr, sd, br))],
        ]}
      />
    </div>
  );
}

function strategyVisualFor(s: ActionRanges, caption: string): StrategyVisual {
  const name: Record<string, string> = { raise: 'Iso-raise', limp: 'Overlimp', '3bet': 'Squeeze', call: 'Call', '5bet': 'All-in' };
  const color: Record<string, string> = { raise: '#e5383b', limp: '#f5b820', '3bet': '#e5383b', call: '#22b35e', '5bet': '#8b4ae8' };
  return {
    kind: 'strategy',
    cells: Object.fromEntries(Object.entries(strategyGrid(s)).map(([k, v]) => [k, v.freq])),
    actions: Object.keys(s.ranges).map((a) => ({ id: a, label: name[a] ?? a, color: color[a] ?? '#2f7fe8' })),
    caption,
  };
}

function Limpers() {
  const charts = useCharts();
  const [id, setId] = useState('home-40bb');
  const chart = charts[id]!;
  const seats = [...new Set(chart.limperSpots().map((x) => x.seat))];
  const [seatPick, setSeat] = useState('BTN');
  const seat = seats.includes(seatPick) ? seatPick : seats[seats.length - 1]!;
  const [limpers, setLimpers] = useState(1);
  const max = Math.min(3, chart.seatsBefore(seat));
  const n = Math.min(limpers, max);
  const spot = chart.vsLimpers(seat, n)!;
  const mode = id.startsWith('home') ? 'home' : 'casino';
  const iso = isoSize(mode, seat, n);
  return (
    <div className="space-y-2">
      <ChipGroup options={Object.values(charts).map((c) => ({ value: c.id, label: c.name.split(',')[0]! }))} value={[id]} onChange={(v) => setId(v[0]!)} />
      <ChipGroup options={seats.map((x) => ({ value: x, label: x }))} value={[seat]} onChange={(v) => setSeat(v[0]!)} />
      <Slider label="Limpers" value={n} min={1} max={Math.max(1, max)} onChange={setLimpers} format={(v) => (v >= 3 ? '3+' : String(v))} />
      <StrategyGrid visual={strategyVisualFor(spot, `${chart.name} · ${seat} vs ${n >= 3 ? '3+' : n} limper${n === 1 ? '' : 's'} (approximation)`)} />
      <Readout
        items={[
          ['Iso-raise', pct(rangeFraction(spot.ranges.raise!), 0)],
          [seat === 'SB' ? 'Complete' : seat === 'BB' ? 'Check' : 'Overlimp', seat === 'BB' ? pct(1 - rangeFraction(spot.ranges.raise!), 0) : pct(rangeFraction(spot.ranges.limp!), 0)],
          ['Iso size', bbf(iso.best)],
        ]}
      />
      <div className="text-xs font-bold text-cream/80">{iso.reason}</div>
    </div>
  );
}

function Squeeze() {
  const charts = useCharts();
  const [id, setId] = useState('home-40bb');
  const chart = charts[id]!;
  const spots = chart.squeezeSpots();
  const seats = [...new Set(spots.map((x) => x.seat))];
  const [seatPick, setSeat] = useState('BTN');
  const seat = seats.includes(seatPick) ? seatPick : seats[0]!;
  const [callers, setCallers] = useState(1);
  const c = chart.squeeze(seat, callers) ? callers : 1;
  const spot = chart.squeeze(seat, c)!;
  const [open, setOpen] = useState(id.startsWith('home') ? 4 : 2.5);
  const size = squeezeSize(open, c, seat !== 'SB' && seat !== 'BB');
  return (
    <div className="space-y-2">
      <ChipGroup options={Object.values(charts).map((x) => ({ value: x.id, label: x.name.split(',')[0]! }))} value={[id]} onChange={(v) => setId(v[0]!)} />
      <ChipGroup options={seats.map((x) => ({ value: x, label: x }))} value={[seat]} onChange={(v) => setSeat(v[0]!)} />
      <Slider label="Callers" value={c} min={1} max={2} onChange={setCallers} format={(v) => (v >= 2 ? '2+' : '1')} />
      <Slider label="Open size" value={open} min={2} max={6} step={0.5} onChange={setOpen} format={bbf} />
      <StrategyGrid visual={strategyVisualFor(spot, `${chart.name} · ${seat} squeeze vs ${c >= 2 ? '2+' : 1} caller${c === 1 ? '' : 's'} (approximation)`)} />
      <Readout items={[['Squeeze', pct(rangeFraction(spot.ranges['3bet']!), 1)], ['Call', pct(rangeFraction(spot.ranges.call!), 0)], ['Squeeze size', bbf(size.best)]]} />
      <div className="text-xs font-bold text-cream/80">{size.reason}</div>
    </div>
  );
}

function Straddle() {
  const charts = useCharts();
  const [id, setId] = useState('home-40bb');
  const chart = charts[id]!;
  const [stack, setStack] = useState(chart.json.stackBb);
  const v = straddleView(chart.seats, stack);
  return (
    <div className="space-y-2">
      <ChipGroup options={Object.values(charts).map((x) => ({ value: x.id, label: x.name.split(',')[0]! }))} value={[id]} onChange={(val) => setId(val[0]!)} />
      <Slider label="Stacks" value={stack} min={20} max={200} step={5} onChange={setStack} format={bbf} />
      <Readout items={[['Stacks in straddles', `${v.effectiveStack.toFixed(1)}`], ['First to act', v.preflopOrder[0]!], ['Acts last preflop', `${v.preflopOrder[v.preflopOrder.length - 1]!} (straddler)`]]} />
      <div className="grid grid-cols-3 gap-1 text-center text-xs font-bold">
        {v.preflopOrder.map((seatName) => (
          <div key={seatName} className="rounded-lg border-2 border-ink bg-ink/40 px-1 py-1">
            <div className="font-display text-sm text-gold-300">{seatName}</div>
            <div>plays like {v.seatMap[seatName]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const EXAMPLES: Record<ExampleId, () => ReactElement> = {
  limpers: Limpers,
  squeeze: Squeeze,
  straddle: Straddle,
  'hand-rankings': HandRankings,
  positions: Positions,
  'min-raise': MinRaise,
  outs: Outs,
  'pot-odds': PotOdds,
  implied: Implied,
  equity: Equity,
  ev: Ev,
  combos: Combos,
  'range-chart': RangeChart,
  'sizing-price': SizingPrice,
  'set-mining': SetMining,
  texture: Texture,
  reading: Reading,
  archetypes: Archetypes,
  spr: Spr,
  icm: Icm,
  'push-fold': PushFold,
  variance: Variance,
};

export function LessonExample({ id }: { id: ExampleId }) {
  const C = EXAMPLES[id];
  return (
    <div className="rounded-2xl border-[3px] border-ink bg-gradient-to-b from-[#3a2d5c] to-[#241a3d] p-3 text-cream shadow-chunky-sm">
      <div className="mb-1.5 flex items-center gap-1.5 font-display text-sm text-gold-300">
        <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-ink bg-gold-500 text-[11px] text-ink">▶</span> Try it
      </div>
      <C />
    </div>
  );
}


import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { replayAmounts, type LogActionType, type LogStreet, type LoggedAction, type LoggedHand } from '../../engine';
import { useHandLog } from '../../state/handLogStore';
import { useProfiles } from '../../state/profilesStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { CardPicker, ChipGroup, GameButton, MiniCard, Panel } from '../../components/ui';

const SEATS = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const POSTFLOP = ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN'];
const STREETS: LogStreet[] = ['preflop', 'flop', 'turn', 'river'];
const BOARD_NEEDED: Record<LogStreet, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };

type Step = 'cards' | 'setup' | 'actions' | 'done';

export function HandLoggerScreen() {
  const navigate = useNavigate();
  const last = useHandLog((s) => s.lastSetup);
  const setLast = useHandLog((s) => s.setLastSetup);
  const addHand = useHandLog((s) => s.addHand);
  const profiles = useProfiles((s) => s.profiles);
  const [step, setStep] = useState<Step>('cards');
  const [hero, setHero] = useState<string[]>([]);
  const [board, setBoard] = useState<string[]>([]);
  const [heroSeat, setHeroSeat] = useState(last.heroSeat);
  const [villainSeat, setVillainSeat] = useState(last.heroSeat === 'BB' ? 'BTN' : 'BB');
  const [profileId, setProfileId] = useState<string>('none');
  const [stackBb, setStackBb] = useState(last.stackBb);
  const [bigBlind, setBigBlind] = useState(last.bigBlind);
  const [actions, setActions] = useState<LoggedAction[]>([]);
  const [sizing, setSizing] = useState<LogActionType | null>(null);
  const [custom, setCustom] = useState('');
  const [notes, setNotes] = useState('');
  const [started] = useState(() => Date.now());

  // Derive where we are in the hand.
  const replay = useMemo(
    () => replayAmounts({ id: '', date: '', heroCards: hero, board, heroSeat, villainSeat, stackBb, bigBlind, actions, notes: '' }),
    [hero, board, heroSeat, villainSeat, stackBb, bigBlind, actions],
  );
  const lastAct = actions[actions.length - 1];
  const handOver = lastAct?.type === 'fold' || (lastAct?.street === 'river' && streetClosed('river'));
  function streetClosed(st: LogStreet): boolean {
    const acts = replay.actions.filter((a) => a.street === st);
    if (!acts.length) return false;
    const la = acts[acts.length - 1]!;
    if (la.type === 'fold') return true;
    const heroIn = acts.filter((a) => a.actor === 'hero').reduce((s, a) => s + a.added, 0) + (st === 'preflop' ? (heroSeat === 'SB' ? 0.5 : heroSeat === 'BB' ? 1 : 0) : 0);
    const vilIn = acts.filter((a) => a.actor === 'villain').reduce((s, a) => s + a.added, 0) + (st === 'preflop' ? (villainSeat === 'SB' ? 0.5 : villainSeat === 'BB' ? 1 : 0) : 0);
    const bothActed = acts.some((a) => a.actor === 'hero') && acts.some((a) => a.actor === 'villain');
    return (la.type === 'call' || la.type === 'check') && bothActed && Math.abs(heroIn - vilIn) < 0.01;
  }
  const street: LogStreet = (() => {
    let st: LogStreet = 'preflop';
    for (const s of STREETS) {
      st = s;
      if (!streetClosed(s)) break;
    }
    return st;
  })();
  const streetActs = actions.filter((a) => a.street === street);
  const firstActor: 'hero' | 'villain' =
    street === 'preflop'
      ? SEATS.indexOf(heroSeat) < SEATS.indexOf(villainSeat)
        ? 'hero'
        : 'villain'
      : POSTFLOP.indexOf(heroSeat) < POSTFLOP.indexOf(villainSeat)
        ? 'hero'
        : 'villain';
  const actor: 'hero' | 'villain' = streetActs.length ? (streetActs[streetActs.length - 1]!.actor === 'hero' ? 'villain' : 'hero') : firstActor;
  const needBoard = board.length < BOARD_NEEDED[street];
  const pot = replay.finalPot;
  const toCall = (() => {
    const acts = replay.actions.filter((a) => a.street === street);
    const mine = acts.filter((a) => a.actor === actor).reduce((s, a) => s + a.added, 0) + (street === 'preflop' ? (actor === 'hero' ? heroSeat : villainSeat) === 'SB' ? 0.5 : (actor === 'hero' ? heroSeat : villainSeat) === 'BB' ? 1 : 0 : 0);
    const theirs = acts.filter((a) => a.actor !== actor).reduce((s, a) => s + a.added, 0) + (street === 'preflop' ? (actor === 'hero' ? villainSeat : heroSeat) === 'SB' ? 0.5 : (actor === 'hero' ? villainSeat : heroSeat) === 'BB' ? 1 : 0 : 0);
    return Math.max(0, theirs - mine);
  })();
  const currentBet = replay.actions.filter((a) => a.street === street).reduce((m, a) => Math.max(m, a.resolvedTo), street === 'preflop' ? 1 : 0);

  const push = (type: LogActionType, amount: number | null = null) => {
    setActions((a) => [...a, { street, actor, type, amount }]);
    setSizing(null);
    setCustom('');
  };

  const save = () => {
    const h: LoggedHand = {
      id: `h-${Date.now().toString(36)}`,
      date: new Date().toISOString(),
      heroCards: hero,
      board,
      heroSeat,
      villainSeat,
      villainProfileId: profileId === 'none' ? undefined : profileId,
      stackBb,
      bigBlind,
      actions,
      notes,
    };
    addHand(h);
    setLast({ heroSeat, stackBb, bigBlind, location: stackBb <= 60 ? 'home' : 'casino' });
    navigate(`/review/hand/${h.id}`, { replace: true });
  };

  const who = (a: 'hero' | 'villain') => (a === 'hero' ? 'You' : profiles.find((p) => p.id === profileId)?.name ?? `Villain (${villainSeat})`);
  const quickSizes: { label: string; to: number | null }[] =
    street === 'preflop'
      ? currentBet <= 1
        ? [2.5, 3, 4, 5].map((x) => ({ label: `${x}bb`, to: x }))
        : [3, 4].map((m) => ({ label: `${m}x (${currentBet * m}bb)`, to: currentBet * m }))
      : currentBet === 0
        ? [1 / 3, 1 / 2, 2 / 3, 1].map((f) => ({ label: f === 1 ? 'Pot' : f === 0.5 ? '1/2' : f < 0.4 ? '1/3' : '2/3', to: Math.round(pot * f * 2) / 2 }))
        : [2.5, 3, 4].map((m) => ({ label: `${m}x`, to: Math.round(currentBet * m * 2) / 2 }));

  return (
    <div className="space-y-3">
      <ScreenHeader
        title="Log a hand"
        subtitle={step === 'actions' ? `${Math.round((Date.now() - started) / 1000)}s · amounts in big blinds` : 'Under a minute'}
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate('/review')}>
            Cancel
          </GameButton>
        }
      />

      {step === 'cards' && (
        <Panel tone="night" title="Your cards">
          <CardPicker
            value={hero}
            max={2}
            onChange={(c) => {
              setHero(c);
              if (c.length === 2) setStep('setup');
            }}
          />
        </Panel>
      )}

      {step === 'setup' && (
        <Panel tone="cream">
          <div className="space-y-3 text-ink">
            <div className="flex items-center gap-1 font-display">
              You hold {hero.map((c) => <MiniCard key={c} code={c} />)}
              <button type="button" className="ml-auto min-h-11 rounded-lg px-2 text-sm font-bold underline" onClick={() => setStep('cards')}>
                change
              </button>
            </div>
            <ChipGroup label="Your seat" options={SEATS.map((s) => ({ value: s, label: s }))} value={[heroSeat]} onChange={(v) => setHeroSeat(v[0]!)} />
            <ChipGroup label="Villain's seat" options={SEATS.filter((s) => s !== heroSeat).map((s) => ({ value: s, label: s }))} value={[villainSeat]} onChange={(v) => setVillainSeat(v[0]!)} />
            <ChipGroup
              label="Opponent"
              options={[{ value: 'none', label: 'Unknown' }, ...profiles.map((p) => ({ value: p.id, label: p.name }))]}
              value={[profileId]}
              onChange={(v) => setProfileId(v[0]!)}
            />
            <ChipGroup
              label="Effective stack"
              options={[20, 40, 60, 100, 150].map((x) => ({ value: String(x), label: `${x}bb` }))}
              value={[String(stackBb)]}
              onChange={(v) => setStackBb(Number(v[0]))}
            />
            <ChipGroup
              label="Big blind"
              options={[0.25, 0.5, 1, 2, 5].map((x) => ({ value: String(x), label: `$${x}` }))}
              value={[String(bigBlind)]}
              onChange={(v) => setBigBlind(Number(v[0]))}
            />
            <GameButton color="gold" fullWidth onClick={() => setStep('actions')}>
              Next: the action
            </GameButton>
          </div>
        </Panel>
      )}

      {step === 'actions' && (
        <>
          <Panel tone="night" className="!py-2">
            <div className="flex flex-wrap items-center gap-1 text-sm font-bold">
              {hero.map((c) => (
                <MiniCard key={c} code={c} />
              ))}
              <span className="mx-1 text-cream/40">|</span>
              {board.map((c) => (
                <MiniCard key={c} code={c} />
              ))}
              <span className="ml-auto font-display text-gold-300">Pot {Math.round(pot * 10) / 10}bb</span>
            </div>
            <ol className="mt-1 space-y-0.5 text-xs font-semibold text-cream/85">
              {replay.actions.map((a, i) => (
                <li key={i}>
                  {a.street}: {who(a.actor)} {a.type}
                  {a.type === 'bet' || a.type === 'raise' ? ` ${a.resolvedTo}bb${a.estimated ? ' (?)' : ''}` : a.type === 'call' ? ` ${a.added}bb` : ''}
                </li>
              ))}
            </ol>
          </Panel>

          {handOver ? (
            <Panel tone="cream">
              <p className="font-bold text-ink">Hand complete.</p>
            </Panel>
          ) : needBoard ? (
            <Panel tone="night" title={`${street[0]!.toUpperCase() + street.slice(1)} card${street === 'flop' ? 's' : ''}`}>
              <CardPicker value={board} max={BOARD_NEEDED[street]} disabled={hero} onChange={setBoard} />
              <p className="mt-1 text-xs font-semibold text-cream/70">Tap the {street} {street === 'flop' ? '3 cards' : 'card'} (or tap Save if the hand ended here).</p>
            </Panel>
          ) : (
            <Panel tone="cream" title={`${who(actor)} — ${street}`}>
              {sizing ? (
                <div className="space-y-2 text-ink">
                  <div className="grid grid-cols-3 gap-1.5">
                    {quickSizes.map((q) => (
                      <GameButton key={q.label} size="sm" color="cream" onClick={() => push(sizing, q.to)}>
                        {q.label}
                      </GameButton>
                    ))}
                    <GameButton size="sm" color="purple" onClick={() => push(sizing, null)}>
                      ? Don’t know
                    </GameButton>
                  </div>
                  <div className="flex gap-2">
                    <input
                      inputMode="decimal"
                      placeholder="Other (bb)"
                      value={custom}
                      onChange={(e) => setCustom(e.target.value)}
                      className="min-h-11 flex-1 select-text rounded-xl border-[3px] border-ink bg-white px-3 font-display"
                    />
                    <GameButton size="sm" color="gold" disabled={!(Number(custom) > 0)} onClick={() => push(sizing, Number(custom))}>
                      OK
                    </GameButton>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <GameButton color="red" size="sm" disabled={toCall === 0} onClick={() => push('fold')}>
                    Fold
                  </GameButton>
                  <GameButton color="blue" size="sm" onClick={() => push(toCall > 0 ? 'call' : 'check')}>
                    {toCall > 0 ? `Call ${Math.round(toCall * 10) / 10}` : 'Check'}
                  </GameButton>
                  <GameButton color="gold" size="sm" onClick={() => setSizing(street === 'preflop' || currentBet > 0 ? 'raise' : 'bet')}>
                    {street === 'preflop' || currentBet > 0 ? 'Raise' : 'Bet'}
                  </GameButton>
                </div>
              )}
            </Panel>
          )}
          <div className="grid grid-cols-2 gap-2">
            <GameButton color="cream" size="sm" disabled={!actions.length} onClick={() => setActions((a) => a.slice(0, -1))}>
              Undo
            </GameButton>
            <GameButton color="green" size="sm" disabled={!actions.length} onClick={() => setStep('done')}>
              Save hand
            </GameButton>
          </div>
        </>
      )}

      {step === 'done' && (
        <Panel tone="cream" title="Anything else?">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes (optional): tells, table talk…"
            className="w-full select-text rounded-xl border-2 border-ink bg-white p-2 text-base text-ink"
          />
          <GameButton className="mt-2" color="gold" fullWidth onClick={save}>
            Save and analyse
          </GameButton>
        </Panel>
      )}
    </div>
  );
}

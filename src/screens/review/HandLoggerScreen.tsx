import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HERO_ID, LOG_STRADDLE_BB, replayAmounts, type LogActionType, type LogStreet, type LoggedAction, type LoggedHand, type LoggedPlayer } from '../../engine';
import { useHandLog } from '../../state/handLogStore';
import { useProfiles } from '../../state/profilesStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SeatTable, type SeatInfo } from '../../components/review/SeatTable';
import { CardPicker, ChipGroup, GameButton, MiniCard, Panel, Toggle } from '../../components/ui';

const STREET_NAME: Record<LogStreet, string> = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' };

type Step = 'cards' | 'table' | 'actions' | 'shown' | 'done';

/** Pre-filled table (e.g. from a live-session bookmark). */
export interface LoggerPrefill {
  players: LoggedPlayer[];
  stackBb?: number;
  bigBlind?: number;
  straddle?: boolean;
  liveSessionId?: string;
  notes?: string;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export function HandLoggerScreen() {
  const navigate = useNavigate();
  const prefill = (useLocation().state as { prefill?: LoggerPrefill } | null)?.prefill;
  const last = useHandLog((s) => s.lastSetup);
  const setLast = useHandLog((s) => s.setLastSetup);
  const addHand = useHandLog((s) => s.addHand);
  const savedHands = useHandLog((s) => s.hands);
  const profiles = useProfiles((s) => s.profiles);
  const [step, setStep] = useState<Step>('cards');
  const [hero, setHero] = useState<string[]>([]);
  const [board, setBoard] = useState<string[]>([]);
  const [players, setPlayers] = useState<LoggedPlayer[]>(() => prefill?.players ?? [{ id: HERO_ID, seat: last.heroSeat, hero: true }]);
  const [selected, setSelected] = useState<string | null>(null);
  const [stackBb, setStackBb] = useState(prefill?.stackBb ?? last.stackBb);
  const [bigBlind, setBigBlind] = useState(prefill?.bigBlind ?? last.bigBlind);
  const [straddle, setStraddle] = useState(prefill?.straddle ?? last.straddle ?? false);
  const [limpers, setLimpers] = useState(0);
  const [actions, setActions] = useState<LoggedAction[]>([]);
  const [sizing, setSizing] = useState<'bet' | 'raise' | null>(null);
  const [custom, setCustom] = useState('');
  const [notes, setNotes] = useState(prefill?.notes ?? '');
  const [showFor, setShowFor] = useState<string | null>(null);
  const [started] = useState(() => Date.now());

  // Regulars first: the profiles you tag most often.
  const regulars = useMemo(() => {
    const counts = new Map<string, number>();
    for (const h of savedHands) for (const p of (h as LoggedHand).players ?? []) if (p.profileId) counts.set(p.profileId, (counts.get(p.profileId) ?? 0) + 1);
    return [...profiles].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  }, [profiles, savedHands]);

  const heroP = players.find((p) => p.hero)!;
  const nameOf = (p: LoggedPlayer) => (p.hero ? 'You' : profiles.find((x) => x.id === p.profileId)?.name ?? p.name ?? p.seat);
  const draft: LoggedHand = useMemo(
    () => ({ version: 2, id: '', date: '', heroCards: hero, board, players, stackBb, bigBlind, straddle, limpers: limpers || undefined, actions, notes: '' }),
    [hero, board, players, stackBb, bigBlind, straddle, limpers, actions],
  );
  const replay = useMemo(() => replayAmounts(draft), [draft]);
  const next = replay.next;
  const needBoard = next ? next.street !== 'preflop' && board.length < replay.needsBoard : false;
  const nextPlayer = next ? players.find((p) => p.id === next.actor) : undefined;

  const tapSeat = (seat: string) => {
    if (step !== 'table') return;
    const existing = players.find((p) => p.seat === seat);
    if (existing) {
      setSelected(existing.hero ? null : existing.id);
      return;
    }
    const id = `p-${seat}`;
    setPlayers((ps) => [...ps, { id, seat }]);
    setSelected(id);
  };
  const moveHero = (seat: string) => setPlayers((ps) => ps.filter((p) => p.hero || p.seat !== seat).map((p) => (p.hero ? { ...p, seat } : p)));
  const updatePlayer = (id: string, patch: Partial<LoggedPlayer>) => setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const push = (type: LogActionType, amount: number | null = null) => {
    if (!next) return;
    setActions((a) => [...a, { street: next.street, actor: next.actor, type, amount }]);
    setSizing(null);
    setCustom('');
  };

  const save = () => {
    const h: LoggedHand = {
      ...draft,
      id: `h-${Date.now().toString(36)}`,
      date: new Date().toISOString(),
      notes: notes.trim(),
      liveSessionId: prefill?.liveSessionId,
    };
    addHand(h);
    setLast({ heroSeat: heroP.seat, stackBb, bigBlind, location: stackBb <= 60 ? 'home' : 'casino', straddle });
    navigate(`/review/hand/${h.id}`, { replace: true });
  };

  const seatInfo: Record<string, SeatInfo> = Object.fromEntries(
    players.map((p) => [
      p.seat,
      { label: p.hero || p.profileId || p.name ? nameOf(p) : 'Player', hero: p.hero, folded: replay.folded.includes(p.id), badge: p.shownCards?.length === 2 ? 'showed' : replay.allIn.includes(p.id) ? 'all-in' : undefined },
    ]),
  );
  const selectedP = players.find((p) => p.id === selected);
  const timeline = (['preflop', 'flop', 'turn', 'river'] as LogStreet[])
    .map((st) => ({ st, acts: replay.actions.filter((a) => a.street === st) }))
    .filter((x) => x.acts.length);

  return (
    <div className="space-y-3">
      <ScreenHeader
        title="Log a hand"
        subtitle={step === 'actions' ? `${Math.round((Date.now() - started) / 1000)}s · amounts in big blinds` : 'About a minute, any number of players'}
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
              if (c.length === 2) setStep('table');
            }}
          />
        </Panel>
      )}

      {step === 'table' && (
        <>
          <Panel tone="night" className="!px-2">
            <SeatTable seats={seatInfo} onTap={tapSeat} caption="Tap every player who was in the hand" />
            <p className="px-2 text-center text-xs font-bold text-cream/80">
              You are in the gold seat. Tap a seat to add a player; tap a player to tag them. Players who folded without putting chips in can be skipped.
            </p>
          </Panel>
          {selectedP && (
            <Panel tone="cream" title={`${selectedP.seat} player`}>
              <div className="space-y-2 text-ink">
                <ChipGroup
                  label="Who is it?"
                  options={[{ value: 'none', label: 'Unknown' }, ...regulars.slice(0, 12).map((p) => ({ value: p.id, label: p.name }))]}
                  value={[selectedP.profileId ?? 'none']}
                  onChange={(v) => updatePlayer(selectedP.id, { profileId: v[0] === 'none' ? undefined : v[0] })}
                />
                <ChipGroup
                  label="Their stack (if different)"
                  options={[{ value: 'eff', label: 'Same' }, ...[10, 20, 40, 60, 100].map((x) => ({ value: String(x), label: `${x}bb` }))]}
                  value={[selectedP.stackBb ? String(selectedP.stackBb) : 'eff']}
                  onChange={(v) => updatePlayer(selectedP.id, { stackBb: v[0] === 'eff' ? undefined : Number(v[0]) })}
                />
                <GameButton
                  size="sm"
                  color="red"
                  onClick={() => {
                    setPlayers((ps) => ps.filter((p) => p.id !== selectedP.id));
                    setSelected(null);
                  }}
                >
                  Remove from hand
                </GameButton>
              </div>
            </Panel>
          )}
          <Panel tone="cream">
            <div className="space-y-3 text-ink">
              <ChipGroup
                label="Your seat"
                options={['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'].map((s) => ({ value: s, label: s }))}
                value={[heroP.seat]}
                onChange={(v) => moveHero(v[0]!)}
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
              <ChipGroup
                label="Other limpers before the action (not added as players)"
                options={[0, 1, 2, 3].map((x) => ({ value: String(x), label: x === 3 ? '3+' : String(x) }))}
                value={[String(limpers)]}
                onChange={(v) => setLimpers(Number(v[0]))}
              />
              <Toggle label={`UTG straddle (${LOG_STRADDLE_BB}bb)`} on={straddle} onChange={setStraddle} />
              <GameButton color="gold" fullWidth disabled={players.length < 2} onClick={() => setStep('actions')}>
                {players.length < 2 ? 'Add at least one opponent' : `Next: the action (${players.length} players)`}
              </GameButton>
            </div>
          </Panel>
        </>
      )}

      {step === 'actions' && (
        <>
          <Panel tone="night" className="!px-2 !py-2">
            <SeatTable seats={seatInfo} active={needBoard ? null : nextPlayer?.seat} caption={`Pot ${r1(replay.finalPot)}bb`} />
            <div className="flex flex-wrap items-center justify-center gap-1 text-sm font-bold">
              {hero.map((c) => (
                <MiniCard key={c} code={c} />
              ))}
              <span className="mx-1 text-cream/40">|</span>
              {board.length ? board.map((c) => <MiniCard key={c} code={c} />) : <span className="text-xs text-cream/60">no board yet</span>}
            </div>
          </Panel>

          {!next ? (
            <Panel tone="cream">
              <p className="font-bold text-ink">
                Betting is over{replay.folded.length === players.length - 1 ? ' — everyone else folded' : ''}. Add the rest of the board if you know it, then save.
              </p>
              {board.length < 5 && replay.folded.length < players.length - 1 && (
                <div className="mt-2">
                  <CardPicker value={board} max={5} disabled={hero} onChange={setBoard} />
                </div>
              )}
            </Panel>
          ) : needBoard ? (
            <Panel tone="night" title={`${STREET_NAME[next.street]} card${next.street === 'flop' ? 's' : ''}`}>
              <CardPicker value={board} max={replay.needsBoard} disabled={hero} onChange={setBoard} />
              <p className="mt-1 text-xs font-semibold text-cream/70">Tap the {next.street === 'flop' ? '3 flop cards' : `${next.street} card`}.</p>
            </Panel>
          ) : (
            <Panel tone={nextPlayer?.hero ? 'wood' : 'cream'} title={`${nextPlayer ? nameOf(nextPlayer) : ''} (${nextPlayer?.seat}) — ${STREET_NAME[next.street]}`}>
              {sizing ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {next.quickSizes.map((q) => (
                      <GameButton key={q} size="sm" color="cream" onClick={() => push(sizing, q)}>
                        {q >= next.maxTo ? `All-in ${r1(q)}` : `${r1(q)}bb`}
                      </GameButton>
                    ))}
                    <GameButton size="sm" color="purple" onClick={() => push(sizing, null)}>
                      I don’t remember
                    </GameButton>
                  </div>
                  <div className="flex gap-2">
                    <input
                      inputMode="decimal"
                      placeholder={`Other (${r1(next.minTo)}–${r1(next.maxTo)}bb)`}
                      value={custom}
                      onChange={(e) => setCustom(e.target.value)}
                      className="min-h-11 flex-1 select-text rounded-xl border-[3px] border-ink bg-white px-3 font-display text-ink"
                    />
                    <GameButton size="sm" color="gold" disabled={!(Number(custom) > 0)} onClick={() => push(sizing, Math.min(next.maxTo, Number(custom)))}>
                      OK
                    </GameButton>
                  </div>
                  <GameButton size="sm" color="cream" fullWidth onClick={() => setSizing(null)}>
                    Back
                  </GameButton>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <GameButton color="red" size="sm" disabled={next.canCheck} onClick={() => push('fold')}>
                    Fold
                  </GameButton>
                  <GameButton color="blue" size="sm" onClick={() => push(next.canCheck ? 'check' : 'call')}>
                    {next.canCheck ? 'Check' : `Call ${r1(next.toCall)}`}
                  </GameButton>
                  <GameButton color="gold" size="sm" disabled={!next.canRaise} onClick={() => setSizing(next.canCheck && next.street !== 'preflop' ? 'bet' : 'raise')}>
                    {next.canCheck && next.street !== 'preflop' ? 'Bet' : 'Raise'}
                  </GameButton>
                </div>
              )}
            </Panel>
          )}

          {timeline.length > 0 && (
            <Panel tone="night" className="!py-2">
              <ol className="space-y-1 text-xs font-semibold text-cream/90">
                {timeline.map(({ st, acts }) => (
                  <li key={st}>
                    <span className="font-display text-gold-300">{STREET_NAME[st]}: </span>
                    {acts
                      .map((a) => {
                        const p = players.find((x) => x.id === a.actor)!;
                        const amt = a.type === 'bet' || a.type === 'raise' ? ` ${r1(a.resolvedTo)}${a.estimated ? '?' : ''}` : a.type === 'call' ? ` ${r1(a.added)}` : '';
                        return `${nameOf(p)} ${a.type}${amt}${a.allIn ? ' (all-in)' : ''}`;
                      })
                      .join(' · ')}
                  </li>
                ))}
              </ol>
              {replay.allIn.length > 0 && replay.pots.length > 1 && (
                <p className="mt-1 text-xs font-bold text-gold-300">
                  Pots: {replay.pots.map((p, i) => `${i === 0 ? 'main' : `side ${i}`} ${r1(p.amount)}bb`).join(' · ')}
                </p>
              )}
            </Panel>
          )}

          <div className="grid grid-cols-2 gap-2">
            <GameButton color="cream" size="sm" disabled={!actions.length} onClick={() => setActions((a) => a.slice(0, -1))}>
              Undo
            </GameButton>
            <GameButton color="green" size="sm" disabled={!actions.length} onClick={() => setStep('shown')}>
              {next ? 'End here' : 'Next'}
            </GameButton>
          </div>
        </>
      )}

      {step === 'shown' && (
        <Panel tone="cream" title="Did anyone show?">
          <div className="space-y-2 text-ink">
            <p className="text-sm font-bold">Optional. Shown cards add a “what they actually had” view; the grade stays about your decision.</p>
            <div className="flex flex-wrap gap-2">
              {players
                .filter((p) => !p.hero)
                .map((p) => (
                  <GameButton key={p.id} size="sm" color={showFor === p.id ? 'gold' : 'cream'} onClick={() => setShowFor(showFor === p.id ? null : p.id)}>
                    {nameOf(p)} {p.shownCards?.length === 2 ? p.shownCards.join('') : ''}
                  </GameButton>
                ))}
            </div>
            {showFor && (
              <CardPicker
                value={players.find((p) => p.id === showFor)?.shownCards ?? []}
                max={2}
                disabled={[...hero, ...board, ...players.filter((p) => p.id !== showFor).flatMap((p) => p.shownCards ?? [])]}
                onChange={(c) => updatePlayer(showFor, { shownCards: c })}
              />
            )}
            <GameButton color="gold" fullWidth onClick={() => setStep('done')}>
              Next
            </GameButton>
          </div>
        </Panel>
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

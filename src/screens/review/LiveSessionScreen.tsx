import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ARCHETYPES,
  LIVE_EVENT_LABELS,
  applySession,
  computeObservedStats,
  formatPercent,
  handsFor,
  liveRead,
  newProfile,
  topExploits,
  type LiveEventType,
  type LiveSession,
  type LoggedPlayer,
  type ObservedStats,
  type PlayerStats,
  type Profile,
  type RealSession,
} from '../../engine';
import { useLive } from '../../state/liveStore';
import { useProfiles } from '../../state/profilesStore';
import { useHandLog } from '../../state/handLogStore';
import { toast } from '../../state/toastStore';
import { useWakeLock } from '../../lib/wakeLock';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SeatTable, type SeatInfo } from '../../components/review/SeatTable';
import { ChipGroup, GameButton, Panel } from '../../components/ui';
import type { LoggerPrefill } from './HandLoggerScreen';

const SEATS = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const PRE: LiveEventType[] = ['vpip', 'pfr', 'limp', 'threebet'];
const POST: LiveEventType[] = ['foldCbet', 'callCbet', 'raiseCbet', 'foldTurn', 'callTurn', 'foldRiver', 'callRiver', 'showdown', 'showedBluff', 'showedMonster'];
const STAT_NAMES: Partial<Record<keyof PlayerStats, string>> = {
  vpip: 'VPIP',
  pfr: 'PFR',
  aggression: 'Aggression',
  foldToCbet: 'Fold to c-bet',
  foldToTurnBet: 'Fold to turn bet',
  foldToRiverBet: 'Fold to river bet',
  wtsd: 'Went to showdown',
};
const statText = (k: keyof PlayerStats, v: number) => (k === 'aggression' ? v.toFixed(1) : formatPercent(v, 0));

/** Discreet, one-tap-per-read live table tracker. */
export function LiveSessionScreen() {
  const active = useLive((s) => s.active);
  if (!active) return <LiveSetup />;
  if (active.endedAt) return <LiveReview session={active} />;
  return <LiveTracker session={active} />;
}

function LiveSetup() {
  const navigate = useNavigate();
  const start = useLive((s) => s.start);
  const profiles = useProfiles((s) => s.profiles);
  const last = useHandLog((s) => s.lastSetup);
  const [venue, setVenue] = useState<'home' | 'casino'>(last.location);
  const [bigBlind, setBigBlind] = useState(last.bigBlind);
  const [buyIn, setBuyIn] = useState(20);
  const [heroSeat, setHeroSeat] = useState(last.heroSeat);
  const [players, setPlayers] = useState<{ id: string; seat: string; name: string; profileId?: string }[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const seats: Record<string, SeatInfo> = { [heroSeat]: { label: 'You', hero: true } };
  for (const p of players) seats[p.seat] = { label: p.name };
  const tap = (seat: string) => {
    if (seat === heroSeat) return;
    setEditing(seat);
    setTyped('');
  };
  const assign = (seat: string, name: string, profileId?: string) => {
    setPlayers((ps) => [...ps.filter((p) => p.seat !== seat), { id: `lp-${seat}-${Date.now().toString(36)}`, seat, name, profileId }]);
    setEditing(null);
  };
  return (
    <div className="space-y-3">
      <ScreenHeader
        title="Live session"
        subtitle="Set up in 30 seconds"
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate('/review')}>
            Back
          </GameButton>
        }
      />
      <Panel tone="night" className="!px-2">
        <SeatTable seats={seats} onTap={tap} caption="Tap a seat to add a player" />
      </Panel>
      {editing && (
        <Panel tone="cream" title={`${editing} is…`}>
          <div className="space-y-2 text-ink">
            <div className="flex flex-wrap gap-1.5">
              {profiles.map((p) => (
                <GameButton key={p.id} size="sm" color="cream" onClick={() => assign(editing, p.name, p.id)}>
                  {p.name}
                </GameButton>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="New player’s name"
                className="min-h-11 flex-1 select-text rounded-xl border-[3px] border-ink bg-white px-3 font-display text-ink"
              />
              <GameButton size="sm" color="gold" disabled={!typed.trim()} onClick={() => assign(editing, typed.trim())}>
                Add
              </GameButton>
            </div>
            {players.some((p) => p.seat === editing) && (
              <GameButton
                size="sm"
                color="red"
                onClick={() => {
                  setPlayers((ps) => ps.filter((p) => p.seat !== editing));
                  setEditing(null);
                }}
              >
                Empty seat
              </GameButton>
            )}
          </div>
        </Panel>
      )}
      <Panel tone="cream">
        <div className="space-y-2 text-ink">
          <ChipGroup label="Your seat" options={SEATS.map((s) => ({ value: s, label: s }))} value={[heroSeat]} onChange={(v) => setHeroSeat(v[0]!)} />
          <ChipGroup
            label="Game"
            options={[
              { value: 'home', label: 'Home game' },
              { value: 'casino', label: 'Casino' },
            ]}
            value={[venue]}
            onChange={(v) => setVenue(v[0] as 'home' | 'casino')}
          />
          <ChipGroup label="Big blind" options={[0.25, 0.5, 1, 2, 5].map((x) => ({ value: String(x), label: `$${x}` }))} value={[String(bigBlind)]} onChange={(v) => setBigBlind(Number(v[0]))} />
          <ChipGroup label="Buy-in" options={[20, 40, 100, 200, 300].map((x) => ({ value: String(x), label: `$${x}` }))} value={[String(buyIn)]} onChange={(v) => setBuyIn(Number(v[0]))} />
          <GameButton
            color="gold"
            fullWidth
            size="lg"
            disabled={!players.length}
            onClick={() => start({ venue, smallBlind: bigBlind / 2, bigBlind, buyIn, heroSeat, players: players.filter((p) => p.seat !== heroSeat) })}
          >
            {players.length ? `Start tracking (${players.length} players)` : 'Add at least one player'}
          </GameButton>
        </div>
      </Panel>
    </div>
  );
}

function LiveTracker({ session }: { session: LiveSession }) {
  const navigate = useNavigate();
  const { tap, undo, bookmark, end, markLogged } = useLive();
  const [open, setOpen] = useState<string | null>(null);
  useWakeLock(true);
  const seated = session.players.filter((p) => p.leftHand === undefined);
  const counts = (pid: string, t: LiveEventType) => session.events.filter((e) => e.player === pid && e.type === t).length;
  const logBookmark = (id: string) => {
    const b = session.bookmarks.find((x) => x.id === id)!;
    const prefill: LoggerPrefill = {
      players: [
        { id: 'hero', seat: session.heroSeat, hero: true },
        ...b.players.map((p): LoggedPlayer => ({ id: `p-${p.seat}`, seat: p.seat, profileId: p.profileId, name: p.name })),
      ],
      bigBlind: session.bigBlind,
      stackBb: Math.round(session.buyIn / session.bigBlind),
      liveSessionId: session.id,
      notes: `Live session, hand ${b.hand}`,
    };
    markLogged(id);
    navigate('/review/log', { state: { prefill } });
  };
  return (
    // Low-glare theme: dark surfaces, muted text, no sounds or celebrations.
    <div className="space-y-2">
      <div className="sticky top-0 z-20 -mx-4 bg-[#0d0a18]/95 px-4 pb-2 pt-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="font-display text-lg text-cream/80">Hand {session.handNo}</div>
          <div className="ml-auto flex gap-1.5">
            <GameButton size="sm" color="cream" sound={false} onClick={() => undo()}>
              Undo
            </GameButton>
            <GameButton size="sm" color="purple" sound={false} onClick={() => bookmark()}>
              Bookmark
            </GameButton>
          </div>
        </div>
        <GameButton className="mt-2" color="green" size="lg" fullWidth sound={false} onClick={() => tap('hand')}>
          Next hand
        </GameButton>
      </div>

      {seated.map((p) => {
        const hands = handsFor(session, p.id);
        const vpip = counts(p.id, 'vpip');
        return (
          <section key={p.id} className="rounded-2xl border-2 border-white/10 bg-[#171327] p-2 text-cream/85">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg">{p.name}</span>
              <span className="text-xs font-bold text-cream/50">
                {p.seat} · played {vpip}/{hands}
              </span>
              <button type="button" onClick={() => undo(p.id)} className="ml-auto min-h-11 min-w-11 rounded-lg px-2 text-xs font-bold text-cream/60 underline">
                undo
              </button>
            </div>
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {PRE.map((t) => (
                <TapButton key={t} label={LIVE_EVENT_LABELS[t as Exclude<LiveEventType, 'hand'>]} count={counts(p.id, t)} onClick={() => tap(t, p.id)} />
              ))}
            </div>
            {open === p.id ? (
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {POST.map((t) => (
                  <TapButton key={t} label={LIVE_EVENT_LABELS[t as Exclude<LiveEventType, 'hand'>]} count={counts(p.id, t)} onClick={() => tap(t, p.id)} />
                ))}
              </div>
            ) : null}
            <button type="button" onClick={() => setOpen(open === p.id ? null : p.id)} className="mt-1 min-h-11 w-full rounded-lg text-xs font-bold text-cream/60">
              {open === p.id ? 'Hide postflop reads' : 'Postflop reads ▾'}
            </button>
          </section>
        );
      })}

      {session.bookmarks.length > 0 && (
        <section className="rounded-2xl border-2 border-white/10 bg-[#171327] p-2 text-cream/85">
          <div className="font-display">Bookmarked hands</div>
          {session.bookmarks.map((b) => (
            <div key={b.id} className="mt-1 flex items-center gap-2 text-sm">
              <span>Hand {b.hand}</span>
              <GameButton className="ml-auto" size="sm" color={b.logged ? 'cream' : 'blue'} sound={false} onClick={() => logBookmark(b.id)}>
                {b.logged ? 'Logged ✓' : 'Log it'}
              </GameButton>
            </div>
          ))}
        </section>
      )}

      <GameButton color="red" fullWidth sound={false} onClick={() => end()}>
        End session
      </GameButton>
      <p className="text-center text-[11px] font-bold text-cream/40">Saved after every tap. Works offline. The screen stays on while tracking where supported.</p>
    </div>
  );
}

function TapButton({ label, count, onClick }: { label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-12 flex-col items-center justify-center rounded-xl border-2 border-white/15 bg-white/5 px-1 text-[11px] font-bold leading-tight text-cream/80 active:bg-white/20"
    >
      {label}
      <span className="font-display text-sm text-gold-300/70">{count || ''}</span>
    </button>
  );
}

function LiveReview({ session }: { session: LiveSession }) {
  const navigate = useNavigate();
  const { archive } = useLive();
  const profiles = useProfiles((s) => s.profiles);
  const updateProfile = useProfiles((s) => s.update);
  const addProfile = useProfiles((s) => s.add);
  const saveSession = useHandLog((s) => s.saveSession);
  const [cashOut, setCashOut] = useState('');
  const [rebuys, setRebuys] = useState('0');
  const [apply, setApply] = useState<Record<string, boolean>>(() => Object.fromEntries(session.players.map((p) => [p.id, true])));
  const rows = useMemo(
    () =>
      session.players.map((p) => {
        const obs: ObservedStats = computeObservedStats(session, p.id);
        const hands = handsFor(session, p.id);
        const prof = profiles.find((x) => x.id === p.profileId) ?? newProfile(p.name, 'tag', 'preview');
        const after = applySession(prof, obs, hands);
        return { p, obs, hands, before: prof, after, read: liveRead(p.name, obs), existing: !!p.profileId };
      }),
    [session, profiles],
  );
  const hours = Math.max(0.25, Math.round(((session.endedAt ?? Date.now()) - session.startedAt) / 36e5 * 4) / 4);
  const finish = () => {
    const out = Number(cashOut);
    if (cashOut !== '' && Number.isFinite(out)) {
      const s: RealSession = {
        id: `s-${session.id}`,
        date: new Date(session.startedAt).toISOString(),
        location: session.venue,
        buyIn: session.buyIn,
        rebuys: Number(rebuys) || 0,
        cashOut: out,
        hours,
        smallBlind: session.smallBlind,
        bigBlind: session.bigBlind,
        notes: `Live tracked: ${session.handNo - 1} hands, ${session.players.length} players.`,
      };
      saveSession(s);
    }
    for (const r of rows) {
      if (!apply[r.p.id] || !Object.keys(r.obs).length) continue;
      if (r.existing) updateProfile(r.p.profileId!, { stats: r.after.stats, observations: r.after.observations, samples: r.after.samples });
      else {
        const created: Profile = addProfile(r.p.name, 'tag');
        const fresh = applySession(created, r.obs, r.hands);
        updateProfile(created.id, { stats: fresh.stats, observations: fresh.observations, samples: fresh.samples });
      }
    }
    archive(session);
    toast({ tone: 'best', title: 'Session saved', message: 'Profiles updated from your reads.' });
    navigate('/review');
  };
  return (
    <div className="space-y-3">
      <ScreenHeader title="Session review" subtitle={`${session.handNo - 1} hands tracked · ${hours}h`} />
      <Panel tone="cream" title="Money">
        <div className="grid grid-cols-2 gap-2 text-ink">
          <label className="text-xs font-bold">
            Cashed out ($)
            <input inputMode="decimal" value={cashOut} onChange={(e) => setCashOut(e.target.value)} className="mt-0.5 min-h-11 w-full select-text rounded-xl border-[3px] border-ink bg-white px-2 font-display" />
          </label>
          <label className="text-xs font-bold">
            Rebuys ($)
            <input inputMode="decimal" value={rebuys} onChange={(e) => setRebuys(e.target.value)} className="mt-0.5 min-h-11 w-full select-text rounded-xl border-[3px] border-ink bg-white px-2 font-display" />
          </label>
        </div>
        <p className="mt-1 text-xs font-bold text-ink/70">Buy-in ${session.buyIn}. This adds the session to your results automatically (leave cash-out empty to skip).</p>
      </Panel>
      {rows.map((r) => (
        <Panel key={r.p.id} tone="night" title={r.p.name}>
          <p className="text-sm font-bold text-gold-300">{r.read}</p>
          <table className="mt-2 w-full text-left text-xs font-bold">
            <thead className="text-cream/60">
              <tr>
                <th>Stat</th>
                <th className="text-right">Seen</th>
                <th className="text-right">Before</th>
                <th className="text-right">After</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(STAT_NAMES) as (keyof PlayerStats)[]).map((k) => {
                const o = r.obs[k];
                return (
                  <tr key={k} className="border-t border-cream/10">
                    <td className="py-1">{STAT_NAMES[k]}</td>
                    <td className={`text-right ${o && !o.confident ? 'text-cream/50' : ''}`}>{o ? `${k === 'aggression' ? o.value.toFixed(1) : `${o.hits}/${o.n}`}${o.confident ? '' : '*'}` : '—'}</td>
                    <td className="text-right">{statText(k, r.before.stats[k])}</td>
                    <td className="text-right text-gold-300">{statText(k, r.after.stats[k])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] font-bold text-cream/60">* small sample (under 10): it only nudges the profile.</p>
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm font-bold">
            <input type="checkbox" className="h-5 w-5" checked={apply[r.p.id] ?? false} onChange={(e) => setApply({ ...apply, [r.p.id]: e.target.checked })} />
            {r.existing ? 'Update their profile' : `Create a profile for ${r.p.name}`}
          </label>
          {r.existing && (
            <ul className="mt-1 list-disc pl-5 text-xs font-semibold text-cream/80">
              {topExploits(r.after.stats).map((e) => (
                <li key={e.text}>{e.text}</li>
              ))}
            </ul>
          )}
        </Panel>
      ))}
      <GameButton color="gold" size="lg" fullWidth onClick={finish}>
        Confirm and save
      </GameButton>
      <p className="text-center text-xs font-bold text-cream/60">Archetype badges: {Object.values(ARCHETYPES).map((a) => a.short).join(', ')} — pick one later in the Exploit Lab.</p>
    </div>
  );
}

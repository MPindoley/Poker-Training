import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { findLeaks, formatPercent, sessionProfit, sessionStats, type DecisionReview, heroOf, migrateLoggedHand, opponentsOf } from '../engine';
import { useHandLog } from '../state/handLogStore';
import { useLive } from '../state/liveStore';
import { usePlayLog } from '../state/playLogStore';
import { toast } from '../state/toastStore';
import { downloadJson, exportAll, importAll, validateBackup } from '../storage/backup';
import { ScreenHeader } from '../components/ScreenHeader';
import { ChipGroup, GameButton, MiniCard, Panel } from '../components/ui';
import { GameTypeBars, RunningProfitChart } from '../components/charts/ProfitCharts';

type Tab = 'hands' | 'sessions' | 'leaks';
const money = (x: number) => `${x < 0 ? '−' : x > 0 ? '+' : ''}$${Math.abs(x).toFixed(2)}`;

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-[3px] border-ink bg-ink/40 p-2 text-center">
      <div className="font-display text-xl text-gold-300">{value}</div>
      <div className="text-[11px] font-bold text-cream/80">{label}</div>
    </div>
  );
}

export function ReviewScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('hands');
  const [table, setTable] = useState(false);
  const hands = useHandLog((s) => s.hands);
  const sessions = useHandLog((s) => s.sessions);
  const analyses = useHandLog((s) => s.analyses);
  const played = usePlayLog((s) => s.sessions);
  const stats = useMemo(() => sessionStats(sessions), [sessions]);
  const fileRef = useRef<HTMLInputElement>(null);

  const decisions: DecisionReview[] = useMemo(
    () => [...Object.values(analyses).flat(), ...played.flatMap((s) => s.hands.flatMap((h) => h.decisions))],
    [analyses, played],
  );
  const leaks = useMemo(() => findLeaks(decisions), [decisions]);
  const unanalysed = hands.filter((h) => !analyses[h.id]).length;

  const doExport = async () => {
    try {
      downloadJson(await exportAll(), `felt-academy-backup-${new Date().toISOString().slice(0, 10)}.json`);
      toast({ tone: 'best', title: 'Backup saved', message: 'Keep the file somewhere safe.' });
    } catch (e) {
      toast({ tone: 'mistake', title: 'Export failed', message: (e as Error).message });
    }
  };
  const doImport = async (file: File) => {
    try {
      const backup = validateBackup(JSON.parse(await file.text()));
      if (!confirm('Replace all data on this device with this backup?')) return;
      await importAll(backup);
      location.reload();
    } catch (e) {
      toast({ tone: 'mistake', title: 'Import failed', message: (e as Error).message });
    }
  };

  const liveActive = useLive((st) => !!st.active);
  return (
    <div className="space-y-4">
      <ScreenHeader title="Review" subtitle="Log real hands, find your leaks" />
      <GameButton color="green" size="lg" fullWidth onClick={() => navigate('/review/live')}>
        {liveActive ? 'Back to live session' : 'Start Live Session'}
      </GameButton>
      <div className="grid grid-cols-2 gap-3">
        <GameButton color="gold" onClick={() => navigate('/review/log')}>
          Log a hand
        </GameButton>
        <GameButton color="blue" onClick={() => navigate('/review/session/new')}>
          Log a session
        </GameButton>
      </div>
      <ChipGroup<Tab>
        options={[
          { value: 'hands', label: `Hands (${hands.length})` },
          { value: 'sessions', label: `Sessions (${sessions.length})` },
          { value: 'leaks', label: 'Leaks' },
        ]}
        value={[tab]}
        onChange={(v) => setTab(v[0]!)}
      />

      {tab === 'hands' && (
        <Panel tone="cream">
          {hands.length === 0 ? (
            <p className="py-4 text-center font-bold text-ink/70">No hands yet. Tap “Log a hand” after an interesting hand — it takes under a minute.</p>
          ) : (
            <div className="space-y-2">
              {hands.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => navigate(`/review/hand/${h.id}`)}
                  className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border-2 border-ink bg-white/70 px-2.5 py-2 text-left text-ink"
                >
                  <span className="flex items-center gap-0.5">
                    {h.heroCards.map((c) => (
                      <MiniCard key={c} code={c} />
                    ))}
                    <span className="mx-1 text-ink/40">|</span>
                    {h.board.map((c) => (
                      <MiniCard key={c} code={c} />
                    ))}
                  </span>
                  <span className="text-right text-[11px] font-bold text-ink/70">
                    {heroOf(migrateLoggedHand(h)).seat} vs {opponentsOf(migrateLoggedHand(h)).map((o) => o.seat).join(', ') || '—'}
                    <br />
                    {h.date.slice(5, 10)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === 'sessions' && (
        <>
          {sessions.length === 0 ? (
            <Panel tone="night">
              <p className="py-4 text-center font-bold text-cream/80">Log your sessions to see your results, hourly rate and big blinds per hour.</p>
            </Panel>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Tile label="Total profit" value={money(stats.profit)} />
                <Tile label="Hourly" value={stats.hourly !== null ? `${money(stats.hourly)}/h` : '—'} />
                <Tile label="Big blinds / hour" value={stats.bbPerHour !== null ? `${stats.bbPerHour.toFixed(1)}` : '—'} />
                <Tile label="Hours played" value={`${stats.hours}`} />
              </div>
              <Panel tone="night" title="Running profit">
                <RunningProfitChart stats={stats} />
              </Panel>
              <Panel tone="night" title="By game type">
                <GameTypeBars stats={stats} />
              </Panel>
              <GameButton size="sm" color="cream" onClick={() => setTable((t) => !t)}>
                {table ? 'Hide table' : 'Show as table'}
              </GameButton>
              <Panel tone="cream">
                <div className="space-y-1.5">
                  {[...sessions]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => navigate(`/review/session/${s.id}`)}
                        className="flex min-h-11 w-full items-center justify-between rounded-xl border-2 border-ink bg-white/70 px-2.5 py-1.5 text-left text-ink"
                      >
                        <span className="font-bold">
                          {s.date} · {s.location === 'home' ? 'Home' : 'Casino'} {table ? `· ${s.hours}h · $${s.smallBlind}/$${s.bigBlind}` : ''}
                        </span>
                        <span className={`font-display ${sessionProfit(s) >= 0 ? 'text-emerald-dark' : 'text-ruby-dark'}`}>{money(sessionProfit(s))}</span>
                      </button>
                    ))}
                </div>
              </Panel>
            </>
          )}
        </>
      )}

      {tab === 'leaks' && (
        <>
          {unanalysed > 0 && (
            <Panel tone="night">
              <p className="text-sm font-bold">{unanalysed} logged hand(s) haven't been analysed yet — open them to include them.</p>
            </Panel>
          )}
          {leaks.length === 0 ? (
            <Panel tone="night">
              <p className="py-4 text-center font-bold text-cream/80">
                No leaks found yet from {decisions.length} graded decisions. Log hands and play sessions — patterns show up here, ranked by cost.
              </p>
            </Panel>
          ) : (
            leaks.map((l, i) => (
              <Panel key={l.rule.id} tone={i === 0 ? 'wood' : 'night'} title={`#${i + 1} ${l.rule.title}`}>
                <p className="text-sm font-semibold">{l.rule.description}</p>
                <p className="mt-1 text-sm font-bold">
                  {l.count} of {l.opportunities} spots ({formatPercent(l.rate, 0)}) · est. cost {l.cost}bb{l.uncosted ? ` (+${l.uncosted} not costed)` : ''}
                </p>
                <GameButton className="mt-2" size="sm" color="gold" onClick={() => navigate(l.rule.drill)}>
                  Fix it: {l.rule.drillName}
                </GameButton>
              </Panel>
            ))
          )}
        </>
      )}

      <Panel tone="wood" title="Your data">
        <p className="text-sm font-semibold text-cream/90">Everything is saved on this device. Export a backup file so you never lose it.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <GameButton size="sm" color="gold" onClick={doExport}>
            Export JSON
          </GameButton>
          <GameButton size="sm" color="cream" onClick={() => fileRef.current?.click()}>
            Import JSON
          </GameButton>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
      </Panel>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dayKey, sessionProfit, type PlayerStats, type RealSession } from '../../engine';
import { useHandLog } from '../../state/handLogStore';
import { useProfiles } from '../../state/profilesStore';
import { toast } from '../../state/toastStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ChipGroup, GameButton, Panel } from '../../components/ui';

type Shift = 'less' | 'same' | 'more';
const OBSERVE: { key: keyof PlayerStats; label: string; step: number }[] = [
  { key: 'vpip', label: 'Played hands', step: 0.12 },
  { key: 'aggression', label: 'Aggression', step: 1 },
  { key: 'foldToCbet', label: 'Folded to flop bets', step: 0.15 },
  { key: 'foldToTurnBet', label: 'Folded to turn bets', step: 0.15 },
  { key: 'foldToRiverBet', label: 'Folded to river bets', step: 0.15 },
];

function Field({ label, value, onChange, type = 'number' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="font-display text-xs text-ink/70">{label}</span>
      <input
        type={type}
        inputMode={type === 'number' ? 'decimal' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 min-h-11 w-full select-text rounded-xl border-[3px] border-ink bg-white px-3 font-display text-lg text-ink"
      />
    </label>
  );
}

export function SessionEditorScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useHandLog((s) => s.sessions.find((x) => x.id === id));
  const saveSession = useHandLog((s) => s.saveSession);
  const removeSession = useHandLog((s) => s.removeSession);
  const lastSetup = useHandLog((s) => s.lastSetup);
  const profiles = useProfiles((s) => s.profiles);
  const observe = useProfiles((s) => s.observe);
  const [f, setF] = useState(() => ({
    date: existing?.date ?? dayKey(new Date()),
    location: existing?.location ?? lastSetup.location,
    buyIn: String(existing?.buyIn ?? 20),
    rebuys: String(existing?.rebuys ?? 0),
    cashOut: String(existing?.cashOut ?? ''),
    hours: String(existing?.hours ?? ''),
    sb: String(existing?.smallBlind ?? lastSetup.bigBlind / 2),
    bb: String(existing?.bigBlind ?? lastSetup.bigBlind),
    notes: existing?.notes ?? '',
  }));
  const [obs, setObs] = useState<Record<string, { hands: string; shifts: Partial<Record<keyof PlayerStats, Shift>> }>>({});
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  const save = () => {
    const nums = ['buyIn', 'rebuys', 'cashOut', 'hours', 'sb', 'bb'] as const;
    for (const k of nums) {
      if (!Number.isFinite(Number(f[k])) || Number(f[k]) < 0 || f[k] === '') {
        toast({ tone: 'mistake', title: 'Check the numbers', message: `${k === 'cashOut' ? 'Cash-out' : k} must be a number ≥ 0.` });
        return;
      }
    }
    const s: RealSession = {
      id: existing?.id ?? `r-${Date.now().toString(36)}`,
      date: f.date,
      location: f.location as 'home' | 'casino',
      buyIn: Number(f.buyIn),
      rebuys: Number(f.rebuys),
      cashOut: Number(f.cashOut),
      hours: Number(f.hours),
      smallBlind: Number(f.sb),
      bigBlind: Number(f.bb),
      notes: f.notes,
    };
    saveSession(s);
    // Let each opponent profile drift toward what you saw tonight.
    for (const [pid, o] of Object.entries(obs)) {
      const p = profiles.find((x) => x.id === pid);
      const hands = Number(o.hands) || 0;
      if (!p || hands <= 0) continue;
      const observed: Partial<PlayerStats> = {};
      for (const { key, step } of OBSERVE) {
        const shift = o.shifts[key];
        if (!shift || shift === 'same') continue;
        const v = p.stats[key] + (shift === 'more' ? step : -step);
        observed[key] = key === 'aggression' ? Math.max(0.3, v) : Math.min(0.95, Math.max(0.02, v));
      }
      if (Object.keys(observed).length) observe(pid, observed, hands);
    }
    const pr = sessionProfit(s);
    toast({ tone: 'best', title: 'Session saved', message: `Result ${pr >= 0 ? '+' : '−'}$${Math.abs(pr).toFixed(2)}` });
    navigate('/review');
  };

  return (
    <div className="space-y-3">
      <ScreenHeader
        title={existing ? 'Edit session' : 'Log a session'}
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate('/review')}>
            Cancel
          </GameButton>
        }
      />
      <Panel tone="cream">
        <div className="space-y-3 text-ink">
          <Field label="Date" type="date" value={f.date} onChange={(v) => set('date', v)} />
          <ChipGroup
            label="Where"
            options={[
              { value: 'home', label: 'Home game' },
              { value: 'casino', label: 'Casino' },
            ]}
            value={[f.location]}
            onChange={(v) => set('location', v[0]!)}
          />
          <div className="grid grid-cols-3 gap-2">
            <Field label="Buy-in $" value={f.buyIn} onChange={(v) => set('buyIn', v)} />
            <Field label="Rebuys $" value={f.rebuys} onChange={(v) => set('rebuys', v)} />
            <Field label="Cash-out $" value={f.cashOut} onChange={(v) => set('cashOut', v)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Hours" value={f.hours} onChange={(v) => set('hours', v)} />
            <Field label="SB $" value={f.sb} onChange={(v) => set('sb', v)} />
            <Field label="BB $" value={f.bb} onChange={(v) => set('bb', v)} />
          </div>
          <textarea
            value={f.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            placeholder="Notes"
            className="w-full select-text rounded-xl border-2 border-ink bg-white p-2 text-base"
          />
        </div>
      </Panel>

      {profiles.length > 0 && (
        <Panel tone="night" title="How did they play?">
          <p className="mb-2 text-xs font-semibold text-cream/75">Optional. Profiles drift toward what you saw, weighted by how many hands you played with them.</p>
          <div className="space-y-3">
            {profiles.map((p) => {
              const o = obs[p.id] ?? { hands: '', shifts: {} };
              const upd = (patch: Partial<typeof o>) => setObs((x) => ({ ...x, [p.id]: { ...o, ...patch } }));
              return (
                <details key={p.id} className="rounded-xl border-2 border-ink bg-ink/30 p-2">
                  <summary className="min-h-11 cursor-pointer py-2 font-display">{p.name}</summary>
                  <label className="block">
                    <span className="text-xs font-bold text-cream/75">Hands played with them</span>
                    <input
                      inputMode="numeric"
                      value={o.hands}
                      onChange={(e) => upd({ hands: e.target.value })}
                      className="mt-0.5 min-h-11 w-full select-text rounded-xl border-2 border-ink bg-white px-3 font-display text-ink"
                    />
                  </label>
                  {OBSERVE.map((s) => (
                    <div key={s.key} className="mt-2">
                      <ChipGroup<Shift>
                        label={s.label}
                        options={[
                          { value: 'less', label: 'Less' },
                          { value: 'same', label: 'As expected' },
                          { value: 'more', label: 'More' },
                        ]}
                        value={[o.shifts[s.key] ?? 'same']}
                        onChange={(v) => upd({ shifts: { ...o.shifts, [s.key]: v[0] } })}
                      />
                    </div>
                  ))}
                </details>
              );
            })}
          </div>
        </Panel>
      )}

      <GameButton color="gold" size="lg" fullWidth onClick={save}>
        Save session
      </GameButton>
      {existing && (
        <GameButton
          color="red"
          size="sm"
          fullWidth
          onClick={() => {
            if (confirm('Delete this session?')) {
              removeSession(existing.id);
              navigate('/review');
            }
          }}
        >
          Delete session
        </GameButton>
      )}
    </div>
  );
}

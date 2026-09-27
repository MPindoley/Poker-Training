import { useNavigate } from 'react-router-dom';
import { GRADE_LABEL, imageLabel, imageSessionNotes } from '../../engine';
import { useTable } from '../../state/tableStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GameButton, Panel } from '../../components/ui';

const signed = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(Math.round(x * 10) / 10)}bb`;

export function SessionSummaryScreen() {
  const navigate = useNavigate();
  const t = useTable();
  const s = t.summary();
  const total = s.grades.best + s.grades.acceptable + s.grades.mistake;
  return (
    <div className="space-y-3">
      <ScreenHeader
        title="Session"
        subtitle={`${s.hands} hands reviewed`}
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate(t.active ? '/play/table' : '/play')}>
            Back
          </GameButton>
        }
      />
      <div className="grid grid-cols-2 gap-2">
        {[
          ['Net result', signed(s.net)],
          ['All-in adjusted', signed(s.adjustedNet)],
          ['Luck', signed(s.luck)],
          ['EV lost to mistakes', `${Math.round(s.evLost * 10) / 10}bb`],
        ].map(([k, v]) => (
          <Panel key={k} tone="night" className="!px-2 text-center">
            <div className="font-display text-2xl text-gold-300">{v}</div>
            <div className="text-xs font-bold text-cream/80">{k}</div>
          </Panel>
        ))}
      </div>
      <Panel tone="cream" title="Decisions">
        <div className="flex justify-around text-center">
          {(['best', 'acceptable', 'mistake'] as const).map((g) => (
            <div key={g}>
              <div className="font-display text-2xl">{s.grades[g]}</div>
              <div className="text-xs font-bold text-ink/70">{GRADE_LABEL[g]}</div>
            </div>
          ))}
        </div>
        {total > 0 && <p className="mt-2 text-center text-sm font-bold">Luck is results minus all-in expectation; mistakes are what you control.</p>}
      </Panel>
      <Panel tone="night" title="Biggest mistakes">
        {s.biggestMistakes.length === 0 ? (
          <p className="text-center text-sm font-semibold text-cream/80">No mistakes flagged yet. Keep playing!</p>
        ) : (
          <div className="space-y-2">
            {s.biggestMistakes.map((m, i) => (
              <div key={i} className="rounded-xl border-2 border-ink bg-ink/40 p-2 text-sm">
                <div className="font-display">
                  Hand #{m.handNo} · {m.street}: {m.action} {m.evLost ? `(−${m.evLost}bb EV)` : ''}
                </div>
                <div className="text-xs font-semibold text-cream/80">
                  {m.best ? `Better: ${m.best}. ` : ''}
                  {m.note}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      {(t.active || t.imageShifts.length > 0) && (
        <Panel tone="night" title="Your table image">
          <ul className="space-y-1 text-sm font-semibold">
            {imageSessionNotes(t.imageShifts, imageLabel(t.image)).map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Panel>
      )}
      {t.active && (
        <GameButton
          color="red"
          fullWidth
          onClick={() => {
            t.endSession();
            navigate('/play');
          }}
        >
          End session and save
        </GameButton>
      )}
    </div>
  );
}

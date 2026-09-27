import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GRADE_LABEL, formatPercent } from '../../engine';
import { useHandLog } from '../../state/handLogStore';
import { useProfiles } from '../../state/profilesStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { CardView, GameButton, Panel, RichText, StrategyGrid } from '../../components/ui';
import { useLoggedAnalysis } from './useLoggedAnalysis';

const GRADE_BG = { best: 'bg-felt-300 text-ink', acceptable: 'bg-[#6fb2ff] text-ink', mistake: 'bg-ruby text-white' } as const;

export function LoggedHandScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const hand = useHandLog((s) => s.hands.find((h) => h.id === id));
  const remove = useHandLog((s) => s.removeHand);
  const profiles = useProfiles((s) => s.profiles);
  const { loading, result, error } = useLoggedAnalysis(hand);
  const [open, setOpen] = useState<number | null>(null);

  if (!hand) {
    return (
      <Panel tone="night" title="Not found">
        <p className="font-bold">That hand isn’t saved any more.</p>
        <GameButton className="mt-2" color="gold" onClick={() => navigate('/review')}>
          Back to Review
        </GameButton>
      </Panel>
    );
  }
  const opp = profiles.find((p) => p.id === hand.villainProfileId);
  return (
    <div className="space-y-3">
      <ScreenHeader
        title="Hand analysis"
        subtitle={`${hand.heroSeat} vs ${opp?.name ?? hand.villainSeat} · ${hand.stackBb}bb`}
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate('/review')}>
            Back
          </GameButton>
        }
      />
      <Panel tone="felt">
        <div className="flex items-end justify-center gap-3">
          <div className="flex gap-1">
            {hand.heroCards.map((c) => (
              <CardView key={c} card={c} size="md" />
            ))}
          </div>
          <div className="flex gap-1">
            {hand.board.map((c) => (
              <CardView key={c} card={c} size="sm" />
            ))}
          </div>
        </div>
        {hand.notes && <p className="mt-2 text-sm font-semibold">“{hand.notes}”</p>}
      </Panel>

      {loading && (
        <Panel tone="night">
          <p className="animate-pulse text-center font-bold">Reading ranges street by street…</p>
        </Panel>
      )}
      {error && (
        <Panel tone="night">
          <p className="font-bold text-[#ff9c94]">Couldn’t finish the analysis: {error}</p>
        </Panel>
      )}
      {result?.anyEstimated && (
        <p className="text-center text-xs font-bold text-gold-300">Amounts marked “estimated” were filled in for you (2/3 pot bets, 3x raises).</p>
      )}
      {result?.decisions.map((d, i) => (
        <Panel key={i} tone="cream" title={`${d.street[0]!.toUpperCase()}${d.street.slice(1)}`}>
          <div className="text-ink">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display">{d.review.action}</span>
              {d.review.grade && <span className={`rounded-md border-2 border-ink px-1.5 font-display text-xs ${GRADE_BG[d.review.grade]}`}>{GRADE_LABEL[d.review.grade]}</span>}
            </div>
            <p className="mt-1 text-sm font-semibold">
              <RichText text={d.summary} />
            </p>
            {d.analysis && (
              <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-bold">
                <span className="rounded-md bg-ink/10 px-1.5 py-0.5">Equity {formatPercent(d.analysis.heroEquity)}</span>
                {d.potOddsNeeded !== null && <span className="rounded-md bg-ink/10 px-1.5 py-0.5">Needed {formatPercent(d.potOddsNeeded)}</span>}
                <span className="rounded-md bg-ink/10 px-1.5 py-0.5">SPR {d.analysis.spr.toFixed(1)}</span>
                {d.review.evLost ? <span className="rounded-md bg-ruby/20 px-1.5 py-0.5">EV lost ≈ {d.review.evLost}bb</span> : null}
              </div>
            )}
            {d.villainRange && (
              <>
                <button type="button" className="mt-1 min-h-11 text-sm font-bold underline" onClick={() => setOpen(open === i ? null : i)}>
                  {open === i ? 'Hide' : 'Show'} villain’s likely range
                </button>
                {open === i && <StrategyGrid visual={d.villainRange} />}
              </>
            )}
          </div>
        </Panel>
      ))}
      {result && result.decisions.length === 0 && !error && (
        <Panel tone="night">
          <p className="font-bold">No decisions of yours were recorded in this hand.</p>
        </Panel>
      )}
      <GameButton
        color="red"
        size="sm"
        fullWidth
        onClick={() => {
          if (confirm('Delete this hand?')) {
            remove(hand.id);
            navigate('/review');
          }
        }}
      >
        Delete hand
      </GameButton>
    </div>
  );
}

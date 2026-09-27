import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CONFIDENCE_LABEL, GRADE_LABEL, formatPercent, heroOf, migrateLoggedHand, opponentsOf, replayAmounts, type LogStreet, type StreetAnalysis } from '../../engine';
import { useHandLog } from '../../state/handLogStore';
import { useProfiles } from '../../state/profilesStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { CardView, GameButton, MiniCard, Panel, RichText, StrategyGrid } from '../../components/ui';
import { playerName, useLoggedAnalysis } from './useLoggedAnalysis';

const GRADE_BG = { best: 'bg-felt-300 text-ink', acceptable: 'bg-[#6fb2ff] text-ink', mistake: 'bg-ruby text-white' } as const;
const STREET_NAME: Record<LogStreet, string> = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' };
const BOARD_AT: Record<LogStreet, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };
const r1 = (x: number) => Math.round(x * 10) / 10;

export function LoggedHandScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const raw = useHandLog((s) => s.hands.find((h) => h.id === id));
  const remove = useHandLog((s) => s.removeHand);
  const profiles = useProfiles((s) => s.profiles);
  const { loading, result, error } = useLoggedAnalysis(raw);
  const [open, setOpen] = useState<number | null>(null);
  const hand = useMemo(() => (raw ? migrateLoggedHand(raw) : undefined), [raw]);
  const replay = useMemo(() => (hand ? replayAmounts(hand) : null), [hand]);

  if (!hand || !replay) {
    return (
      <Panel tone="night" title="Not found">
        <p className="font-bold">That hand isn’t saved any more.</p>
        <GameButton className="mt-2" color="gold" onClick={() => navigate('/review')}>
          Back to Review
        </GameButton>
      </Panel>
    );
  }
  const hero = heroOf(hand);
  const opps = opponentsOf(hand);
  const name = (pid: string) => playerName(hand, pid, profiles);
  // Hero's decisions in order, matched to hero's actions in the replay.
  const decisions = result?.decisions ?? [];
  const decisionFor = (streetIdx: number) => decisions[streetIdx];
  let heroCount = 0;

  return (
    <div className="space-y-3">
      <ScreenHeader
        title="Hand analysis"
        subtitle={`You (${hero.seat}) vs ${opps.map((o) => name(o.id)).join(', ')} · ${hand.stackBb}bb${hand.straddle ? ' · straddled' : ''}`}
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
        {opps.some((o) => o.shownCards?.length === 2) && (
          <p className="mt-2 flex flex-wrap items-center justify-center gap-1 text-sm font-bold">
            Showed:
            {opps
              .filter((o) => o.shownCards?.length === 2)
              .map((o) => (
                <span key={o.id} className="flex items-center gap-0.5">
                  {name(o.id)} {o.shownCards!.map((c) => <MiniCard key={c} code={c} />)}
                </span>
              ))}
          </p>
        )}
        {hand.notes && <p className="mt-2 text-sm font-semibold">“{hand.notes}”</p>}
      </Panel>

      {loading && (
        <Panel tone="night">
          <p className="animate-pulse text-center font-bold">Reading every player’s range street by street…</p>
        </Panel>
      )}
      {error && (
        <Panel tone="night">
          <p className="font-bold text-[#ff9c94]">Couldn’t finish the analysis: {error}</p>
        </Panel>
      )}
      {replay.anyEstimated && <p className="text-center text-xs font-bold text-gold-300">Amounts marked “?” were estimated for you (2/3-pot bets, 3x raises).</p>}

      {(['preflop', 'flop', 'turn', 'river'] as LogStreet[]).map((st) => {
        const acts = replay.actions.filter((a) => a.street === st);
        if (!acts.length) return null;
        return (
          <Panel key={st} tone="cream" title={STREET_NAME[st]}>
            <div className="space-y-1.5 text-ink">
              {st !== 'preflop' && (
                <div className="flex items-center gap-1 text-xs font-bold text-ink/70">
                  {hand.board.slice(0, BOARD_AT[st]).map((c) => (
                    <MiniCard key={c} code={c} />
                  ))}
                  <span className="ml-auto">Pot {r1(acts[0]!.potBefore)}bb</span>
                </div>
              )}
              {acts.map((a, i) => {
                const isHero = a.actor === hero.id;
                const idx = isHero ? heroCount++ : -1;
                const d: StreetAnalysis | undefined = isHero ? decisionFor(idx) : undefined;
                const key = `${st}-${i}`;
                const amt = a.type === 'bet' || a.type === 'raise' ? ` ${r1(a.resolvedTo)}bb${a.estimated ? '?' : ''}` : a.type === 'call' ? ` ${r1(a.added)}bb` : '';
                return (
                  <div key={key} className={`rounded-xl px-2 py-1.5 ${isHero ? 'border-2 border-ink bg-white' : ''}`}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-display">{name(a.actor)}</span>
                      <span className="font-bold text-ink/80">
                        {a.type}
                        {amt}
                        {a.allIn ? ' (all-in)' : ''}
                      </span>
                      {d?.review.confidence && (
                        <span className="ml-auto rounded-md bg-ink/10 px-1 text-[10px] font-bold">
                          {CONFIDENCE_LABEL[d.review.confidence]}
                          {d.review.source === 'solver' ? ' · Solver' : ''}
                        </span>
                      )}
                      {d?.review.grade && <span className={`${d.review.confidence ? '' : 'ml-auto '} rounded-md border-2 border-ink px-1.5 font-display text-xs ${GRADE_BG[d.review.grade]}`}>{GRADE_LABEL[d.review.grade]}</span>}
                    </div>
                    {d && (
                      <>
                        <p className="mt-1 text-sm font-semibold">
                          <RichText text={d.summary} />
                        </p>
                        {d.analysis && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-bold">
                            <span className="rounded-md bg-ink/10 px-1.5 py-0.5">
                              Equity vs {d.opponents.length > 1 ? `the field (${d.opponents.length})` : d.opponents[0]?.name ?? 'villain'} {formatPercent(d.analysis.heroEquity)}
                            </span>
                            {d.potOddsNeeded !== null && <span className="rounded-md bg-ink/10 px-1.5 py-0.5">Needed {formatPercent(d.potOddsNeeded)}</span>}
                            <span className="rounded-md bg-ink/10 px-1.5 py-0.5">SPR {d.analysis.spr.toFixed(1)}</span>
                            {d.review.evLost ? <span className="rounded-md bg-ruby/20 px-1.5 py-0.5">EV lost ≈ {d.review.evLost}bb</span> : null}
                          </div>
                        )}
                        {d.actual && (
                          <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-xs font-bold">
                            <div className="rounded-lg border-2 border-ink bg-cream p-1.5">
                              <div className="font-display text-sm">At the time</div>
                              vs their ranges: {formatPercent(d.analysis?.heroEquity ?? 0)}
                            </div>
                            <div className="rounded-lg border-2 border-ink bg-cream p-1.5">
                              <div className="font-display text-sm">What they actually had</div>
                              {formatPercent(d.actual.equity)} vs <RichText text={d.actual.shown.join(', ')} />
                            </div>
                            <p className="col-span-2 text-[11px] text-ink/70">The grade is about the decision with what you could know (their ranges), not about the cards they turned out to hold.</p>
                          </div>
                        )}
                        {d.villainRange && (
                          <>
                            <button type="button" className="mt-1 min-h-11 text-sm font-bold underline" onClick={() => setOpen(open === idx ? null : idx)}>
                              {open === idx ? 'Hide' : 'Show'} the main opponent’s likely range
                            </button>
                            {open === idx && <StrategyGrid visual={d.villainRange} />}
                          </>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>
        );
      })}

      {replay.allIn.length > 0 && replay.pots.length > 1 && (
        <Panel tone="night">
          <p className="text-sm font-bold">
            Pots: {replay.pots.map((p, i) => `${i === 0 ? 'main' : `side ${i}`} ${r1(p.amount)}bb (${p.eligible.map(name).join(', ')})`).join(' · ')}
          </p>
        </Panel>
      )}
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

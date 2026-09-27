import { ACTION_NAMES, formatPercent, legalActions, potSize, type HandState, type PreflopAction, type PreflopAdvice, type SpotAnalysis } from '../../engine';
import { RichText } from '../ui';

export function CoachPanel({
  hand,
  analysis,
  preflop,
  loading,
  error,
  imageTip,
}: {
  hand: HandState;
  analysis: SpotAnalysis | null;
  preflop: PreflopAdvice | null;
  loading: boolean;
  error: string | null;
  /** How your table image changes this spot (null = nothing to add). */
  imageTip?: string | null;
}) {
  const la = legalActions(hand);
  const pot = potSize(hand);
  const priceLine = la && la.toCall > 0 ? `Pot odds: call ${la.call} to win ${Math.round(pot * 10) / 10} → need ${formatPercent(la.call / (pot + la.call))}` : null;
  return (
    <div className="rounded-2xl border-[3px] border-ink bg-gradient-to-b from-[#3a2d5c] to-[#241a3d] p-2.5 text-cream shadow-chunky-sm">
      <div className="mb-1 flex items-center gap-2 font-display text-sm text-gold-300">
        <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-ink bg-gold-500 text-ink">C</span> Coach
      </div>
      {preflop ? (
        <div className="space-y-0.5 text-sm font-semibold">
          <div>{preflop.situation}.</div>
          {preflop.strategy ? (
            <div>
              Chart: <b className="text-gold-300">{ACTION_NAMES[preflop.best as PreflopAction]}</b> with {preflop.label} (
              {(Object.entries(preflop.strategy.freq) as [PreflopAction, number][])
                .filter(([, v]) => v > 0.005)
                .map(([k, v]) => `${ACTION_NAMES[k]} ${formatPercent(v, 0)}`)
                .join(', ')}
              )
            </div>
          ) : (
            <div>No chart for this spot — continue only with premium hands.</div>
          )}
          {priceLine && <div className="text-cream/80">{priceLine}</div>}
        </div>
      ) : loading ? (
        <div className="animate-pulse text-sm font-semibold">Coach is reading the ranges…</div>
      ) : error ? (
        <div className="text-sm font-semibold text-[#ff9c94]">{error}</div>
      ) : analysis ? (
        <div className="space-y-0.5 text-sm font-semibold">
          <div>
            Equity vs likely range: <b className="text-gold-300">{formatPercent(analysis.heroEquity)}</b> · SPR {analysis.spr.toFixed(1)}
          </div>
          {priceLine && <div>{priceLine}</div>}
          <div>
            Suggest: <b className="text-gold-300">{analysis.best.label}</b>
          </div>
          <div className="text-xs text-cream/80">
            <RichText text={analysis.summary} />
          </div>
        </div>
      ) : (
        <div className="text-sm font-semibold text-cream/70">Waiting…</div>
      )}
      {imageTip && <div className="mt-1 rounded-lg bg-ink/40 px-1.5 py-1 text-xs font-bold text-[#b9d7ff]">{imageTip}</div>}
    </div>
  );
}

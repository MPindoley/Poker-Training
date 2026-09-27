import { GRADE_LABEL, formatPercent, rangeVisual, signedBb, type Spot, type SpotAnalysis } from '../engine';
import { Panel, RichText, StrategyGrid } from './ui';

const GRADE_STYLE = {
  best: 'bg-felt-300 text-ink',
  acceptable: 'bg-[#6fb2ff] text-ink',
  mistake: 'bg-cream/80 text-ink/70',
} as const;

/** Full breakdown of a spot: options with EV and grade, villain range, and the reasoning. */
export function SpotAnalysisView({ spot, analysis }: { spot: Spot; analysis: SpotAnalysis }) {
  return (
    <div className="space-y-3">
      <Panel tone="felt" title="Verdict">
        <p className="font-bold">
          <RichText text={analysis.summary} />
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs font-bold">
          {[
            ['Your hand', analysis.hero.description],
            ['Equity vs range', formatPercent(analysis.heroEquity)],
            ['SPR', analysis.spr.toFixed(1)],
            ['Board', analysis.texture.summary],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-ink/40 px-2 py-1">
              <div className="text-cream/70">{k}</div>
              <div className="font-display text-sm text-gold-300">{v}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel tone="cream" title="Options">
        <div className="space-y-1.5">
          {analysis.options.map((o) => (
            <div key={o.id} className={`flex items-center justify-between rounded-xl border-2 border-ink px-3 py-2 ${GRADE_STYLE[o.grade]}`}>
              <span className="font-display">{o.label}</span>
              <span className="text-right text-xs font-bold">
                {GRADE_LABEL[o.grade]}
                <span className="block font-mono">EV ≈ {signedBb(o.ev)}</span>
              </span>
            </div>
          ))}
        </div>
      </Panel>
      <Panel tone="night" title="Why">
        <div className="space-y-1 font-mono text-[12px] leading-relaxed text-gold-300">
          {analysis.steps.map((s, i) => (
            <div key={i}>
              <RichText text={s} />
            </div>
          ))}
        </div>
        <StrategyGrid className="mt-3" visual={rangeVisual(spot.villains[0]!.range, "Villain's estimated range")} />
      </Panel>
    </div>
  );
}

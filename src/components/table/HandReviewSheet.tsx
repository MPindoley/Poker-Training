import { motion } from 'framer-motion';
import { CONFIDENCE_LABEL, GRADE_LABEL, IMAGE_BLURBS, IMAGE_NAMES, formatPercent, type HandReview, type HandState } from '../../engine';
import { GameButton, MiniCard } from '../ui';

const GRADE_BG = { best: 'bg-felt-300 text-ink', acceptable: 'bg-[#6fb2ff] text-ink', mistake: 'bg-ruby text-white' } as const;
const signed = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(Math.round(x * 10) / 10)}bb`;

export function HandReviewSheet({ hand, review, onNext, onSummary }: { hand: HandState; review: HandReview | null; onNext: () => void; onSummary: () => void }) {
  const net = hand.result?.net[0] ?? 0;
  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30, delay: 0.6 }}
      className="rounded-3xl border-[3px] border-ink bg-gradient-to-b from-cream to-cream-dark p-3 text-ink shadow-chunky"
    >
      <div className="flex items-center justify-between">
        <div className="font-display text-xl">Hand #{hand.handNo}</div>
        <div className={`font-display text-2xl ${net > 0 ? 'text-emerald-dark' : net < 0 ? 'text-ruby-dark' : 'text-ink'}`}>{signed(net)}</div>
      </div>
      {!review ? (
        <div className="mt-1 animate-pulse text-sm font-bold">Reviewing your decisions…</div>
      ) : (
        <div className="mt-1 max-h-[min(14rem,26dvh)] space-y-1.5 overflow-y-auto pr-1">
          {review.decisions.length === 0 && <div className="text-sm font-bold text-ink/70">You didn’t have a decision this hand.</div>}
          {review.decisions.map((d, i) => (
            <div key={i} className="rounded-xl border-2 border-ink bg-white/70 p-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display">
                  {d.street[0]!.toUpperCase() + d.street.slice(1)}: {d.action}
                </span>
                <span className="flex items-center gap-1">
                  {d.confidence && <span className="rounded-md bg-ink/10 px-1 text-[10px] font-bold">{CONFIDENCE_LABEL[d.confidence]}</span>}
                  {d.grade && <span className={`rounded-md border-2 border-ink px-1.5 font-display text-xs ${GRADE_BG[d.grade]}`}>{GRADE_LABEL[d.grade]}</span>}
                </span>
              </div>
              <div className="text-xs font-semibold text-ink/75">
                {d.equity !== null && <>Equity {formatPercent(d.equity)} · </>}
                {d.evLost ? <>EV lost ≈ {d.evLost}bb · </> : null}
                {d.best && d.grade !== 'best' && <>Best: {d.best} · </>}
                {d.note}
              </div>
            </div>
          ))}
          {review.allIn && (
            <div className="rounded-xl border-2 border-ink bg-gold-300/60 p-2 text-xs font-bold">
              All-in with {formatPercent(review.allIn.equity)} equity: expected {signed(review.allIn.expected)}, actual {signed(review.allIn.actual)} —{' '}
              {review.allIn.actual >= review.allIn.expected ? 'you ran good' : 'bad luck, not bad play'}.
            </div>
          )}
          {review.imageShift && (
            <div className="rounded-xl border-2 border-ink bg-sapphire/25 p-2 text-xs font-bold">
              The table saw this hand: you now look <b>{IMAGE_NAMES[review.imageShift.to]}</b> (was {IMAGE_NAMES[review.imageShift.from]}). {IMAGE_BLURBS[review.imageShift.to]}
            </div>
          )}
          <div className="flex items-center gap-1 text-xs font-bold text-ink/70">
            You held {review.heroCards.map((c) => <MiniCard key={c} code={c} />)}
          </div>
        </div>
      )}
      <div className="mt-2 grid grid-cols-[1fr_2fr] gap-2">
        <GameButton color="cream" size="sm" onClick={onSummary}>
          Session
        </GameButton>
        <GameButton color="gold" size="sm" onClick={onNext}>
          Next hand
        </GameButton>
      </div>
    </motion.div>
  );
}

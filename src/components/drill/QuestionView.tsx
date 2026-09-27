import type { QuestionContext } from '../../engine';
import { CardView, RichText } from '../ui';

/** Renders a question's table context: board, hero cards, villain info and numeric facts. */
export function QuestionContextView({ context }: { context: QuestionContext }) {
  const { hero, board, villain, facts } = context;
  const boardSize = board && board.length > 4 ? 'sm' : 'md';
  return (
    <div className="felt-surface relative rounded-3xl border-[3px] border-ink p-3 shadow-chunky">
      <div className="pointer-events-none absolute inset-2 rounded-[1.1rem] border-2 border-white/10" />
      {board && (
        <div className="relative mb-2">
          <div className="mb-1 text-center font-display text-xs tracking-wider text-cream/70">BOARD</div>
          <div className="flex justify-center gap-1.5">
            {board.map((c, i) => (
              <CardView key={c} card={c} size={boardSize} dealt className={`[animation-delay:${i * 60}ms]`} />
            ))}
          </div>
        </div>
      )}
      {hero && (
        <div className="relative flex items-end justify-center gap-3">
          <div>
            <div className="mb-1 text-center font-display text-xs tracking-wider text-gold-300">YOU</div>
            <div className="flex gap-1">
              {hero.map((c) => (
                <CardView key={c} card={c} size="md" dealt />
              ))}
            </div>
          </div>
        </div>
      )}
      {context.lines && context.lines.length > 0 && (
        <ol className="relative mt-2 space-y-0.5 rounded-xl bg-ink/40 px-2.5 py-1.5 text-left text-xs font-semibold text-cream/90">
          {context.lines.map((l, i) => (
            <li key={i}>
              <RichText text={l} />
            </li>
          ))}
        </ol>
      )}
      {villain && (
        <p className="relative mt-2 text-center text-sm font-bold text-cream">
          <RichText text={villain} />
        </p>
      )}
      {facts && facts.length > 0 && (
        <div className="relative mt-2 flex flex-wrap justify-center gap-1.5">
          {facts.map((f) => (
            <span key={f.label} className="rounded-full border-2 border-ink bg-ink/70 px-2.5 py-0.5 text-xs font-bold text-cream">
              {f.label}: <span className="font-display text-sm text-gold-300">{f.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

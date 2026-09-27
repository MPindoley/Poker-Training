import { Fragment } from 'react';
import { parseCard } from '../../engine';
import { useSettings } from '../../state/settingsStore';
import { suitColorClass } from './CardView';
import { SuitIcon } from './SuitIcon';

/** A small inline card chip, e.g. for "{Ah}" tokens inside explanations. */
export function MiniCard({ code }: { code: string }) {
  const four = useSettings((s) => s.fourColorDeck);
  const c = parseCard(code);
  return (
    <span
      className={`mx-[1px] inline-flex translate-y-[1px] items-center gap-[1px] rounded-[4px] border-[1.5px] border-ink bg-white px-[3px] font-display text-[0.95em] leading-[1.25] ${suitColorClass(c.suit, four)}`}
    >
      {c.rank === 'T' ? '10' : c.rank}
      <SuitIcon suit={c.suit} className="h-[0.85em] w-[0.85em]" />
    </span>
  );
}

const TOKEN = /\{([2-9TJQKA][shdc])\}/g;

/** Text with {Ah}-style card tokens rendered as mini cards. */
export function RichText({ text }: { text: string }) {
  const parts: (string | { card: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) parts.push(text.slice(last, m.index));
    parts.push({ card: m[1]! });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <>
      {parts.map((p, i) => (typeof p === 'string' ? <Fragment key={i}>{p}</Fragment> : <MiniCard key={i} code={p.card} />))}
    </>
  );
}

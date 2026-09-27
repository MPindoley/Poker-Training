import { Panel } from './ui';

/** Placeholder list of what a screen will contain. */
export function ComingSoon({ items }: { items: string[] }) {
  return (
    <Panel tone="cream" title="Coming soon">
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 font-semibold">
            <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rotate-45 rounded-[2px] border-2 border-ink bg-gold-500" />
            {item}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

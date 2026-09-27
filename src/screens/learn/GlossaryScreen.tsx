import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GLOSSARY } from '../../content/glossary';
import { dyn } from '../../content/learn';
import { ScreenHeader } from '../../components/ScreenHeader';
import { GameButton, Panel, RichText } from '../../components/ui';

export function GlossaryScreen() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...GLOSSARY]
      .sort((a, b) => a.term.localeCompare(b.term))
      .filter((g) => !s || g.term.toLowerCase().includes(s) || g.definition.toLowerCase().includes(s));
  }, [q]);
  return (
    <div className="space-y-3">
      <ScreenHeader
        title="Glossary"
        subtitle={`${GLOSSARY.length} terms`}
        right={
          <GameButton size="sm" color="cream" onClick={() => navigate('/learn')}>
            Back
          </GameButton>
        }
      />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search terms…"
        type="search"
        className="min-h-12 w-full select-text rounded-2xl border-[3px] border-ink bg-white px-4 font-display text-lg text-ink shadow-chunky-sm"
      />
      {list.length === 0 && (
        <Panel tone="night">
          <p className="text-center font-bold">No terms match “{q}”.</p>
        </Panel>
      )}
      <div className="space-y-2">
        {list.map((g) => (
          <button
            key={g.term}
            type="button"
            onClick={() => setOpen(open === g.term ? null : g.term)}
            className="w-full rounded-2xl border-[3px] border-ink bg-gradient-to-b from-cream to-cream-dark p-3 text-left text-ink shadow-chunky-sm"
          >
            <div className="font-display text-lg">{g.term}</div>
            <div className="text-sm font-semibold">{g.definition}</div>
            {open === g.term && (
              <div className="mt-2 space-y-1 text-sm">
                {g.example && (
                  <div className="rounded-lg bg-felt-300/40 px-2 py-1 font-semibold">
                    Example: <RichText text={dyn(g.example)} />
                  </div>
                )}
                {g.vs && <div className="rounded-lg bg-gold-300/60 px-2 py-1 font-bold">{dyn(g.vs)}</div>}
                {g.related && <div className="text-xs font-bold text-ink/60">See also: {g.related.join(', ')}</div>}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

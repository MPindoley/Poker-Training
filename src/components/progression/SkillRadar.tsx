import { motion } from 'framer-motion';
import { useState } from 'react';
import { AREA_NAMES, CONFIDENT_ATTEMPTS, SKILL_AREAS, formatPercent, type AreaScore, type SkillArea } from '../../engine';

const SIZE = 280;
const C = SIZE / 2;
const R = 92;
const RINGS = [0.25, 0.5, 0.75, 1];

function point(i: number, value: number): [number, number] {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / SKILL_AREAS.length;
  return [C + Math.cos(angle) * R * value, C + Math.sin(angle) * R * value];
}

/**
 * Five-axis skill radar (single series, so no legend: the panel title names it). Tap a point or
 * label for its numbers; "Table" shows the same data as text.
 */
export function SkillRadar({ radar }: { radar: Record<SkillArea, AreaScore> }) {
  const [active, setActive] = useState<SkillArea | null>(null);
  const [table, setTable] = useState(false);
  const pts = SKILL_AREAS.map((a, i) => point(i, radar[a].score));
  const shape = pts.map((p) => p.join(',')).join(' ');

  const detail = (a: SkillArea) => {
    const s = radar[a];
    return s.attempts
      ? `${formatPercent(s.score, 0)} rating · ${s.correct}/${s.attempts} right (${formatPercent(s.accuracy!, 0)})${s.confident ? '' : ' · still learning you'}`
      : 'No answers yet · rating starts at 50%';
  };

  return (
    <div>
      <div className="flex justify-end">
        <button type="button" onClick={() => setTable((t) => !t)} className="min-h-11 rounded-xl px-3 font-display text-sm text-gold-300 underline">
          {table ? 'Chart' : 'Table'}
        </button>
      </div>
      {table ? (
        <table className="w-full text-left text-sm font-bold">
          <thead className="text-cream/70">
            <tr>
              <th className="py-1">Area</th>
              <th className="text-right">Rating</th>
              <th className="text-right">Right</th>
            </tr>
          </thead>
          <tbody>
            {SKILL_AREAS.map((a) => (
              <tr key={a} className="border-t border-cream/15">
                <td className="py-1.5">{AREA_NAMES[a]}</td>
                <td className="text-right font-display text-gold-300">{formatPercent(radar[a].score, 0)}</td>
                <td className="text-right">
                  {radar[a].correct}/{radar[a].attempts}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <svg viewBox={`-44 -4 ${SIZE + 88} ${SIZE + 4}`} className="mx-auto block w-full max-w-[340px]" role="img" aria-label="Skill radar">
          {RINGS.map((r) => (
            <polygon
              key={r}
              points={SKILL_AREAS.map((_, i) => point(i, r).join(',')).join(' ')}
              fill="none"
              stroke="rgb(255 246 224 / 0.16)"
              strokeWidth={1}
            />
          ))}
          {SKILL_AREAS.map((a, i) => {
            const [x, y] = point(i, 1);
            return <line key={a} x1={C} y1={C} x2={x} y2={y} stroke="rgb(255 246 224 / 0.16)" strokeWidth={1} />;
          })}
          <motion.polygon
            points={shape}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{ originX: `${C}px`, originY: `${C}px` }}
            transition={{ type: 'spring', stiffness: 120, damping: 14 }}
            fill="rgb(245 184 32 / 0.35)"
            stroke="#f5b820"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {SKILL_AREAS.map((a, i) => {
            const [x, y] = pts[i]!;
            const [lx, ly] = point(i, 1.28);
            const s = radar[a];
            return (
              <g key={a} onClick={() => setActive(active === a ? null : a)} onMouseEnter={() => setActive(a)} className="cursor-pointer">
                {/* Hit target bigger than the mark. */}
                <circle cx={x} cy={y} r={16} fill="transparent" />
                <circle cx={x} cy={y} r={active === a ? 7 : 5} fill="#f5b820" stroke="#241a3d" strokeWidth={2} strokeDasharray={s.confident ? undefined : '2 2'} />
                <text x={lx} y={ly - 6} textAnchor="middle" className="fill-cream font-display" fontSize={13}>
                  {AREA_NAMES[a]}
                </text>
                <text x={lx} y={ly + 9} textAnchor="middle" className="fill-cream/75 font-body" fontSize={11} fontWeight={700}>
                  {formatPercent(s.score, 0)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      <div className="min-h-10 text-center text-xs font-bold text-cream/85" aria-live="polite">
        {active ? (
          <>
            <span className="font-display text-sm text-gold-300">{AREA_NAMES[active]}: </span>
            {detail(active)}
          </>
        ) : (
          `Tap a skill for details. Ratings blend in a 50% starting guess until you have ${CONFIDENT_ATTEMPTS} answers in an area.`
        )}
      </div>
    </div>
  );
}

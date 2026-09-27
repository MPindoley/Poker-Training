import { useMemo, useRef, useState, type PointerEvent } from 'react';
import type { SessionStats } from '../../engine';

/** Chart colours validated with the dataviz palette checker on the night panel (#241a3d). */
export const CHART_COLORS = { home: '#c0860a', casino: '#3b7fd9', line: '#c0860a', grid: 'rgba(255,246,224,0.12)', axis: 'rgba(255,246,224,0.6)' };

const money = (x: number) => `${x < 0 ? '−' : x > 0 ? '+' : ''}$${Math.abs(x).toFixed(Math.abs(x) >= 100 ? 0 : 2)}`;

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = Math.max(1, max - min);
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? mag * 10;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

/** Running profit (single series, so no legend: the title names it). Crosshair + tooltip on hover/tap. */
export function RunningProfitChart({ stats }: { stats: SessionStats }) {
  const W = 340;
  const H = 180;
  const pad = { l: 44, r: 12, t: 12, b: 24 };
  const pts = stats.running;
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const { ticks, x, y } = useMemo(() => {
    const vals = [0, ...pts.map((p) => p.total)];
    const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
    const lo = ticks[0]!;
    const hi = ticks[ticks.length - 1]!;
    const x = (i: number) => pad.l + (pts.length <= 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (pts.length - 1));
    const y = (v: number) => pad.t + ((hi - v) * (H - pad.t - pad.b)) / Math.max(1e-9, hi - lo);
    return { ticks, x, y };
  }, [pts]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pts.length) return null;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(' ');
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = ref.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    pts.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    setHover(best);
  };
  const h = hover !== null ? pts[hover]! : null;
  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Running profit over ${pts.length} sessions, now ${money(stats.profit)}`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? CHART_COLORS.axis : CHART_COLORS.grid} strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill={CHART_COLORS.axis} fontWeight={700}>
              {t === 0 ? '$0' : `${t < 0 ? '−' : ''}$${Math.abs(t)}`}
            </text>
          </g>
        ))}
        <path d={`${path} L${x(pts.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={CHART_COLORS.line} opacity={0.1} />
        <path d={path} fill="none" stroke={CHART_COLORS.line} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pts.length > 0 && (
          <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1]!.total)} r={4.5} fill={CHART_COLORS.line} stroke="#241a3d" strokeWidth={2} />
        )}
        {h && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke={CHART_COLORS.axis} strokeWidth={1} />
            <circle cx={x(hover)} cy={y(h.total)} r={5} fill={CHART_COLORS.line} stroke="#241a3d" strokeWidth={2} />
          </g>
        )}
        <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize="10" fill={CHART_COLORS.axis} fontWeight={700}>
          {pts.length} sessions
        </text>
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 rounded-lg border-2 border-ink bg-cream px-2 py-1 text-xs font-bold text-ink shadow-chunky-sm"
          style={{ left: `${Math.min(70, Math.max(0, (x(hover) / W) * 100 - 15))}%` }}
        >
          {h.date} · session {money(h.profit)}
          <div className="font-display text-sm">Total {money(h.total)}</div>
        </div>
      )}
    </div>
  );
}

/** Results by game type: two columns with values at the tips; legend below (2 series). */
export function GameTypeBars({ stats }: { stats: SessionStats }) {
  const rows = (['home', 'casino'] as const).map((k) => ({ key: k, label: k === 'home' ? 'Home game' : 'Casino', ...stats.byLocation[k] })).filter((r) => r.sessions > 0);
  const [hover, setHover] = useState<string | null>(null);
  if (!rows.length) return null;
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.profit)));
  return (
    <div>
      <div className="relative mt-3 flex h-44 items-center justify-around">
        <div className="absolute inset-x-0 top-1/2 h-px bg-cream/40" />
        {rows.map((r) => {
          const hgt = (Math.abs(r.profit) / max) * 38; // % of the full height, from the zero line
          const up = r.profit >= 0;
          return (
            <button
              type="button"
              key={r.key}
              className="relative flex h-full w-20 flex-col items-center justify-center"
              onPointerEnter={() => setHover(r.key)}
              onPointerLeave={() => setHover(null)}
              onClick={() => setHover(hover === r.key ? null : r.key)}
              aria-label={`${r.label}: ${money(r.profit)} over ${r.sessions} sessions`}
            >
              <div className="relative h-full w-6">
                <div
                  className="absolute left-0 w-6"
                  style={{
                    background: CHART_COLORS[r.key],
                    height: `${hgt}%`,
                    ...(up ? { bottom: '50%', borderRadius: '4px 4px 0 0' } : { top: '50%', borderRadius: '0 0 4px 4px' }),
                  }}
                />
                <div className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-display text-xs text-cream" style={up ? { bottom: `calc(50% + ${hgt}% + 2px)` } : { top: `calc(50% + ${hgt}% + 2px)` }}>
                  {money(r.profit)}
                </div>
              </div>
              {hover === r.key && (
                <div className="absolute -top-2 z-10 whitespace-nowrap rounded-lg border-2 border-ink bg-cream px-2 py-1 text-xs font-bold text-ink">
                  {r.sessions} sessions · {r.hours}h · {r.hourly !== null ? `${money(r.hourly)}/h` : '—'}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-center gap-4 text-xs font-bold text-cream/85">
        {rows.map((r) => (
          <span key={r.key} className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: CHART_COLORS[r.key] }} /> {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}

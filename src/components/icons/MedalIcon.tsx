import type { Difficulty } from '../../engine';

const COLORS: Record<Difficulty, [string, string]> = {
  bronze: ['#f0a86a', '#9a5a24'],
  silver: ['#f1f3f8', '#9aa3b5'],
  gold: ['#ffe27a', '#d18c0c'],
  diamond: ['#b8f1ff', '#3aa6d9'],
};

/** Original difficulty medal. Diamond is a cut gem, the others round medals on a ribbon. */
export function MedalIcon({ tier, className = 'h-8 w-8' }: { tier: Difficulty; className?: string }) {
  const [light, dark] = COLORS[tier];
  const id = `medal-${tier}`;
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      {tier === 'diamond' ? (
        <g stroke="#1b1230" strokeWidth="2.2" strokeLinejoin="round">
          <path d="M6 12 L11 5 H21 L26 12 L16 28 Z" fill={`url(#${id})`} />
          <path d="M6 12 H26 M11 5 L14 12 L16 28 L18 12 L21 5" fill="none" strokeWidth="1.4" />
        </g>
      ) : (
        <g stroke="#1b1230" strokeWidth="2.2" strokeLinejoin="round">
          <path d="M10 2 L14 12 L18 12 L22 2 Z" fill="#e5383b" />
          <circle cx="16" cy="20" r="9" fill={`url(#${id})`} />
          <path d="M16 15 L17.5 18.4 L21 18.6 L18.2 20.8 L19.2 24.2 L16 22.2 L12.8 24.2 L13.8 20.8 L11 18.6 L14.5 18.4 Z" fill="#fff" fillOpacity="0.7" strokeWidth="1" />
        </g>
      )}
    </svg>
  );
}

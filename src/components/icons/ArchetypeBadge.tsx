import type { ArchetypeId } from '../../engine';

const COLORS: Record<ArchetypeId, [string, string]> = {
  station: ['#6fb2ff', '#164fa6'],
  nit: ['#d7dde8', '#6b7488'],
  maniac: ['#ff7a6e', '#a8161f'],
  tag: ['#45c47e', '#127339'],
  efls: ['#ffe27a', '#b87908'],
  gambler: ['#b88bff', '#5623a6'],
};

/** Original character badges: a round chip-face with a simple expressive symbol per player type. */
export function ArchetypeBadge({ id, className = 'h-10 w-10' }: { id: ArchetypeId; className?: string }) {
  const [light, dark] = COLORS[id];
  const gid = `arch-${id}`;
  const ink = '#1b1230';
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      <circle cx="20" cy="21" r="17" fill={ink} />
      <circle cx="20" cy="19" r="17" fill={`url(#${gid})`} stroke={ink} strokeWidth="2.5" />
      <ellipse cx="20" cy="11" rx="10" ry="3.5" fill="#fff" opacity="0.35" />
      {id === 'station' && (
        <g stroke={ink} strokeWidth="2.5" strokeLinecap="round" fill="none">
          <circle cx="14" cy="17" r="2" fill={ink} />
          <circle cx="26" cy="17" r="2" fill={ink} />
          <path d="M13 25 Q20 30 27 25" />
        </g>
      )}
      {id === 'nit' && (
        <g stroke={ink} strokeWidth="2.5" strokeLinecap="round" fill="none">
          <path d="M11 17 H17 M23 17 H29" />
          <path d="M15 27 H25" />
        </g>
      )}
      {id === 'maniac' && (
        <g stroke={ink} strokeWidth="2.5" strokeLinecap="round" fill="none">
          <path d="M11 14 L17 17 M29 14 L23 17" />
          <circle cx="15" cy="19" r="1.6" fill={ink} />
          <circle cx="25" cy="19" r="1.6" fill={ink} />
          <path d="M12 25 Q20 32 28 25 Z" fill="#fff" />
        </g>
      )}
      {id === 'tag' && (
        <g stroke={ink} strokeWidth="2.5" strokeLinecap="round" fill="none">
          <path d="M11 16 H18 M22 16 H29" />
          <rect x="11" y="15" width="7" height="4" rx="1" fill={ink} />
          <rect x="22" y="15" width="7" height="4" rx="1" fill={ink} />
          <path d="M15 26 Q20 28 25 26" />
        </g>
      )}
      {id === 'efls' && (
        <g stroke={ink} strokeWidth="2.5" strokeLinecap="round" fill="none">
          <circle cx="14" cy="18" r="2" fill={ink} />
          <path d="M23 18 H28" />
          <path d="M14 26 Q20 24 26 27" />
        </g>
      )}
      {id === 'gambler' && (
        <g stroke={ink} strokeWidth="2.5" strokeLinecap="round" fill="none">
          <path d="M11 17 Q14 14 17 17 M23 17 Q26 14 29 17" />
          <path d="M13 24 Q20 31 27 24" />
          <circle cx="31" cy="9" r="3.5" fill="#f5b820" />
        </g>
      )}
    </svg>
  );
}

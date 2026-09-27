/** Original trophy; greyed out while locked. */
export function TrophyIcon({ locked = false, className = 'h-10 w-10' }: { locked?: boolean; className?: string }) {
  const light = locked ? '#8f8a9e' : '#ffe27a';
  const dark = locked ? '#4a4460' : '#b87908';
  const id = locked ? 'trophy-l' : 'trophy-u';
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      <path d="M13 9 H7 a4 4 0 0 0 0 8 c1 6 6 9 9 9 M35 9 h6 a4 4 0 0 1 0 8 c-1 6 -6 9 -9 9" fill="none" stroke="#1b1230" strokeWidth="3" strokeLinecap="round" />
      <path d="M12 6 H36 V16 a12 12 0 0 1 -24 0 Z" fill={`url(#${id})`} stroke="#1b1230" strokeWidth="3" strokeLinejoin="round" />
      <rect x="20" y="28" width="8" height="8" fill={`url(#${id})`} stroke="#1b1230" strokeWidth="2.5" />
      <rect x="13" y="36" width="22" height="7" rx="2" fill={`url(#${id})`} stroke="#1b1230" strokeWidth="3" />
      <path d="M17 10 v6" stroke="#fff" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

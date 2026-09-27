/** Original treasure chest. `open` lifts the lid. */
export function ChestIcon({ open = false, className = 'h-12 w-12' }: { open?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="chest-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d59256" />
          <stop offset="1" stopColor="#6b3a1e" />
        </linearGradient>
        <linearGradient id="chest-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe27a" />
          <stop offset="1" stopColor="#b87908" />
        </linearGradient>
      </defs>
      {open && <ellipse cx="32" cy="30" rx="20" ry="8" fill="#ffe27a" opacity="0.85" />}
      <rect x="8" y="30" width="48" height="26" rx="5" fill="url(#chest-wood)" stroke="#1b1230" strokeWidth="3" />
      <rect x="8" y="40" width="48" height="5" fill="url(#chest-gold)" stroke="#1b1230" strokeWidth="2" />
      <g transform={open ? 'rotate(-28 10 30) translate(0 -4)' : undefined}>
        <path d="M8 30 V22 a24 12 0 0 1 48 0 V30 Z" fill="url(#chest-wood)" stroke="#1b1230" strokeWidth="3" strokeLinejoin="round" />
        <path d="M14 14 Q32 6 50 14" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round" />
        <rect x="27" y="10" width="10" height="20" fill="url(#chest-gold)" stroke="#1b1230" strokeWidth="2" />
      </g>
      <rect x="26" y="34" width="12" height="13" rx="3" fill="url(#chest-gold)" stroke="#1b1230" strokeWidth="2.5" />
      <circle cx="32" cy="40" r="2" fill="#1b1230" />
    </svg>
  );
}

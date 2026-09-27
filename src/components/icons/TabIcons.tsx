/** Original chunky tab icons. Drawn on a 32x32 grid with thick ink outlines. */
const ink = '#1b1230';
const common = { stroke: ink, strokeWidth: 2.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

export function HomeIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden>
      <path d="M5 15 L16 5 L27 15 L27 27 L5 27 Z" fill="#ff7a6e" {...common} />
      <path d="M3 16 L16 4 L29 16" fill="none" {...common} strokeWidth={3} />
      <rect x="12.5" y="18" width="7" height="9" rx="1.5" fill="#ffe27a" {...common} />
    </svg>
  );
}

export function TrainIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="17" r="11" fill="#fff6e0" {...common} />
      <circle cx="16" cy="17" r="7" fill="#e5383b" {...common} />
      <circle cx="16" cy="17" r="3" fill="#fff6e0" {...common} />
      <path d="M16 17 L27 6" fill="none" {...common} strokeWidth={3} />
      <path d="M24 4 L28 4 L28 8" fill="#f5b820" {...common} />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden>
      <rect x="4" y="7" width="14" height="19" rx="3" fill="#fff6e0" transform="rotate(-12 11 16)" {...common} />
      <rect x="13" y="6" width="14" height="19" rx="3" fill="#fff6e0" transform="rotate(10 20 15)" {...common} />
      <path d="M20.5 11 C23 13.5 24.5 15 22 17.5 C21 18.3 20 18 20.5 17 C21 18 20 18.3 19 17.5 C16.5 15 18 13.5 20.5 11 Z" fill="#e5383b" transform="rotate(10 20 15)" stroke={ink} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export function ReviewIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden>
      <rect x="6" y="5" width="20" height="23" rx="3" fill="#fff6e0" {...common} />
      <rect x="11" y="3" width="10" height="5" rx="1.5" fill="#a0612f" {...common} />
      <path d="M10 22 L10 19 M16 22 L16 14 M22 22 L22 17" fill="none" stroke="#2f7fe8" strokeWidth={3.5} strokeLinecap="round" />
    </svg>
  );
}

export function LearnIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden>
      <path d="M16 9 C12 6 7 6 4 7 L4 25 C7 24 12 24 16 27 Z" fill="#8b4ae8" {...common} />
      <path d="M16 9 C20 6 25 6 28 7 L28 25 C25 24 20 24 16 27 Z" fill="#b88bff" {...common} />
      <path d="M8 12 C10 11.5 12 11.7 13 12.3 M8 16 C10 15.5 12 15.7 13 16.3" fill="none" stroke="#fff6e0" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}

/** Original streak flame. */
export function FlameIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-4.5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z"
        fill="#ff8a3d"
        stroke="#1b1230"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 12c1.5 1.5 3 3 3 5a3 3 0 0 1-6 0c0-1.5 1.5-3 3-5z" fill="#ffe27a" />
    </svg>
  );
}

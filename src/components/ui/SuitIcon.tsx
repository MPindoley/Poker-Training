import type { Suit } from '../../engine';

/** Original suit glyphs, drawn as SVG so they never render as emoji on iOS. */
export function SuitIcon({ suit, className = '' }: { suit: Suit; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      {suit === 'h' && (
        <path d="M12 21.2s-8.3-5-9.9-10.1C1 7.4 3.4 3.8 7 3.8c2.2 0 3.8 1.2 5 3 1.2-1.8 2.8-3 5-3 3.6 0 6 3.6 4.9 7.3C20.3 16.2 12 21.2 12 21.2z" />
      )}
      {suit === 'd' && <path d="M12 1.8c2.4 3.7 5.1 6.9 8.2 10.2-3.1 3.3-5.8 6.5-8.2 10.2C9.6 18.5 6.9 15.3 3.8 12 6.9 8.7 9.6 5.5 12 1.8z" />}
      {suit === 's' && (
        <path d="M12 2s8.6 5.6 9.7 10.4c.8 3.4-1.5 6.1-4.4 6.1-1.6 0-2.9-.7-3.9-1.8.3 1.9 1.1 3.4 2.6 4.8H8c1.5-1.4 2.3-2.9 2.6-4.8-1 1.1-2.3 1.8-3.9 1.8-2.9 0-5.2-2.7-4.4-6.1C3.4 7.6 12 2 12 2z" />
      )}
      {suit === 'c' && (
        <g>
          <circle cx="12" cy="7" r="4.6" />
          <circle cx="6.6" cy="13.6" r="4.6" />
          <circle cx="17.4" cy="13.6" r="4.6" />
          <path d="M10.6 12h2.8c.2 3.6 1.2 6.4 3.1 9.3H7.5c1.9-2.9 2.9-5.7 3.1-9.3z" />
        </g>
      )}
    </svg>
  );
}

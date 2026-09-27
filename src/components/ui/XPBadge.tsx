import { motion } from 'framer-motion';

export interface XPBadgeProps {
  level: number;
  /** 0..1 progress to next level, drawn as a ring. */
  progress?: number;
  size?: number;
  className?: string;
}

/** Gold level shield with a progress ring. */
export function XPBadge({ level, progress = 0, size = 64, className = '' }: XPBadgeProps) {
  const r = 29;
  const circumference = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <motion.div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
      whileTap={{ scale: 0.9, rotate: -6 }}
      transition={{ type: 'spring', stiffness: 500, damping: 12 }}
      aria-label={`Level ${level}`}
    >
      <svg viewBox="0 0 70 70" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="xpb-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe27a" />
            <stop offset="1" stopColor="#d18c0c" />
          </linearGradient>
          <linearGradient id="xpb-core" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8b4ae8" />
            <stop offset="1" stopColor="#4a1d94" />
          </linearGradient>
        </defs>
        <circle cx="35" cy="35" r={r} fill="none" stroke="#1b1230" strokeWidth="9" />
        <motion.circle
          cx="35"
          cy="35"
          r={r}
          fill="none"
          stroke="#45c47e"
          strokeWidth="5"
          strokeLinecap="round"
          transform="rotate(-90 35 35)"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - p) }}
          transition={{ type: 'spring', stiffness: 80, damping: 18 }}
        />
        {/* eight-point star shield */}
        <path
          d="M35 10 L41 18 L51 16 L50 26 L59 31 L52 38 L56 47 L46 48 L42 57 L35 51 L28 57 L24 48 L14 47 L18 38 L11 31 L20 26 L19 16 L29 18 Z"
          fill="url(#xpb-gold)"
          stroke="#1b1230"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="35" cy="34" r="13" fill="url(#xpb-core)" stroke="#1b1230" strokeWidth="2.5" />
        <ellipse cx="35" cy="28" rx="8" ry="3.5" fill="#fff" opacity="0.3" />
      </svg>
      <div
        className="text-outline-sm absolute inset-0 grid place-items-center pb-[3%] font-display text-white"
        style={{ fontSize: size * (level >= 100 ? 0.2 : 0.28) }}
      >
        {level}
      </div>
    </motion.div>
  );
}

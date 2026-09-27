import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { HomeIcon, LearnIcon, PlayIcon, ReviewIcon, TrainIcon } from './icons/TabIcons';

export const TABS: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/', label: 'Home', icon: <HomeIcon /> },
  { to: '/train', label: 'Train', icon: <TrainIcon /> },
  { to: '/play', label: 'Play', icon: <PlayIcon /> },
  { to: '/review', label: 'Review', icon: <ReviewIcon /> },
  { to: '/learn', label: 'Learn', icon: <LearnIcon /> },
];

/** Wooden rail tab bar pinned to the bottom, thumb-reachable. */
export function TabBar() {
  return (
    <nav className="wood-grain pb-safe fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] rounded-t-3xl border-x-[3px] border-t-[3px] border-ink shadow-[0_-4px_0_0_rgb(0_0_0/0.25)]">
      <div className="pointer-events-none absolute inset-x-4 top-1 h-2 rounded-full bg-white/25" />
      <ul className="relative grid grid-cols-5 px-1 pt-1.5 pb-1">
        {TABS.map((tab) => (
          <li key={tab.to}>
            <NavLink to={tab.to} end={tab.to === '/'} className="block outline-none">
              {({ isActive }) => (
                <motion.div
                  className="relative flex flex-col items-center pt-1"
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 15 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="tab-active"
                      className="absolute inset-x-1 -top-4 bottom-0 rounded-2xl border-[3px] border-ink bg-gradient-to-b from-gold-300 to-gold-700 shadow-chunky-sm"
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                    />
                  )}
                  <motion.div
                    className="relative h-9 w-9"
                    animate={{ y: isActive ? -10 : 0, scale: isActive ? 1.2 : 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 16 }}
                  >
                    {tab.icon}
                  </motion.div>
                  <span
                    className={`relative -mt-1 font-display text-[13px] ${isActive ? 'text-ink' : 'text-outline-sm text-cream'}`}
                  >
                    {tab.label}
                  </span>
                </motion.div>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

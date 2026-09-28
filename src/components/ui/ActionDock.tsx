import type { ReactNode } from 'react';

/**
 * Pins the screen's current actions (answer choices, Next, Fold/Call/Raise…) to the bottom of the
 * viewport so they never need a scroll to reach. Content scrolls underneath with a soft fade.
 * Use `tabs` on screens that show the bottom tab bar so the dock sits just above it.
 */
export function ActionDock({ children, tabs = false, className = '' }: { children: ReactNode; tabs?: boolean; className?: string }) {
  return <div className={`action-dock ${tabs ? 'action-dock-tabs' : ''} ${className}`}>{children}</div>;
}

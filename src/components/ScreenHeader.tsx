import type { ReactNode } from 'react';

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 pb-2">
      <div>
        <h1 className="text-outline font-display text-4xl leading-tight text-gold-300">{title}</h1>
        {subtitle && <p className="text-sm font-bold text-cream/85">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

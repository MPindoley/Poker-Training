export function Slider({ label, value, min, max, step = 1, onChange, format }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <label className="block">
      <div className="flex justify-between font-display text-sm">
        <span>{label}</span>
        <span className="text-gold-300">{format ? format(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 w-full accent-[#f5b820]" />
    </label>
  );
}

export function Readout({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-1 grid grid-cols-2 gap-1.5">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-lg bg-ink/40 px-2 py-1">
          <div className="text-[11px] font-bold text-cream/70">{k}</div>
          <div className="font-display text-base text-gold-300">{v}</div>
        </div>
      ))}
    </div>
  );
}

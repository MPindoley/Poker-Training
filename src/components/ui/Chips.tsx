/** Toggle chips for filters (multi-select) or segmented choices (single-select). */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  multi = false,
  label,
}: {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  multi?: boolean;
  label?: string;
}) {
  return (
    <div>
      {label && <div className="mb-1 font-display text-xs opacity-75">{label}</div>}
      <div className="flex flex-wrap gap-1.5" role={multi ? 'group' : 'radiogroup'}>
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={on}
              onClick={() => onChange(multi ? (on ? value.filter((v) => v !== o.value) : [...value, o.value]) : [o.value])}
              className={`min-h-11 min-w-11 rounded-xl border-2 border-ink px-3 font-display text-sm ${on ? 'bg-gold-500 text-ink shadow-chunky-sm' : 'bg-ink/40 text-cream'}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

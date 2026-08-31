/** Tiny checkbox list for special permissions (label + desc from config). */
export default function SpecialPermCheckboxes({ items, checkedOf, onToggle }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
      {items.map(({ key, label, desc }) => (
        <label key={key} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50/80">
          <input
            type="checkbox"
            checked={Boolean(checkedOf(key))}
            onChange={(e) => onToggle(key, e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
          />
          <span className="flex flex-col gap-0.5 min-w-0">
            <span className="text-sm font-bold text-slate-700 select-none">{label}</span>
            {desc ? (
              <span className="text-[11px] font-medium text-slate-500 leading-snug select-none">{desc}</span>
            ) : null}
          </span>
        </label>
      ))}
    </div>
  );
}

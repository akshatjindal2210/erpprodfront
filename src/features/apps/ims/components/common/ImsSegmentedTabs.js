"use client";

/** Segmented tabs — same style as original IMS list pages. */
export default function ImsSegmentedTabs({ tabs, active, onChange, className = "" }) {
  return (
    <div className={`flex bg-slate-100 p-1 border border-slate-200 shrink-0 ${className}`}>
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`px-3 py-1 text-[10px] font-bold uppercase flex items-center gap-1.5 transition-all ${
            active === id ? "bg-white shadow-sm text-indigo-600" : "text-slate-500 hover:bg-slate-200"
          }`}
        >
          {Icon ? <Icon size={14} /> : null}
          {label}
        </button>
      ))}
    </div>
  );
}

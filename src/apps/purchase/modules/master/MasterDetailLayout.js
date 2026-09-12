"use client";

const box = "border border-slate-200 rounded-none";
const labelSm = "text-[9px] font-bold uppercase tracking-widest mb-1.5";

/** Outer wrapper for all master detail bodies inside `GlobalDetailModal`. */
export function MasterDetailBody({ children }) {
  return <div className="space-y-3">{children}</div>;
}

/**
 * Top block: optional eyebrow, icon, primary title, optional code/badge line.
 */
export function MasterDetailHero({ eyebrow, icon: Icon, title, badge }) {
  return (
    <div className={`bg-slate-50 ${box} p-4 shadow-inner`}>
      {eyebrow ? <p className={`${labelSm} text-slate-400`}>{eyebrow}</p> : null}
      <div className="flex items-start gap-3">
        {Icon ? (
          <div className="shrink-0 w-11 h-11 bg-white border border-slate-200 flex items-center justify-center text-indigo-600">
            <Icon size={20} strokeWidth={2} />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800 tracking-tight leading-snug break-words whitespace-normal hyphens-auto">
            {title?.trim() ? title : "—"}
          </p>
          {badge != null && String(badge).trim() !== "" ? (
            <p className="mt-2 inline-block text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 border border-indigo-100 uppercase tracking-wider">
              {badge}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const toneWrap = {
  slate: "bg-slate-50 border-slate-200",
  white: "bg-white border-slate-200",
  indigo: "bg-indigo-50 border-indigo-100",
  emerald: "bg-emerald-50 border-emerald-200",
};

const toneLabel = {
  slate: "text-slate-400",
  white: "text-slate-400",
  indigo: "text-indigo-500",
  emerald: "text-emerald-700",
};

/** Label + one or more short value lines (uppercase, compact). */
export function MasterDetailSection({ label, tone = "slate", children }) {
  return (
    <div className={`border p-3 rounded-none ${toneWrap[tone]}`}>
      {label ? <p className={`${labelSm} ${toneLabel[tone]}`}>{label}</p> : null}
      <div className="space-y-1 text-xs font-bold text-slate-800 uppercase leading-relaxed">{children}</div>
    </div>
  );
}

/** Label + body text without forced uppercase (remarks, narration). */
export function MasterDetailProse({ label, tone = "slate", children }) {
  return (
    <div className={`border p-3 rounded-none ${toneWrap[tone]}`}>
      {label ? <p className={`${labelSm} ${toneLabel[tone]}`}>{label}</p> : null}
      <div className="text-xs text-slate-600 leading-relaxed">{children}</div>
    </div>
  );
}

export function MasterDetailGrid({ columns = 2, children }) {
  const cols = columns === 3 ? "grid-cols-3" : "grid-cols-1 sm:grid-cols-2";
  return <div className={`grid ${cols} gap-3`}>{children}</div>;
}

export function MasterDetailKV({ label, value, valueClassName = "" }) {
  return (
    <div className={`flex justify-between items-center gap-3 px-3 py-2.5 ${box} bg-white`}>
      <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">{label}</span>
      <span className={`text-xs font-bold text-slate-800 text-right uppercase ${valueClassName}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

/** Horizontal metrics strip (min / max / reorder style). */
export function MasterDetailMetrics({ items = [], columns = 3 }) {
  const cols = columns === 2 ? "grid-cols-2" : "grid-cols-3";
  return (
    <div className={`grid ${cols} gap-0 ${box} overflow-hidden divide-x divide-slate-200`}>
      {items.map((it, i) => (
        <div
          key={i}
          className={`p-3 text-center ${it.emphasis ? "bg-amber-50" : "bg-white"}`}
        >
          <p className={`text-[9px] font-bold uppercase mb-1 ${it.emphasis ? "text-amber-600" : "text-slate-400"}`}>
            {it.label}
          </p>
          <p className={`text-sm font-bold tabular-nums ${it.emphasis ? "text-amber-700" : "text-slate-700"}`}>
            {it.value ?? "—"}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Pill / badge status on a single row inside the same box style as KV. */
export function MasterDetailStatusRow({ label, children }) {
  return (
    <div className={`flex justify-between items-center gap-3 px-3 py-2.5 ${box} bg-white`}>
      <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">{label}</span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

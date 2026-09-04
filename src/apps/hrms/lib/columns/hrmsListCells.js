/** Shared HRMS DataTable cell renderers (IMS-style). */

export function hrmsEmpty(v) {
  if (v === 0) return <span className="text-[10px] text-slate-600 tabular-nums">0</span>;
  if (v == null || v === "") return <span className="text-[10px] text-slate-400">—</span>;
  return <span className="text-[10px] text-slate-600">{String(v)}</span>;
}

export function hrmsEmpCodeCell(v) {
  return <span className="font-mono text-indigo-600 font-bold text-[10px] uppercase">{v || "—"}</span>;
}

export function hrmsNameCell(v) {
  return <span className="font-bold text-slate-800 text-[11px]">{v || "—"}</span>;
}

export function hrmsTimeCell(v) {
  return <span className="text-[10px] text-emerald-600 font-bold tabular-nums">{v || "—"}</span>;
}

export function hrmsMutedTimeCell(v) {
  return <span className="text-[10px] text-slate-500 tabular-nums">{v || "—"}</span>;
}

export function hrmsDateCell(v) {
  return <span className="text-[10px] text-slate-600 font-medium tabular-nums">{v || "—"}</span>;
}

export function hrmsStatusCell(v) {
  return (
    <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-slate-50 text-slate-600 border-slate-200">
      {v || "—"}
    </span>
  );
}

export function hrmsPresentCell(v) {
  const ok = String(v ?? "").toLowerCase() === "present";
  return (
    <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${ok ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {v || "—"}
    </span>
  );
}

export function hrmsCountCell(v) {
  return <span className="font-bold text-slate-700 text-[11px] tabular-nums">{v ?? "—"}</span>;
}

export function hrmsApproveCell(v) {
  const ok = String(v ?? "").toLowerCase() === "approved";
  return (
    <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${ok ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
      {v || "—"}
    </span>
  );
}

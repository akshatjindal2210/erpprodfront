/** IMS list-table cell styles (Box / Store Out / Gate Entry). */
import { formatDateTime } from "@/platform/utils/core/utilHelper";

export function hrmsEmpty(v) {
  if (v === 0) return <span className="text-[10px] font-bold text-slate-700 tabular-nums">0</span>;
  if (v == null || v === "") return <span className="text-[10px] text-slate-400">—</span>;
  return <span className="text-[10px] font-bold text-slate-700">{String(v)}</span>;
}

export function hrmsEmpCodeCell(v) {
  return <span className="font-mono text-indigo-600 font-bold text-[10px] uppercase">{v || "—"}</span>;
}

export function hrmsNameCell(v) {
  return <span className="font-bold text-slate-800 text-[11px] uppercase tracking-tight">{v || "—"}</span>;
}

export function hrmsTimeCell(v) {
  return <span className="text-[10px] font-bold text-slate-700 tabular-nums">{v || "—"}</span>;
}

export function hrmsMutedTimeCell(v) {
  return <span className="text-[10px] font-bold text-slate-700 tabular-nums">{v || "—"}</span>;
}

export function hrmsDateCell(v) {
  return <span className="text-[10px] font-bold text-slate-700 tabular-nums">{v || "—"}</span>;
}

export function hrmsStatusCell(v) {
  return (
    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border bg-slate-50 text-slate-600 border-slate-200">
      {v || "—"}
    </span>
  );
}

export function hrmsPresentCell(v) {
  const ok = String(v ?? "").toLowerCase() === "present";
  return (
    <span
      className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${
        ok ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      {v || "—"}
    </span>
  );
}

export function hrmsCountCell(v) {
  return <span className="font-bold text-slate-700 text-[11px] tabular-nums">{v ?? "—"}</span>;
}

export function hrmsMachineSyncCell(v) {
  if (!v) return null;
  const synced = String(v).toLowerCase() === "synced";
  if (!synced) return null;
  return (
    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-600 border-emerald-100">
      {v}
    </span>
  );
}

export function hrmsApproveCell(v) {
  const ok = String(v ?? "").toLowerCase() === "approved";
  return (
    <span
      className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border ${
        ok ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"
      }`}
    >
      {v || "—"}
    </span>
  );
}

/** Audit: Created/Updated/Approved By — same style as IMS shortage. */
export function hrmsAuditBy(v) {
  return <span className="text-[10px] text-slate-500">{v || "—"}</span>;
}

/** Audit: Created/Updated/Approved At — same style as IMS shortage. */
export function hrmsAuditAt(v) {
  if (v == null || v === "") return <span className="text-[10px] text-slate-400 font-medium">—</span>;
  const label = typeof v === "string" && !/^\d{4}-\d{2}-\d{2}/.test(v) ? v : formatDateTime(v);
  return <span className="text-[10px] text-slate-400 font-medium">{label || "—"}</span>;
}

/** Prefer `key_display` then raw `key` (leave/loan/gate-pass list rows). */
export function hrmsAuditAtField(row, key) {
  return hrmsAuditAt(row?.[`${key}_display`] ?? row?.[key]);
}

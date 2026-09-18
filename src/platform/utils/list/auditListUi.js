"use client";

/** ...auditHeaders() | auditPair("Verified", "verified_by", "verified_at") | formatAuditPersonName(name) */
import { formatDateTime } from "@/platform/utils/core/utilHelper";

const alignCls = (a) => ({ left: "text-left", right: "text-right", center: "text-center" }[a] || "text-left");

export function formatAuditPersonName(name) {
  const s = String(name ?? "").trim();
  return s ? s.split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1).toLowerCase()).join(" ") : "";
}

export function auditNameCell(v, align = "left", nameClass = "text-slate-500") {
  return <span className={`block w-full min-w-0 truncate text-[10px] ${nameClass} ${alignCls(align)}`}>{formatAuditPersonName(v) || "—"}</span>;
}

export function auditTimeCell(v, align = "left") {
  return <span className={`block w-full min-w-0 whitespace-nowrap text-[10px] text-slate-400 font-medium tabular-nums ${alignCls(align)}`}>{formatDateTime(v)}</span>;
}

const auditWhen = (when, row) => !when || (typeof when === "function" ? when(row) : row?.[when]);

export function auditNameHeader(label, key, { width = "110px", align = "left", when, nameClass = "text-slate-500" } = {}) {
  const render = (v, row) => auditNameCell(auditWhen(when, row) ? v : null, align, nameClass);
  return [label, key, when ? render : (v) => auditNameCell(v, align, nameClass), { width, align, copyValue: (r) => (auditWhen(when, r) ? formatAuditPersonName(r?.[key]) : "") || "—" }];
}

export function auditTimeHeader(label, key, { width = "150px", align = "left", hideUnlessNameKey: hideKey, when } = {}) {
  const copyValue = (r) => (!auditWhen(when, r) || (hideKey && !String(r?.[hideKey] ?? "").trim()) ? "—" : formatDateTime(r?.[key]));
  const render = (v, row) => auditTimeCell(!auditWhen(when, row) || (hideKey && !row?.[hideKey]) ? null : v, align);
  return [label, key, when || hideKey ? render : (v) => auditTimeCell(v, align), { width, align, copyValue }];
}

/** Custom DB keys — name/time alag ho to bhi chalega */
export function auditPair(label, nameKey, timeKey, opts = {}) {
  const { hideUnlessNameKey, ...rest } = opts;
  const timeOpts = hideUnlessNameKey != null ? { ...rest, hideUnlessNameKey } : rest;
  return [auditNameHeader(`${label} By`, nameKey, rest), auditTimeHeader(`${label} At`, timeKey, timeOpts)];
}

const mk = (label, base, timeOpts) => auditPair(label, `${base}_by_name`, `${base}_at`, timeOpts);

const GROUPS = {
  created: mk("Created", "created"),
  updated: mk("Updated", "updated", { hideUnlessNameKey: "updated_by_name" }),
  approved: mk("Approved", "approved"),
};

export function auditHeaders(groups = ["created", "updated", "approved"]) {
  return groups.flatMap((g) => GROUPS[g] || []);
}

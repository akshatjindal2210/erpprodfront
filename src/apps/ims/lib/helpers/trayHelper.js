import { parseTrayScan } from "@/apps/ims/lib/helpers/qrScan";
import { normalizeTrayViewRow, pickTrayFromViewsResponse } from "@/apps/ims/lib/helpers/trayViewsLookup";
import { trayService } from "@/apps/ims/lib/services/tray";
import { helperPerms } from "@/apps/ims/lib/helpers/helperPerms";

const STATUS_META = {
  pending: { label: "Pending", badgeClass: "bg-amber-50 text-amber-700 border-amber-100", actionLabel: "Pending", buttonClass: "bg-amber-600 hover:bg-amber-700" },
  active: { label: "Active", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-100", actionLabel: "Activate", buttonClass: "bg-emerald-600 hover:bg-emerald-700" },
  inactive: { label: "Inactive", badgeClass: "bg-slate-100 text-slate-600 border-slate-200", actionLabel: "Mark Inactive", buttonClass: "bg-slate-700 hover:bg-slate-800" },
  discard: { label: "Discard", badgeClass: "bg-orange-50 text-orange-700 border-orange-100", actionLabel: "Discard", buttonClass: "bg-orange-600 hover:bg-orange-700" },
  deleted: { label: "Deleted", badgeClass: "bg-rose-50 text-rose-700 border-rose-100", actionLabel: "Delete", buttonClass: "bg-rose-600 hover:bg-rose-700" },
};

export function normalizeTrayStatus(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "active";
  if (raw === "discarded") return "discard";
  if (raw === "deactivate" || raw === "deactive") return "inactive";
  return raw;
}

export function getTrayStatusMeta(status) {
  return STATUS_META[normalizeTrayStatus(status)] || STATUS_META.active;
}

export function isTrayApproved(row) {
  if (row == null) return false;
  const value = row.approved;
  return value === true || value === 1 || String(value).toLowerCase() === "true";
}

export function isTrayUsable(row) {
  return normalizeTrayStatus(row?.status) === "active" && isTrayApproved(row);
}

export function isTrayHeld(row) {
  const status = normalizeTrayStatus(row?.status);
  return status === "inactive" || status === "discard";
}

export function isTrayInUse(row) {
  if (row?.box_uid) return true;
  const pool = String(row?.pool_status || "").trim().toLowerCase();
  return Boolean(pool) && pool !== "vacant";
}

export function isTrayDeleted(row) {
  return normalizeTrayStatus(row?.status) === "deleted";
}

export function getTrayEffectiveStatus(row) {
  const status = normalizeTrayStatus(row?.status);
  if (status === "inactive" || status === "discard" || status === "deleted") return status;
  if (!isTrayApproved(row)) return "pending";
  return "active";
}

export function isTrayPrintable(row) {
  return isTrayUsable(row) && isTrayApproved(row);
}

/** FG1, FG2, … FG10 — type then serial, not lexicographic code. */
export function sortTraysAsc(rows = []) {
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const typeCmp = String(a?.type || "").localeCompare(String(b?.type || ""), undefined, { sensitivity: "base" });
    if (typeCmp) return typeCmp;
    const sa = Number(a?.serial_number);
    const sb = Number(b?.serial_number);
    if (Number.isFinite(sa) && Number.isFinite(sb) && sa !== sb) return sa - sb;
    return String(a?.code || "").localeCompare(String(b?.code || ""), undefined, { numeric: true, sensitivity: "base" });
  });
}

export function getBatchPendingCount(batch, trays = []) {
  const fromBatch = Number(batch?.pending_count);
  if (Number.isFinite(fromBatch) && fromBatch >= 0) return fromBatch;
  if (isTrayApproved(batch) || (trays.length && isTrayApproved(trays[0]))) return 0;
  return trays.filter((row) => !isTrayHeld(row) && !isTrayDeleted(row)).length;
}

export function getBatchHeldCount(batch, trays = []) {
  const fromBatch = Number(batch?.inactive_count || 0);
  if (fromBatch > 0) return fromBatch;
  return trays.filter((row) => isTrayHeld(row)).length;
}

export function getBatchNonDeletedCount(batch, trays = []) {
  const deleted = Number(batch?.deleted_count || 0);
  const total = Number(batch?.tray_count || trays.length || 0);
  if (total > 0) return Math.max(0, total - deleted);
  return trays.filter((row) => !isTrayDeleted(row)).length;
}

export async function fetchTrayByScan(rawScan, pageModule, action = "view") {
  const { code, id } = parseTrayScan(rawScan);
  if (!code && !id) return null;
  const res = await trayService.getViews({ ...(id ? { id } : {}), ...(code ? { code } : {}), ...helperPerms(pageModule, action) });
  return normalizeTrayViewRow(pickTrayFromViewsResponse(res));
}

export async function fetchTrayViews(pageModule, params = {}, action = "view") {
  const res = await trayService.getViews({ page: 1, limit: 5000, sortBy: "serial_number", order: "ASC", ...params, ...helperPerms(pageModule, action) });
  const list = Array.isArray(res?.data) ? res.data : [];
  return { ...res, data: list.map(normalizeTrayViewRow).filter(Boolean) };
}

export async function fetchTrayById(trayId, pageModule, action = "view") {
  if (trayId == null || String(trayId).trim() === "") return null;
  const res = await trayService.getViews({ id: trayId, ...helperPerms(pageModule, action) });
  return normalizeTrayViewRow(pickTrayFromViewsResponse(res));
}

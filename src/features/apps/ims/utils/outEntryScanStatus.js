/** Out Entry status — same keys/labels for filter dropdown and table badge. */

import { getOutEntryTypeLabel, OUT_ENTRY_TYPE } from "@/features/apps/ims/utils/outEntryTypes";



export const OUT_ENTRY_STATUS = {

  authorized: {

    key: "authorized",

    filterLabel: "Authorized",

    badgeLabel: "AUTHORIZED",

    className: "bg-emerald-50 text-emerald-600 border-emerald-100",

  },

  pending: {

    key: "pending",

    filterLabel: "Pending",

    badgeLabel: "PENDING",

    className: "bg-slate-50 text-slate-600 border-slate-200",

  },

  draft: {

    key: "draft",

    filterLabel: "Draft",

    badgeLabel: "DRAFT",

    className: "bg-amber-50 text-amber-700 border-amber-200",

  },

};



export const OUT_ENTRY_STATUS_FILTER_OPTIONS = [

  { label: "All Status", value: "all" },

  { label: OUT_ENTRY_STATUS.draft.filterLabel, value: OUT_ENTRY_STATUS.draft.key },

  { label: OUT_ENTRY_STATUS.pending.filterLabel, value: OUT_ENTRY_STATUS.pending.key },

  { label: OUT_ENTRY_STATUS.authorized.filterLabel, value: OUT_ENTRY_STATUS.authorized.key },

];


export const OUT_ENTRY_TYPE_FILTER_OPTIONS = [
  { label: "All Types", value: "all" },
  { label: getOutEntryTypeLabel(OUT_ENTRY_TYPE.FORWARDING_NOTE), value: OUT_ENTRY_TYPE.FORWARDING_NOTE },
  { label: getOutEntryTypeLabel(OUT_ENTRY_TYPE.INVENTORY_OUT), value: OUT_ENTRY_TYPE.INVENTORY_OUT },
  { label: getOutEntryTypeLabel(OUT_ENTRY_TYPE.PACKING_AREA), value: OUT_ENTRY_TYPE.PACKING_AREA },
];



/** @returns {"authorized"|"pending"|"draft"|null} */

export function getOutEntryStatusKey(row) {

  if (!row) return null;

  if (row.approved === true || row.approved === "true" || row.approved === 1) {

    return OUT_ENTRY_STATUS.authorized.key;

  }

  if (isOutEntryScanDraft(row)) return OUT_ENTRY_STATUS.draft.key;

  return OUT_ENTRY_STATUS.pending.key;

}



/** Server-backed scan draft (incomplete box scan). */

export function isOutEntryScanDraft(row) {

  if (!row) return false;

  if (row.approved === true || row.approved === "true" || row.approved === 1) return false;

  if (row.scan_complete === true || row.scan_complete === "true" || row.scan_complete === 1) {

    return false;

  }

  return true;

}



export function outEntryScanProgressLabel(row) {
  const scanned = Number(row?.boxes_scanned) || 0;
  const required = Number(row?.boxes_required) || 0;
  const packingCount = Number(row?.packing_count) || 0;
  const itemCount = Number(row?.item_count) || 0;
  const parts = [];
  if (itemCount > 1) parts.push(`${itemCount} items`);
  if (packingCount > 1) parts.push(`${packingCount} packings`);
  const suffix = parts.length ? ` · ${parts.join(", ")}` : "";
  if (!required) return `${scanned} scanned${suffix}`;
  return `${scanned} / ${required} boxes${suffix}`;
}



export function outEntryStatusLabel(row) {

  const key = getOutEntryStatusKey(row);

  const cfg = key ? OUT_ENTRY_STATUS[key] : OUT_ENTRY_STATUS.pending;

  return { text: cfg.badgeLabel, className: cfg.className };

}



/** API list filters aligned with status keys. */

export function buildOutEntryListFilters(status) {

  if (status === OUT_ENTRY_STATUS.authorized.key) return { approved: true };

  if (status === OUT_ENTRY_STATUS.draft.key) {

    return { approved: false, scan_complete: false };

  }

  if (status === OUT_ENTRY_STATUS.pending.key) {

    return { approved: false, scan_complete: true };

  }

  return {};

}



export function matchesOutEntryStatusFilter(row, status) {

  if (!status || status === "all") return true;

  const legacy =

    status === "approved" ? OUT_ENTRY_STATUS.authorized.key : status;

  return getOutEntryStatusKey(row) === legacy;

}



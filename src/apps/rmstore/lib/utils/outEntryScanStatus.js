/** RM Store Out status — draft / pending / authorized (mirrors IMS scan status). */

export const RM_OUT_ENTRY_STATUS = {
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

export const RM_OUT_ENTRY_STATUS_FILTER_OPTIONS = [
  { label: "All Status", value: "all" },
  { label: RM_OUT_ENTRY_STATUS.draft.filterLabel, value: RM_OUT_ENTRY_STATUS.draft.key },
  { label: RM_OUT_ENTRY_STATUS.pending.filterLabel, value: RM_OUT_ENTRY_STATUS.pending.key },
  { label: RM_OUT_ENTRY_STATUS.authorized.filterLabel, value: RM_OUT_ENTRY_STATUS.authorized.key },
];

export function isRmOutEntryScanDraft(row) {
  if (!row) return false;
  if (row.approved === true || row.approved === "true" || row.approved === 1) return false;
  if (row.scan_complete === true || row.scan_complete === "true" || row.scan_complete === 1) {
    return false;
  }
  return true;
}

export function getRmOutEntryStatusKey(row) {
  if (!row) return null;
  if (row.approved === true || row.approved === "true" || row.approved === 1) {
    return RM_OUT_ENTRY_STATUS.authorized.key;
  }
  if (isRmOutEntryScanDraft(row)) return RM_OUT_ENTRY_STATUS.draft.key;
  return RM_OUT_ENTRY_STATUS.pending.key;
}

export function rmOutEntryStatusLabel(row) {
  const key = getRmOutEntryStatusKey(row);
  const cfg = key ? RM_OUT_ENTRY_STATUS[key] : RM_OUT_ENTRY_STATUS.pending;
  return { text: cfg.badgeLabel, className: cfg.className };
}

/** API list filters aligned with status keys. */
export function buildRmOutEntryListFilters(status) {
  if (status === RM_OUT_ENTRY_STATUS.authorized.key) return { approved: true };
  if (status === RM_OUT_ENTRY_STATUS.draft.key) {
    return { approved: false, scan_complete: false };
  }
  if (status === RM_OUT_ENTRY_STATUS.pending.key) {
    return { approved: false, scan_complete: true };
  }
  return {};
}

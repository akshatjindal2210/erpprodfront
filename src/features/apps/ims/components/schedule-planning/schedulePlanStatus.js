export const SCHEDULE_PLAN_STATUS = {
  PENDING: 0,
  PLANNED: 1,
  RUNNING: 2,
  COMPLETE: 3,
  REJECT: 4,
  DELETE: 5,
  HOLD: 6,
};

export const SCHEDULE_PLAN_STATUS_LABEL = {
  0: "Pending",
  1: "Planned",
  2: "Running",
  3: "Complete",
  4: "Reject",
  6: "Hold",
};

/** List page filter values (sent to API as status). */
export const SCHEDULE_LIST_FILTER = {
  PENDING: "pending",
  SCHEDULE: "schedule",
  COMPLETE: "complete",
  COMPARISON: "comparison",
  ALL: "all",
  REJECT: "reject",
  HOLD: "hold",
};

export const SCHEDULE_STATUS_FILTER_OPTIONS = [
  { value: SCHEDULE_LIST_FILTER.PENDING, label: "Pending" },
  { value: SCHEDULE_LIST_FILTER.SCHEDULE, label: "Schedule" },
  { value: SCHEDULE_LIST_FILTER.HOLD, label: "Hold" },
  { value: SCHEDULE_LIST_FILTER.COMPLETE, label: "Complete" },
  { value: SCHEDULE_LIST_FILTER.COMPARISON, label: "Comparison" },
  { value: SCHEDULE_LIST_FILTER.ALL, label: "All" },
  { value: SCHEDULE_LIST_FILTER.REJECT, label: "Reject" },
];

/** Report view — Default = current list; Custom = customer report (coming soon). */
export const SCHEDULE_REPORT_FILTER = {
  DEFAULT: "default",
  CUSTOM: "custom",
};

export const SCHEDULE_REPORT_FILTER_OPTIONS = [
  { value: SCHEDULE_REPORT_FILTER.DEFAULT, label: "Default" },
  { value: SCHEDULE_REPORT_FILTER.CUSTOM, label: "Custom" },
];

export function statusLabel(code) {
  return SCHEDULE_PLAN_STATUS_LABEL[Number(code)] ?? "Pending";
}

export function isPendingListFilter(status) {
  const s = String(status ?? SCHEDULE_LIST_FILTER.PENDING).toLowerCase();
  return s === SCHEDULE_LIST_FILTER.PENDING || s === "0";
}

export function isDbRow(row) {
  if (!row) return false;
  if (row.plan_id) return true;
  const st = Number(row.is_planned);
  return Number.isFinite(st) && st !== SCHEDULE_PLAN_STATUS.PENDING;
}

export function canDeleteRow(row) {
  if (!row) return false;
  if (Array.isArray(row._items)) {
    return row._items.some((i) => isDbRow(i));
  }
  return isDbRow(row);
}

export function canOpenPlanModal(status) {
  const s = String(status ?? SCHEDULE_LIST_FILTER.PENDING).toLowerCase();
  return [
    SCHEDULE_LIST_FILTER.PENDING,
    SCHEDULE_LIST_FILTER.SCHEDULE,
    SCHEDULE_LIST_FILTER.REJECT,
    SCHEDULE_LIST_FILTER.HOLD,
    SCHEDULE_LIST_FILTER.ALL,
  ].includes(s);
}

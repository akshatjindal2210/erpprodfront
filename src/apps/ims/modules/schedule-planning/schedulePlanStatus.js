/**
 * ims_schedule_plan.is_planned codes.
 *
 * 0 = Pending (IMS default / not yet authorized)
 * 7 = Ready to Dispatch (approve step)
 * 1 = Planned … 6 = Hold (unchanged)
 */
export const SCHEDULE_PLAN_STATUS = {
  PENDING: 0,
  PLANNED: 1,
  RUNNING: 2,
  COMPLETE: 3,
  REJECT: 4,
  DELETE: 5,
  HOLD: 6,
  READY_TO_DISPATCH: 7,
};

export const SCHEDULE_PLAN_STATUS_LABEL = {
  0: "Pending",
  1: "Planned",
  2: "Running",
  3: "Complete",
  4: "Reject",
  6: "Hold",
  7: "Ready to Dispatch",
};

export const SCHEDULE_LIST_FILTER = {
  ALL: "all",
  PENDING: "pending",
  READY_TO_DISPATCH: "ready_to_dispatch",
  /** Sales default: Hold + Reject */
  PENDING_HOLD_REJECT: "pending_hold_reject",
  HOLD: "hold",
  PLAN: "plan",
  REJECT: "reject",
  COMPLETE: "complete",
  COMPARISON: "comparison",
};

/** All status filters available to everyone (defaults differ by role). */
export const SCHEDULE_STATUS_FILTER_OPTIONS = [
  { value: SCHEDULE_LIST_FILTER.ALL, label: "All" },
  // { value: SCHEDULE_LIST_FILTER.PENDING, label: "Pending" }, // hidden — default is Ready to Dispatch
  { value: SCHEDULE_LIST_FILTER.READY_TO_DISPATCH, label: "Ready to Dispatch" },
  { value: SCHEDULE_LIST_FILTER.PENDING_HOLD_REJECT, label: "Hold / Reject" },
  { value: SCHEDULE_LIST_FILTER.PLAN, label: "Plan" },
  { value: SCHEDULE_LIST_FILTER.HOLD, label: "Hold" },
  { value: SCHEDULE_LIST_FILTER.REJECT, label: "Reject" },
  { value: SCHEDULE_LIST_FILTER.COMPLETE, label: "Complete" },
  { value: SCHEDULE_LIST_FILTER.COMPARISON, label: "Comparison" },
];

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

/** Row saved in our DB (has plan_id). */
export function isDbRow(row) {
  if (!row) return false;
  if (row.plan_id != null && String(row.plan_id).trim() !== "") return true;
  return row.in_db === true;
}

export function canDeleteRow(row) {
  if (!row) return false;
  if (Array.isArray(row._items)) {
    return row._items.some((i) => isDbRow(i));
  }
  return isDbRow(row);
}

/**
 * Modal rows by permission:
 * - APPROVE → Pending / Ready / Planned / Running / Reject / Hold
 * - ADD → Ready / Planned / Running (Plan after approve Ready)
 */
export function filterScheduleItemsForPermission(items, { canAdd = false, canApprove = false } = {}) {
  const list = Array.isArray(items) ? items : [];
  const withoutComplete = (row) => {
    if (!isDbRow(row)) return true;
    return Number(row?.is_planned) !== SCHEDULE_PLAN_STATUS.COMPLETE;
  };

  if (canAdd && canApprove) return list.filter(withoutComplete);

  if (canApprove && !canAdd) {
    return list.filter((row) => {
      if (!isDbRow(row)) return true;
      const st = Number(row?.is_planned ?? SCHEDULE_PLAN_STATUS.PENDING);
      return (
        st === SCHEDULE_PLAN_STATUS.PENDING ||
        st === SCHEDULE_PLAN_STATUS.READY_TO_DISPATCH ||
        st === SCHEDULE_PLAN_STATUS.PLANNED ||
        st === SCHEDULE_PLAN_STATUS.RUNNING ||
        st === SCHEDULE_PLAN_STATUS.REJECT ||
        st === SCHEDULE_PLAN_STATUS.HOLD
      );
    });
  }

  if (canAdd && !canApprove) {
    return list.filter((row) => {
      if (!isDbRow(row)) return true;
      const st = Number(row?.is_planned ?? SCHEDULE_PLAN_STATUS.PENDING);
      return (
        st === SCHEDULE_PLAN_STATUS.READY_TO_DISPATCH ||
        st === SCHEDULE_PLAN_STATUS.PLANNED ||
        st === SCHEDULE_PLAN_STATUS.RUNNING
      );
    });
  }

  return list.filter(withoutComplete);
}

export function canOpenPlanModal(status) {
  const s = String(status ?? SCHEDULE_LIST_FILTER.READY_TO_DISPATCH).toLowerCase();
  return [
    SCHEDULE_LIST_FILTER.PENDING,
    SCHEDULE_LIST_FILTER.READY_TO_DISPATCH,
    SCHEDULE_LIST_FILTER.PENDING_HOLD_REJECT,
    SCHEDULE_LIST_FILTER.PLAN,
    SCHEDULE_LIST_FILTER.REJECT,
    SCHEDULE_LIST_FILTER.HOLD,
    SCHEDULE_LIST_FILTER.ALL,
  ].includes(s);
}

/** ADD can Plan / Reject / Complete from Ready / Planned / Running. */
export function isAddWorkableStatus(status) {
  const s = Number(status);
  return (
    s === SCHEDULE_PLAN_STATUS.READY_TO_DISPATCH ||
    s === SCHEDULE_PLAN_STATUS.PLANNED ||
    s === SCHEDULE_PLAN_STATUS.RUNNING
  );
}

export function isHoldStatus(status) {
  return Number(status) === SCHEDULE_PLAN_STATUS.HOLD;
}

export function isHoldDueOrPast(row, todayYmd) {
  if (Number(row?.is_planned) !== SCHEDULE_PLAN_STATUS.HOLD) return false;
  const raw = row?.action_date ?? row?.last_action_date ?? null;
  if (!raw) return false;
  let d = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) d = d.slice(0, 10);
  else {
    const parts = d.split("/");
    if (parts.length === 3) {
      let [dd, mm, y] = parts.map((p) => p.trim());
      if (y.length === 2) y = `20${y}`;
      d = `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    } else return false;
  }
  const today = String(todayYmd || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !today) return false;
  return d <= today;
}

export function canHoldFromStatus(status) {
  if (status == null || status === "") return true;
  const s = Number(status);
  return [
    SCHEDULE_PLAN_STATUS.PENDING,
    SCHEDULE_PLAN_STATUS.READY_TO_DISPATCH,
    SCHEDULE_PLAN_STATUS.PLANNED,
    SCHEDULE_PLAN_STATUS.RUNNING,
    SCHEDULE_PLAN_STATUS.REJECT,
    SCHEDULE_PLAN_STATUS.HOLD,
  ].includes(s);
}

export function canReadyFromStatus(status) {
  if (status == null || status === "") return true;
  const s = Number(status);
  return [
    SCHEDULE_PLAN_STATUS.PENDING,
    SCHEDULE_PLAN_STATUS.READY_TO_DISPATCH,
    SCHEDULE_PLAN_STATUS.HOLD,
    SCHEDULE_PLAN_STATUS.REJECT,
    SCHEDULE_PLAN_STATUS.PLANNED,
    SCHEDULE_PLAN_STATUS.RUNNING,
  ].includes(s);
}

export function isSalesDepartmentUser(user) {
  const dept = user?.department;
  const name = String(
    (typeof dept === "object" && dept != null ? dept.name : dept) ||
      user?.department_name ||
      ""
  )
    .trim()
    .toLowerCase();
  return name === "sales" || name.includes("sales");
}

/** Default list filter: Sales + Authorize → Hold/Reject; else Ready to Dispatch. */
export function getDefaultScheduleStatusFilter({
  canAdd = false,
  canApprove = false,
  isSalesDepartment = false,
  isSuperAdmin = false,
} = {}) {
  void canAdd;
  void isSuperAdmin;
  if (isSalesDepartment && canApprove) return SCHEDULE_LIST_FILTER.PENDING_HOLD_REJECT;
  return SCHEDULE_LIST_FILTER.READY_TO_DISPATCH;
}

/** Completed items are locked — Plan / Reject no longer available. */
export function isScheduleCompleteStatus(status) {
  return Number(status) === SCHEDULE_PLAN_STATUS.COMPLETE;
}

export function scheduleBalanceQty(row) {
  const raw = row?.balance_qty;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (Number.isFinite(n)) return n;
  const parsed = Number(String(raw).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

/** balance_qty <= 0 → Complete (Plan / Running / Ready). Manual Complete bhi. */
export function isScheduleCompleteRow(row) {
  const st = Number(row?.db_is_planned ?? row?.is_planned ?? SCHEDULE_PLAN_STATUS.PENDING);
  const bal = scheduleBalanceQty(row);
  if (st === SCHEDULE_PLAN_STATUS.COMPLETE) return true;
  if (
    st === SCHEDULE_PLAN_STATUS.REJECT ||
    st === SCHEDULE_PLAN_STATUS.HOLD ||
    st === SCHEDULE_PLAN_STATUS.PENDING
  ) {
    return false;
  }
  if (bal != null && bal <= 0) return true;
  return false;
}

/** Plan tab: Plan/Running + balance_qty > 0. */
export function isScheduleOpenPlanRow(row) {
  const st = Number(row?.db_is_planned ?? row?.is_planned ?? SCHEDULE_PLAN_STATUS.PENDING);
  const bal = scheduleBalanceQty(row);
  if (!(st === SCHEDULE_PLAN_STATUS.PLANNED || st === SCHEDULE_PLAN_STATUS.RUNNING)) return false;
  if (bal == null) return true;
  return bal > 0;
}

/** Status badge / row color — Complete when manual Complete or balance 0. */
export function resolveScheduleDisplayStatus(row) {
  if (isScheduleCompleteRow(row)) return SCHEDULE_PLAN_STATUS.COMPLETE;
  return Number(row?.db_is_planned ?? row?.is_planned ?? SCHEDULE_PLAN_STATUS.PENDING);
}

/** Everyone sees all filter options; defaults differ by role. */
export function getScheduleStatusFilterOptions() {
  return SCHEDULE_STATUS_FILTER_OPTIONS;
}

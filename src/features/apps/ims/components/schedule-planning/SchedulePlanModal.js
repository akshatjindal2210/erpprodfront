"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Save, Loader2, History, PackageMinus, Calendar } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/core/components/ui/Drawer";
import { filterDateToDisplay, formatDateTypingInput, parseFilterDateInput } from "@/core/utils/utilHelper";
import { schedulePlanningService } from "@/features/apps/ims/services/schedulePlanning";
import { getSelectedFinancialYear } from "@/features/apps/ims/helpers/financialYear";
import { SCHEDULE_PLAN_STATUS, isDbRow, isAddWorkableStatus, isScheduleCompleteStatus } from "./schedulePlanStatus";
import SchedulePlanHistoryModal from "./SchedulePlanHistoryModal";
import ScheduleShortageModal from "./ScheduleShortageModal";
import { scheduleItemRowKey, formatSchHeaderDate, formatPreviousPlanDates, ScheduleCustRequestCell, remarkDateToInputValue, schMonthLabel, ScheduleStatusBadge, getScheduleTargetDateRange, isScheduleTargetDateAllowed, formatScheduleTargetDateHint } from "./schedulePlanningColumns";
import { IMS_MODAL_LABEL, IMS_TABLE_CELL_NUMBER, IMS_TABLE_CELL_TEXT } from "@/features/apps/ims/helpers/listPageShellClasses";

const ROW_STATUS = {
  UNCHANGED: "unchanged",
  PENDING: "pending",
  PLAN: "plan",
  READY: "ready",
  HOLD: "hold",
  REJECT: "reject",
  COMPLETE: "complete",
};
const PICK_OTHER = "__other__";
const INPUT = "h-7 px-1.5 text-[11px] text-slate-800 border border-slate-200 rounded-none focus:border-indigo-500 outline-none bg-white";
const REJECT_INPUT = `${INPUT} w-full focus:border-rose-500`;
const FIELD_ERROR_CLASS = "border-rose-500 bg-rose-50 ring-2 ring-rose-200 focus:border-rose-600 focus-within:border-rose-600";
const SELECT = `${INPUT} w-full`;
const BTN = "h-7 px-2 text-[10px] font-bold uppercase border border-slate-300 rounded-none hover:bg-slate-50 disabled:opacity-40 text-slate-700";
const ICON_BTN = "h-7 w-full px-1 text-[10px] font-bold uppercase border border-slate-300 rounded-none hover:bg-slate-50 flex items-center justify-center gap-1 disabled:opacity-40 text-slate-700";

function DetailField({ label, value, wide = false }) {
  return (
    <div className={wide ? "min-w-0 sm:col-span-2 lg:col-span-4" : "min-w-0"}>
      <span className={`${IMS_MODAL_LABEL} block mb-1`}>{label}</span>
      <span className={`${IMS_TABLE_CELL_TEXT} text-[12px] text-slate-800 break-words leading-snug block`}>{value ?? "—"}</span>
    </div>
  );
}

function ScheduleDetailsCard({ schedule, singleItem, canApprove = false, canAdd = false }) {
  const items = schedule?._items ?? [];
  const itemCount = schedule?.item_count ?? items.length;
  const heading =
    canApprove && !canAdd
      ? singleItem
        ? "Authorize item — Hold or Ready to Dispatch"
        : "Authorize schedule — Hold or Ready to Dispatch"
      : canAdd && !canApprove
        ? singleItem
          ? "Plan item — Plan / Reject"
          : "Schedule plan — Plan / Reject"
        : singleItem
          ? "Item plan"
          : "Schedule plan";

  return (
    <div className="border border-slate-200 bg-white shadow-sm rounded-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <div className="w-1 h-4 bg-indigo-500 rounded-full shrink-0" />
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
          {heading}
        </span>
        {!singleItem ? (
          <span className="ml-auto text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 uppercase">
            {itemCount} items
          </span>
        ) : null}
      </div>
      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3">
        <DetailField label="Sch No" value={schedule?.schno} />
        <DetailField label="Schedule Date" value={formatSchHeaderDate(schedule?.schdt)} />
        <DetailField label="Month" value={schMonthLabel(schedule?.schmonth)} />
        <DetailField label="Customer" value={schedule?.acc_name} />
        {singleItem ? (
          <>
            <DetailField label="Item" value={items[0]?.item_code} />
            <DetailField label="Cust. Item Code" value={items[0]?.custitemcode} />
            {items[0]?.itemdesc ? (
              <div className="sm:col-span-2 lg:col-span-3 min-w-0">
                <span className={`${IMS_MODAL_LABEL} block mb-1`}>Description</span>
                <span className={`${IMS_TABLE_CELL_TEXT} text-[12px] text-slate-800 leading-snug break-words block`}>{items[0].itemdesc}</span>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function ScheduleTargetDateField({ value, onChange, className = "", placeholder = "DD/MM/YYYY", minDate, maxDate, onOutOfRange, hasError = false, title }) {
  const [text, setText] = useState(() => filterDateToDisplay(value));
  const focused = useRef(false);
  const pickerRef = useRef(null);

  const inRange = useCallback(
    (ymd) => {
      if (!ymd) return true;
      if (minDate && ymd < minDate) return false;
      if (maxDate && ymd > maxDate) return false;
      return true;
    },
    [minDate, maxDate]
  );

  useEffect(() => {
    if (!focused.current) setText(filterDateToDisplay(value));
  }, [value]);

  const openCalendar = useCallback(() => {
    const el = pickerRef.current;
    if (!el) return;
    el.focus();
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
      } catch {
        // browser may block programmatic picker
      }
    }
  }, []);

  const rejectOutOfRange = useCallback(() => {
    onChange("");
    setText("");
    onOutOfRange?.();
  }, [onChange, onOutOfRange]);

  const commitYmd = useCallback(
    (ymd) => {
      if (ymd && !inRange(ymd)) {
        rejectOutOfRange();
        return;
      }
      onChange(ymd || "");
      setText(filterDateToDisplay(ymd));
    },
    [inRange, onChange, rejectOutOfRange]
  );

  const commitDisplay = useCallback(
    (raw) => {
      const typed = formatDateTypingInput(raw);
      setText(typed);
      if (!typed.trim()) {
        onChange("");
        return;
      }
      const ymd = parseFilterDateInput(typed);
      if (!ymd) return;
      if (!inRange(ymd)) {
        rejectOutOfRange();
        return;
      }
      commitYmd(ymd);
    },
    [commitYmd, inRange, onChange, rejectOutOfRange]
  );

  return (
    <div className={`relative min-w-0 ${className}`.trim()} title={title}>
      <div
        className={`relative flex items-center w-full h-7 border bg-white ${
          hasError ? FIELD_ERROR_CLASS : "border-slate-200 focus-within:border-indigo-500"
        }`}
      >
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          placeholder={placeholder}
          className="flex-1 min-w-0 h-full px-1.5 text-[11px] border-0 outline-none bg-transparent text-slate-800 font-medium"
          onFocus={() => {
            focused.current = true;
          }}
          onBlur={() => {
            focused.current = false;
            commitDisplay(text);
          }}
          onChange={(e) => {
            const next = formatDateTypingInput(e.target.value);
            setText(next);
            const ymd = parseFilterDateInput(next);
            if (ymd && !inRange(ymd)) {
              rejectOutOfRange();
              return;
            }
            if (ymd) onChange(ymd);
            else if (!next.trim()) onChange("");
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => openCalendar()}
          className="shrink-0 flex h-full w-7 items-center justify-center text-slate-400 hover:text-indigo-600 border-l border-slate-200"
          aria-label="Open calendar"
        >
          <Calendar size={12} strokeWidth={2.25} />
        </button>
        <input
          ref={pickerRef}
          type="date"
          value={value || ""}
          min={minDate || undefined}
          max={maxDate || undefined}
          tabIndex={-1}
          aria-hidden
          onChange={(e) => commitYmd(e.target.value || "")}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      </div>
    </div>
  );
}

function PickOrOtherReasonField({ value, onChange, options, inputClass = REJECT_INPUT, hasError = false }) {
  const known = useMemo(() => (Array.isArray(options) ? options.filter(Boolean) : []), [options]);
  const fieldClass = `${inputClass}${hasError ? ` ${FIELD_ERROR_CLASS}` : ""}`;
  const [pick, setPick] = useState(() => {
    if (!value) return "";
    return known.includes(value) ? value : PICK_OTHER;
  });

  useEffect(() => {
    if (!value) setPick("");
    else if (known.includes(value)) setPick(value);
    else setPick(PICK_OTHER);
  }, [value, known]);

  if (pick === PICK_OTHER) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter reason..."
        className={fieldClass}
      />
    );
  }

  return (
    <select
      value={pick}
      onChange={(e) => {
        const next = e.target.value;
        setPick(next);
        if (next === PICK_OTHER) onChange("");
        else onChange(next);
      }}
      className={fieldClass}
      aria-invalid={hasError || undefined}
    >
      <option value="">Select reason...</option>
      {known.map((reason) => (
        <option key={reason} value={reason}>
          {reason}
        </option>
      ))}
      <option value={PICK_OTHER}>Other...</option>
    </select>
  );
}

function previousActionDatePlaceholder(row) {
  const ymd = remarkDateToInputValue(row?.action_date ?? row?.last_action_date);
  return ymd ? filterDateToDisplay(ymd) : "Pick date";
}

function defaultActionForRow(row, modalMode, { canAdd = false, canApprove = false } = {}) {
  const st = Number(row?.is_planned ?? SCHEDULE_PLAN_STATUS.PENDING);
  const authorizeMode = modalMode === "authorize" || (canApprove && !canAdd);

  if (authorizeMode) {
    if (st === SCHEDULE_PLAN_STATUS.HOLD) return ROW_STATUS.HOLD;
    // Pending / Reject / etc. → Ready to Dispatch (approve)
    return ROW_STATUS.READY;
  }

  if (modalMode === "reject" && canAdd && isAddWorkableStatus(st)) return ROW_STATUS.REJECT;
  if (st === SCHEDULE_PLAN_STATUS.HOLD) return canApprove ? ROW_STATUS.READY : ROW_STATUS.HOLD;
  if (st === SCHEDULE_PLAN_STATUS.REJECT) return canApprove ? ROW_STATUS.READY : ROW_STATUS.REJECT;
  if (st === SCHEDULE_PLAN_STATUS.COMPLETE) return ROW_STATUS.COMPLETE;
  if (st === SCHEDULE_PLAN_STATUS.PLANNED || st === SCHEDULE_PLAN_STATUS.RUNNING) {
    return canAdd ? ROW_STATUS.PLAN : (canApprove ? ROW_STATUS.HOLD : ROW_STATUS.PLAN);
  }
  if (st === SCHEDULE_PLAN_STATUS.READY_TO_DISPATCH) {
    if (canAdd) return ROW_STATUS.PLAN;
    if (canApprove) return ROW_STATUS.READY;
    return ROW_STATUS.PLAN;
  }
  // Pending (0) / IMS-only — APPROVE: Ready; ADD cannot plan until Ready
  if (!isDbRow(row) || st === SCHEDULE_PLAN_STATUS.PENDING) {
    if (canApprove) return ROW_STATUS.READY;
    if (canAdd) return ROW_STATUS.PLAN; // may fail until Ready — still show Plan
    return ROW_STATUS.READY;
  }
  return canApprove ? ROW_STATUS.READY : ROW_STATUS.PLAN;
}

function initItemPlan(row, modalMode = "plan", perms = {}) {
  const status = defaultActionForRow(row, modalMode, perms);
  return {
    key: scheduleItemRowKey(row),
    row,
    status,
    // Previous date is placeholder only — never prefill as value.
    actionDate: "",
    reason: row.action_reason || "",
    remark: row.item_remark != null ? String(row.item_remark) : "",
  };
}

/** Same date + remark as already saved → skip save. Ready: remark only (no date). */
function isUnchangedPlanHoldOrReady(plan) {
  if (plan.status === ROW_STATUS.UNCHANGED) return true;
  const st = Number(plan.row?.is_planned);
  const inDb = isDbRow(plan.row);
  const isPlan =
    plan.status === ROW_STATUS.PLAN &&
    (st === SCHEDULE_PLAN_STATUS.PLANNED || st === SCHEDULE_PLAN_STATUS.RUNNING);
  const isReady =
    plan.status === ROW_STATUS.READY && st === SCHEDULE_PLAN_STATUS.READY_TO_DISPATCH;
  const isHold = plan.status === ROW_STATUS.HOLD && st === SCHEDULE_PLAN_STATUS.HOLD;
  if (!isPlan && !isReady && !isHold) return false;
  // IMS-only virtual Ready → still allow save so Ready is written into our DB when confirmed.
  if (isReady && !inDb) return false;
  const remark = String(plan.remark || "").trim();
  const savedRemark = String(plan.row.item_remark ?? "").trim();
  if (isReady) return remark === savedRemark;
  const date = String(plan.actionDate || "").trim();
  // Empty date = user did not set a new target → skip (previous date is placeholder only).
  if (!date) return true;
  const savedDate = remarkDateToInputValue(plan.row.action_date ?? plan.row.last_action_date) || "";
  return date === savedDate && remark === savedRemark;
}

function isUnchangedRejectRow(plan) {
  const st = Number(plan.row?.is_planned);
  if (st !== SCHEDULE_PLAN_STATUS.REJECT || plan.status !== ROW_STATUS.REJECT) return false;
  return (
    String(plan.reason || "").trim() === String(plan.row.action_reason || "").trim() &&
    String(plan.remark || "").trim() === String(plan.row.item_remark || "").trim()
  );
}

function isUnchangedCompleteRow(plan) {
  const st = Number(plan.row?.is_planned);
  return plan.status === ROW_STATUS.COMPLETE && st === SCHEDULE_PLAN_STATUS.COMPLETE;
}

/**
 * authorizeOnly (Approve): Ready to Dispatch + Hold only.
 * ADD mode: Plan / Reject (+ Ready/Hold if dual permission).
 * Complete is not offered here — completed rows are locked (read-only).
 */
function StatusActionOptions({
  canAdd,
  canApprove,
  current,
  rowStatus,
  authorizeOnly = false,
  forBulkApply = false,
  isSuperAdmin = false,
  isImsOnly = false,
}) {
  const st = rowStatus == null || rowStatus === "" ? null : Number(rowStatus);
  const isComplete = st != null && isScheduleCompleteStatus(st);
  const addWorkable = st != null && isAddWorkableStatus(st);
  const showAddActions =
    !authorizeOnly &&
    canAdd &&
    !isComplete &&
    (forBulkApply || isSuperAdmin || st == null || addWorkable || isImsOnly);
  const disableAddActions =
    !forBulkApply &&
    !isSuperAdmin &&
    st != null &&
    !isImsOnly &&
    !isAddWorkableStatus(st);
  const allow = (value, permitted) => Boolean(permitted) || current === value;

  if (isComplete) {
    return (
      <option value={ROW_STATUS.COMPLETE} disabled>
        Complete
      </option>
    );
  }

  if (authorizeOnly || (canApprove && !canAdd && !isSuperAdmin)) {
    return (
      <>
        <option value={ROW_STATUS.READY}>Ready to Dispatch</option>
        <option value={ROW_STATUS.HOLD}>Hold</option>
      </>
    );
  }

  return (
    <>
      {allow(ROW_STATUS.READY, canApprove || isSuperAdmin || isImsOnly) ? (
        <option value={ROW_STATUS.READY}>Ready to Dispatch</option>
      ) : null}
      {allow(ROW_STATUS.HOLD, canApprove || isSuperAdmin) ? (
        <option value={ROW_STATUS.HOLD}>Hold</option>
      ) : null}
      {allow(ROW_STATUS.PLAN, showAddActions) ? (
        <option value={ROW_STATUS.PLAN} disabled={disableAddActions}>Plan</option>
      ) : null}
      {allow(ROW_STATUS.REJECT, showAddActions) ? (
        <option value={ROW_STATUS.REJECT} disabled={disableAddActions}>Reject</option>
      ) : null}
    </>
  );
}

export default function SchedulePlanModal({
  open,
  onClose,
  schedule,
  mode = "plan",
  onSaved,
  itemsLoading = false,
  canAdd = false,
  canApprove = false,
  isSuperAdmin = false,
}) {
  const [scheduleSnap, setScheduleSnap] = useState(null);
  const [itemPlans, setItemPlans] = useState([]);
  const [globalTargetDate, setGlobalTargetDate] = useState("");
  const [globalRejectReason, setGlobalRejectReason] = useState("");
  const [globalAction, setGlobalAction] = useState("");
  const [globalRemark, setGlobalRemark] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const rowRefs = useRef({});
  const [reasonOptions, setReasonOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [historyItem, setHistoryItem] = useState(null);
  const [shortageItem, setShortageItem] = useState(null);
  const [shortageBulkOpen, setShortageBulkOpen] = useState(false);
  const [txnHistoryByKey, setTxnHistoryByKey] = useState({});

  const activeSchedule = open ? schedule || scheduleSnap : null;
  const singleItem = (activeSchedule?._items?.length ?? 0) === 1;
  /** Authorize click / approve-only: Ready + Hold. Super admin uses full plan mode. */
  const authorizeOnly = !isSuperAdmin && (mode === "authorize" || (canApprove && !canAdd));

  const headerDateRange = useMemo(
    () => getScheduleTargetDateRange(activeSchedule?.schmonth, activeSchedule?.schdt),
    [activeSchedule?.schmonth, activeSchedule?.schdt]
  );

  const rowDateRange = useCallback(
    (row) => getScheduleTargetDateRange(row?.schmonth ?? activeSchedule?.schmonth, row?.schdt ?? activeSchedule?.schdt),
    [activeSchedule?.schmonth, activeSchedule?.schdt]
  );

  const onTargetDateOutOfRange = useCallback(() => {
    toast.error("Target date must be in schedule month from today onwards.");
  }, []);

  const clearFieldError = useCallback((key, field) => {
    setFieldErrors((prev) => {
      if (!prev[key]?.[field]) return prev;
      const next = { ...prev };
      const rowErr = { ...next[key] };
      delete rowErr[field];
      if (Object.keys(rowErr).length) next[key] = rowErr;
      else delete next[key];
      return next;
    });
  }, []);

  const scrollToFirstFieldError = useCallback((errors) => {
    const firstKey = Object.keys(errors)[0];
    if (!firstKey) return;
    requestAnimationFrame(() => {
      rowRefs.current[firstKey]?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  useEffect(() => {
    if (open && schedule) setScheduleSnap(schedule);
    if (!open) {
      setScheduleSnap(null);
      setHistoryItem(null);
      setShortageItem(null);
      setShortageBulkOpen(false);
      setTxnHistoryByKey({});
    }
  }, [open, schedule]);

  useEffect(() => {
    if (!open) {
      setReasonOptions([]);
      return;
    }
    const { id: finYearId } = getSelectedFinancialYear();
    if (!finYearId) {
      setReasonOptions([]);
      return;
    }
    void schedulePlanningService
      .actionDates()
      .then((res) => {
        const reasons = Array.isArray(res?.reasons) ? res.reasons : [];
        const fromApi = reasons.map((r) => String(r).trim()).filter(Boolean);
        setReasonOptions((prev) => [...new Set([...fromApi, ...prev])]);
      })
      .catch(() => setReasonOptions((prev) => prev));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setItemPlans([]);
      return;
    }
    if (itemsLoading || !activeSchedule?._items?.length) return;
    setItemPlans(activeSchedule._items.map((row) => initItemPlan(row, mode, { canAdd, canApprove })));
    setGlobalTargetDate("");
    setGlobalRejectReason("");
    setGlobalAction("");
    setGlobalRemark("");
    setFieldErrors({});
    setReasonOptions((prev) => {
      const fromRows = activeSchedule._items
        .map((r) => String(r.action_reason || "").trim())
        .filter(Boolean);
      if (!fromRows.length) return prev;
      return [...new Set([...prev, ...fromRows])];
    });
  }, [open, activeSchedule, mode, itemsLoading, canAdd, canApprove]);

  // Load plan/hold history for Previous column (date — remark)
  useEffect(() => {
    if (!open || itemsLoading || !activeSchedule?._items?.length) {
      setTxnHistoryByKey({});
      return;
    }
    let cancelled = false;
    void Promise.all(
      activeSchedule._items.map(async (item) => {
        try {
          const res = await schedulePlanningService.transactions({
            schno: item.schno,
            itemdcode: item.itemdcode,
          });
          return [scheduleItemRowKey(item), Array.isArray(res?.data) ? res.data : []];
        } catch {
          return [scheduleItemRowKey(item), []];
        }
      })
    ).then((pairs) => {
      if (!cancelled) setTxnHistoryByKey(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [open, itemsLoading, activeSchedule]);

  const handleGlobalTargetDate = useCallback((date) => {
    setGlobalTargetDate(date);
    if (String(date || "").trim()) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const key of Object.keys(next)) {
          if (!next[key]?.actionDate) continue;
          const rowErr = { ...next[key] };
          delete rowErr.actionDate;
          changed = true;
          if (Object.keys(rowErr).length) next[key] = rowErr;
          else delete next[key];
        }
        return changed ? next : prev;
      });
    }
    setItemPlans((prev) => prev.map((p) => (
      p.status === ROW_STATUS.PLAN || p.status === ROW_STATUS.HOLD
        ? { ...p, actionDate: date }
        : p
    )));
  }, []);

  const handleGlobalRejectReason = useCallback((reason) => {
    setGlobalRejectReason(reason);
    if (String(reason || "").trim()) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const key of Object.keys(next)) {
          if (!next[key]?.reason) continue;
          const rowErr = { ...next[key] };
          delete rowErr.reason;
          changed = true;
          if (Object.keys(rowErr).length) next[key] = rowErr;
          else delete next[key];
        }
        return changed ? next : prev;
      });
    }
    setItemPlans((prev) => prev.map((p) => (p.status === ROW_STATUS.REJECT ? { ...p, reason } : p)));
  }, []);

  const applyStatusToPlan = useCallback(
    (plan, status) => {
      if (status === ROW_STATUS.UNCHANGED || status === "") {
        return { ...plan, status: ROW_STATUS.UNCHANGED, reason: "", actionDate: "" };
      }
      if (status === ROW_STATUS.REJECT) {
        return { ...plan, status, reason: plan.reason || globalRejectReason, actionDate: "" };
      }
      if (status === ROW_STATUS.COMPLETE) {
        return { ...plan, status, reason: "", actionDate: "" };
      }
      if (status === ROW_STATUS.READY) {
        return { ...plan, status, reason: "", actionDate: "" };
      }
      if (status === ROW_STATUS.HOLD || status === ROW_STATUS.PLAN) {
        // Keep typed/global date only — never copy previous saved date into value.
        return { ...plan, status, reason: "", actionDate: plan.actionDate || globalTargetDate || "" };
      }
      if (status === ROW_STATUS.PENDING) {
        if (isDbRow(plan.row)) return plan;
        return { ...plan, status, reason: "", actionDate: "" };
      }
      return { ...plan, status, reason: "", actionDate: plan.actionDate || globalTargetDate || "" };
    },
    [globalRejectReason, globalTargetDate]
  );

  const handleGlobalAction = useCallback(
    (status) => {
      setGlobalAction(status);
      if (!status) return;
      setItemPlans((prev) => prev.map((p) => applyStatusToPlan(p, status)));
    },
    [applyStatusToPlan]
  );

  const handleGlobalRemark = useCallback((remark) => {
    setGlobalRemark(remark);
    setItemPlans((prev) => prev.map((p) => ({ ...p, remark })));
  }, []);

  const setRowStatus = useCallback(
    (key, status) => {
      setItemPlans((prev) =>
        prev.map((p) => {
          if (p.key !== key) return p;
          return applyStatusToPlan(p, status);
        })
      );
    },
    [applyStatusToPlan]
  );

  /** Target date required for Plan + Hold only — not Ready to Dispatch. */
  const needsActionDate = (status) =>
    status === ROW_STATUS.PLAN || status === ROW_STATUS.HOLD;

  const setActionDate = useCallback((key, date) => {
    setItemPlans((prev) => prev.map((p) => (p.key === key && needsActionDate(p.status) ? { ...p, actionDate: date } : p)));
    if (String(date || "").trim()) clearFieldError(key, "actionDate");
  }, [clearFieldError]);

  const setItemReason = useCallback((key, reason) => {
    setItemPlans((prev) => prev.map((p) => (p.key === key ? { ...p, reason } : p)));
    if (String(reason || "").trim()) clearFieldError(key, "reason");
  }, [clearFieldError]);

  const setItemRemark = useCallback((key, remark) => {
    setItemPlans((prev) => prev.map((p) => (p.key === key ? { ...p, remark } : p)));
  }, []);

  const effectiveDate = useCallback((plan) => {
    if (needsActionDate(plan.status)) {
      return String(plan.actionDate || "").trim();
    }
    return "";
  }, []);

  const handleClose = () => {
    setItemPlans([]);
    setGlobalTargetDate("");
    setGlobalRejectReason("");
    setGlobalAction("");
    setGlobalRemark("");
    setFieldErrors({});
    setHistoryItem(null);
    setShortageItem(null);
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!itemPlans.length) {
      toast.error("No items to process.");
      return;
    }

    setFieldErrors({});

    const nextErrors = {};
    let firstErrorMessage = null;

    for (const plan of itemPlans) {
      const code = plan.row.item_code || "item";
      if (plan.status === ROW_STATUS.REJECT && !String(plan.reason || "").trim()) {
        nextErrors[plan.key] = { ...(nextErrors[plan.key] || {}), reason: true };
        if (!firstErrorMessage) firstErrorMessage = `Enter reject reason for ${code}.`;
      }
    }

    if (firstErrorMessage) {
      setFieldErrors(nextErrors);
      scrollToFirstFieldError(nextErrors);
      toast.error(firstErrorMessage);
      return;
    }

    const toPlan = itemPlans.filter(
      (p) =>
        p.status === ROW_STATUS.PLAN &&
        !isScheduleCompleteStatus(p.row?.is_planned) &&
        !isUnchangedPlanHoldOrReady(p) &&
        effectiveDate(p)
    );
    const toReady = itemPlans.filter((p) => p.status === ROW_STATUS.READY && !isUnchangedPlanHoldOrReady(p));
    const toHold = itemPlans.filter((p) => p.status === ROW_STATUS.HOLD && !isUnchangedPlanHoldOrReady(p) && effectiveDate(p));
    const toReject = itemPlans.filter(
      (p) =>
        p.status === ROW_STATUS.REJECT &&
        !isScheduleCompleteStatus(p.row?.is_planned) &&
        !isUnchangedRejectRow(p)
    );
    const toComplete = itemPlans.filter((p) => p.status === ROW_STATUS.COMPLETE && !isUnchangedCompleteRow(p) && isDbRow(p.row));

    const missingDate = itemPlans.find(
      (p) =>
        needsActionDate(p.status) &&
        !isUnchangedPlanHoldOrReady(p) &&
        !effectiveDate(p)
    );
    if (missingDate) {
      setFieldErrors({ [missingDate.key]: { actionDate: true } });
      scrollToFirstFieldError({ [missingDate.key]: { actionDate: true } });
      const isHoldMissing = missingDate.status === ROW_STATUS.HOLD;
      toast.error(
        isHoldMissing
          ? `Hold date required for ${missingDate.row.item_code || "item"}.`
          : `Enter target date for ${missingDate.row.item_code || "item"}.`
      );
      return;
    }

    if (!toPlan.length && !toReady.length && !toHold.length && !toReject.length && !toComplete.length) {
      toast.info("No changes to save.");
      return;
    }

    for (const plan of [...toPlan, ...toHold]) {
      const date = effectiveDate(plan);
      const schmonth = plan.row.schmonth ?? activeSchedule?.schmonth;
      const schdt = plan.row.schdt ?? activeSchedule?.schdt;
      if (!isScheduleTargetDateAllowed(date, schmonth, schdt)) {
        const code = plan.row.item_code || "item";
        const dateErrors = { [plan.key]: { actionDate: true } };
        setFieldErrors(dateErrors);
        scrollToFirstFieldError(dateErrors);
        toast.error(`${code}: pick a date within ${formatScheduleTargetDateHint(schmonth, schdt)}.`);
        return;
      }
    }

    setSaving(true);
    try {
      let planned = 0;
      let readied = 0;
      let held = 0;
      let rejected = 0;
      let completed = 0;

      for (const plan of itemPlans) {
        if (plan.status === ROW_STATUS.UNCHANGED || plan.status === ROW_STATUS.PENDING) continue;

        const totalQty = Number(plan.row.totalqty ?? plan.row.total_qty ?? 0);
        const itemRemark = plan.remark?.trim() || null;
        const base = {
          schno: plan.row.schno,
          itemdcode: plan.row.itemdcode,
          schmonth: plan.row.schmonth,
          schdt: plan.row.schdt,
          acc_code: plan.row.acc_code,
          acc_name: plan.row.acc_name,
          item_code: plan.row.item_code,
          itemdesc: plan.row.itemdesc,
          totalqty: totalQty,
          item_remark: itemRemark,
        };

        if (plan.status === ROW_STATUS.REJECT) {
          if (!canAdd && !isSuperAdmin) throw new Error("ADD permission required to Reject.");
          const st = Number(plan.row?.is_planned ?? SCHEDULE_PLAN_STATUS.PENDING);
          if (!isSuperAdmin && !isAddWorkableStatus(st) && st !== SCHEDULE_PLAN_STATUS.REJECT) {
            throw new Error("Mark Ready to Dispatch first, then Reject.");
          }
          if (isUnchangedRejectRow(plan)) continue;
          const res = await schedulePlanningService.reject({
            ...base,
            action_reason: String(plan.reason).trim(),
          });
          if (!res?.success) throw new Error(res?.message || "Reject failed");
          rejected += 1;
        } else if (plan.status === ROW_STATUS.HOLD) {
          if (!canApprove && !isSuperAdmin) throw new Error("APPROVE permission required for Hold.");
          if (isUnchangedPlanHoldOrReady(plan)) continue;
          const date = effectiveDate(plan);
          if (!date) continue;
          const res = await schedulePlanningService.hold({ ...base, action_date: date });
          if (!res?.success) throw new Error(res?.message || "Hold failed");
          held += 1;
        } else if (plan.status === ROW_STATUS.READY) {
          if (!canApprove && !isSuperAdmin) throw new Error("APPROVE permission required for Ready to Dispatch.");
          if (isUnchangedPlanHoldOrReady(plan)) continue;
          const res = await schedulePlanningService.readyToDispatch({
            ...base,
            qty: totalQty,
          });
          if (!res?.success) throw new Error(res?.message || "Ready to Dispatch failed");
          readied += 1;
        } else if (plan.status === ROW_STATUS.PLAN) {
          if (!canAdd && !isSuperAdmin) throw new Error("ADD permission required for Plan.");
          const st = Number(plan.row?.is_planned ?? SCHEDULE_PLAN_STATUS.PENDING);
          if (!isSuperAdmin && !isAddWorkableStatus(st)) {
            throw new Error("Ready to Dispatch required first — then Plan.");
          }
          if (isUnchangedPlanHoldOrReady(plan)) continue;
          const date = effectiveDate(plan);
          if (!date) continue;
          const res = await schedulePlanningService.save({
            ...base,
            action_date: date,
            qty: totalQty,
          });
          if (!res?.success) throw new Error(res?.message || "Save failed");
          planned += 1;
        } else if (plan.status === ROW_STATUS.COMPLETE) {
          if (!canAdd && !isSuperAdmin) throw new Error("ADD permission required to Complete.");
          const st = Number(plan.row?.is_planned ?? SCHEDULE_PLAN_STATUS.PENDING);
          if (
            !isSuperAdmin &&
            st !== SCHEDULE_PLAN_STATUS.COMPLETE &&
            st !== SCHEDULE_PLAN_STATUS.PLANNED &&
            st !== SCHEDULE_PLAN_STATUS.RUNNING
          ) {
            throw new Error("Plan required first — then Complete.");
          }
          if (isUnchangedCompleteRow(plan) || !isDbRow(plan.row)) continue;
          const res = await schedulePlanningService.complete(base);
          if (!res?.success) throw new Error(res?.message || "Complete failed");
          completed += 1;
        }
      }

      const parts = [];
      if (planned) parts.push(`${planned} plan`);
      if (readied) parts.push(`${readied} ready to dispatch`);
      if (held) parts.push(`${held} on hold`);
      if (rejected) parts.push(`${rejected} rejected`);
      if (completed) parts.push(`${completed} completed`);
      toast.success(parts.length ? `${parts.join(", ")}.` : "Saved.");
      if (rejected) {
        setReasonOptions((prev) => {
          const added = itemPlans
            .filter((p) => p.status === ROW_STATUS.REJECT)
            .map((p) => String(p.reason || "").trim())
            .filter(Boolean);
          return [...new Set([...prev, ...added])];
        });
      }
      onSaved?.();
      handleClose();
    } catch (err) {
      toast.error(err?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = useMemo(() => {
    if (canApprove && !canAdd) {
      return singleItem ? "Authorize Item" : "Authorize Schedule";
    }
    if (canAdd && !canApprove) {
      return singleItem ? "Plan Item" : "Schedule Plan";
    }
    return singleItem ? "Schedule Item" : "Schedule Plan";
  }, [canAdd, canApprove, singleItem]);

  const drawerFooter = (
    <div className="flex justify-end gap-2 w-full">
      <button type="button" onClick={handleClose} disabled={saving} className={`${BTN} bg-white text-slate-600 px-4`}>
        Cancel
      </button>
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={saving || itemsLoading || !itemPlans.length}
        className="h-7 px-4 text-[10px] font-bold uppercase text-white rounded-none flex items-center gap-1.5 disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {canApprove && !canAdd ? "Authorize" : "Submit"}
      </button>
    </div>
  );

  if (!open || !activeSchedule) return null;

  return (
    <>
      <Drawer
        isOpen={open}
        onClose={handleClose}
        onSubmit={() => void handleSubmit()}
        title={modalTitle}
        maxWidth="max-w-7xl"
        footer={drawerFooter}
      >
        <div className="space-y-3 pb-1.5">
          <ScheduleDetailsCard schedule={activeSchedule} singleItem={singleItem} canAdd={canAdd} canApprove={canApprove} />

          <div className="border border-slate-200 rounded-sm overflow-x-auto max-h-[min(65vh,600px)] overflow-y-auto">
            <table className="w-full text-left border-collapse min-w-[1150px]">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase text-slate-500 border-b border-r border-slate-200 w-10 text-center">#</th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase text-slate-500 border-b border-r border-slate-200 w-[100px]">Item</th>
                  {/* <th className="px-2 py-2 text-[10px] font-bold uppercase text-slate-500 border-b border-r border-slate-200 w-[110px]">Cust. Item</th> */}
                  {/* <th className="px-2 py-2 text-[10px] font-bold uppercase text-slate-500 border-b border-r border-slate-200 min-w-[140px]">Description</th> */}
                  <th className="px-2 py-2 text-[10px] font-bold uppercase text-slate-500 border-b border-r border-slate-200 w-[70px] text-center">Qty</th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase text-emerald-700 border-b border-r border-slate-200 w-[80px] text-center">In Hand</th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase text-slate-600 border-b border-r border-slate-200 min-w-[152px] align-top">Cust. request</th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase text-amber-700 border-b border-r border-slate-200 min-w-[120px]">Previous dates</th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase text-slate-600 border-b border-r border-slate-200 w-[108px] align-top">Status</th>
                  <th className="px-1.5 py-1.5 text-[10px] font-bold uppercase text-slate-600 border-b border-r border-slate-200 min-w-[118px] align-top">
                    <span className="block px-0.5 pb-1">Action</span>
                    <select
                      value={globalAction}
                      onChange={(e) => handleGlobalAction(e.target.value)}
                      className={`${SELECT} font-semibold`}
                      disabled={itemsLoading || !itemPlans.length}
                    >
                      <option value="">Apply to all...</option>
                      <StatusActionOptions
                        canAdd={canAdd}
                        canApprove={canApprove}
                        current={globalAction}
                        rowStatus={null}
                        authorizeOnly={authorizeOnly}
                        forBulkApply
                        isSuperAdmin={isSuperAdmin}
                      />
                    </select>
                  </th>
                  <th className="px-1.5 py-1.5 text-[10px] font-bold uppercase text-indigo-600 border-b border-r border-slate-200 w-[180px] align-top">
                    <span className="block px-0.5 pb-1">
                      {authorizeOnly ? "Hold date (Ready = remark only)" : "Target date / Reason"}
                    </span>
                    <div className="space-y-1">
                      <ScheduleTargetDateField
                        value={globalTargetDate}
                        onChange={handleGlobalTargetDate}
                        minDate={headerDateRange.min}
                        maxDate={headerDateRange.max}
                        onOutOfRange={onTargetDateOutOfRange}
                        placeholder={
                          authorizeOnly
                            ? "Hold date only..."
                            : formatScheduleTargetDateHint(activeSchedule?.schmonth, activeSchedule?.schdt)
                        }
                      />
                      {!authorizeOnly ? (
                        <PickOrOtherReasonField
                          value={globalRejectReason}
                          onChange={handleGlobalRejectReason}
                          options={reasonOptions}
                          inputClass={`${REJECT_INPUT} w-full`}
                        />
                      ) : null}
                    </div>
                  </th>
                  <th className="px-1.5 py-1.5 text-[10px] font-bold uppercase text-slate-500 border-b border-r border-slate-200 min-w-[120px] align-top">
                    <span className="block px-0.5 pb-1">Remark</span>
                    <input
                      type="text"
                      value={globalRemark}
                      onChange={(e) => handleGlobalRemark(e.target.value)}
                      placeholder="Apply remark to all..."
                      disabled={itemsLoading || !itemPlans.length}
                      className={`${INPUT} w-full`}
                    />
                  </th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200 w-[100px] text-center align-top">
                    <span className="block px-0.5 pb-1">More</span>
                    {canApprove ? (
                      <button
                        type="button"
                        title="Record shortage for all items (APPROVE)"
                        onClick={() => {
                          setShortageItem(null);
                          setShortageBulkOpen(true);
                        }}
                        disabled={itemsLoading || !itemPlans.length}
                        className={`${ICON_BTN} w-full justify-center text-amber-800 hover:bg-amber-50 hover:border-amber-300 disabled:opacity-40`}
                      >
                        <PackageMinus size={11} />
                        Short
                      </button>
                    ) : null}
                  </th>
                </tr>
              </thead>
              <tbody>
                {itemsLoading ? (
                  <tr>
                    <td colSpan={13} className="py-14 text-center">
                      <div className="flex flex-col items-center justify-center gap-2 text-slate-600">
                        <Loader2 size={22} className="animate-spin text-indigo-500" />
                        <span className="text-[11px] font-bold uppercase">Loading all schedule items...</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                itemPlans.map((plan, idx) => {
                  const totalQty = Number(plan.row.totalqty ?? plan.row.total_qty ?? 0);
                  const fgStock = Number(plan.row.in_hand_qty ?? plan.row.fg_stock_qty ?? 0);
                  const prevDates = formatPreviousPlanDates(plan.row, txnHistoryByKey[plan.key]);
                  const isUnchanged = plan.status === ROW_STATUS.UNCHANGED;
                  const isReject = plan.status === ROW_STATUS.REJECT;
                  const isHold = plan.status === ROW_STATUS.HOLD;
                  const isPlan = plan.status === ROW_STATUS.PLAN;
                  const isReady = plan.status === ROW_STATUS.READY;
                  const isComplete = plan.status === ROW_STATUS.COMPLETE;
                  const isPending = plan.status === ROW_STATUS.PENDING;
                  const isImsOnly = !isDbRow(plan.row);
                  const dateRange = rowDateRange(plan.row);
                  const datePlaceholder = previousActionDatePlaceholder(plan.row);
                  const rowErr = fieldErrors[plan.key] || {};
                  const rowHasError = Boolean(rowErr.reason || rowErr.actionDate);

                  return (
                    <tr
                      key={plan.key}
                      ref={(el) => {
                        if (el) rowRefs.current[plan.key] = el;
                        else delete rowRefs.current[plan.key];
                      }}
                      className={`border-b border-slate-100 transition-colors ${
                        rowHasError ? "bg-rose-50/70 hover:bg-rose-50" : "bg-white hover:bg-slate-50/50"
                      }`}
                    >
                      <td className={`px-2 py-1.5 border-r border-slate-100 text-center align-top ${IMS_TABLE_CELL_TEXT}`}>{idx + 1}</td>
                      {/* <td className={`px-2 py-1.5 border-r border-slate-100 align-top uppercase ${IMS_TABLE_CELL_TEXT} text-slate-800`}>{plan.row.item_code || "—"}</td> */}
                      <td className="px-2 py-1.5 border-r border-slate-100 align-top max-w-[180px]">
                        <div className="flex flex-col gap-0.5">
                          {/* Item Code (Bold aur Uppercase) */}
                          <span className={`block uppercase font-semibold text-slate-900 ${IMS_TABLE_CELL_TEXT}`} title={plan.row.item_code}>
                            {plan.row.item_code || "—"}
                          </span>
                          
                          {/* Item description (muted / smaller text so it reads as secondary) */}
                          <span 
                            className={`block break-words text-xs text-slate-500 leading-snug ${IMS_TABLE_CELL_TEXT}`} 
                            title={plan.row.itemdesc}
                          >
                            {plan.row.itemdesc || "—"}
                          </span>
                        </div>
                      </td>
                      {/* <td className={`px-2 py-1.5 border-r border-slate-100 align-top uppercase ${IMS_TABLE_CELL_TEXT} text-slate-800`}>{plan.row.custitemcode || "—"}</td> */}
                      {/* <td className="px-2 py-1.5 border-r border-slate-100 align-top leading-snug max-w-[180px]" title={plan.row.itemdesc}>
                        <span className={`block break-words ${IMS_TABLE_CELL_TEXT} text-slate-800`}>{plan.row.itemdesc || "—"}</span>
                      </td> */}
                      <td className={`px-2 py-1.5 text-center border-r border-slate-100 align-top ${IMS_TABLE_CELL_NUMBER}`}>{totalQty.toLocaleString()}</td>
                      <td className={`px-2 py-1.5 text-center border-r border-slate-100 align-top ${IMS_TABLE_CELL_NUMBER} text-emerald-800`}>{fgStock.toLocaleString()}</td>
                      <td className="px-2 py-1.5 bg-slate-50/30 border-r border-slate-100 align-top select-text">
                        <ScheduleCustRequestCell raw={plan.row.Remarks ?? plan.row.remarks} showIndex />
                      </td>
                      <td className="px-2 py-1.5 bg-amber-50/30 border-r border-slate-100 align-top select-text" title={prevDates}>
                        <span className={`block break-words ${IMS_TABLE_CELL_TEXT} text-amber-950`}>{prevDates}</span>
                      </td>
                      <td className="px-1.5 py-1.5 border-r border-slate-100 align-top whitespace-nowrap">
                        <ScheduleStatusBadge row={plan.row} />
                      </td>
                      <td className="px-1.5 py-1.5 border-r border-slate-100 align-top">
                        <select
                          value={plan.status}
                          onChange={(e) => setRowStatus(plan.key, e.target.value)}
                          className={`${SELECT} ${
                            isReject ? "text-rose-700 font-bold"
                              : isHold ? "text-orange-700 font-bold"
                              : isReady ? "text-cyan-700 font-bold"
                              : isPlan ? "text-indigo-700 font-bold"
                              : isComplete ? "text-emerald-700 font-bold"
                              : isPending ? "text-amber-600 font-bold"
                              : isUnchanged ? "text-slate-500"
                              : "text-slate-500"
                          }`}
                        >
                          <StatusActionOptions
                            canAdd={canAdd}
                            canApprove={canApprove}
                            current={plan.status}
                            rowStatus={plan.row?.is_planned}
                            authorizeOnly={authorizeOnly}
                            isSuperAdmin={isSuperAdmin}
                            isImsOnly={isImsOnly}
                          />
                        </select>
                      </td>
                      <td className="px-1.5 py-1.5 border-r border-slate-100 align-top">
                        {isUnchanged ? (
                          <span className={`${IMS_TABLE_CELL_TEXT} text-slate-500 px-1`}>
                            Skip — pick Hold or Ready
                          </span>
                        ) : isPending || isComplete || isReady ? (
                          <span className={`${IMS_TABLE_CELL_TEXT} text-slate-600 px-1`}>
                            {isReady
                              ? "No date — use Remark only"
                              : isComplete
                                ? "No date needed for complete"
                                : "Not required for pending"}
                          </span>
                        ) : isReject ? (
                          <div className="space-y-1">
                            <PickOrOtherReasonField
                              value={plan.reason}
                              onChange={(reason) => setItemReason(plan.key, reason)}
                              options={reasonOptions}
                              hasError={Boolean(rowErr.reason)}
                            />
                            {rowErr.reason ? (
                              <span className="block px-0.5 text-[9px] font-bold uppercase text-rose-600">
                                Reject reason required
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <ScheduleTargetDateField
                              value={plan.actionDate}
                              onChange={(date) => setActionDate(plan.key, date)}
                              minDate={dateRange.min}
                              maxDate={dateRange.max}
                              onOutOfRange={onTargetDateOutOfRange}
                              placeholder={datePlaceholder}
                              hasError={Boolean(rowErr.actionDate)}
                              title={formatScheduleTargetDateHint(plan.row.schmonth ?? activeSchedule?.schmonth, plan.row.schdt ?? activeSchedule?.schdt)}
                            />
                            {rowErr.actionDate ? (
                              <span className="block px-0.5 text-[9px] font-bold uppercase text-rose-600">
                                {isHold ? "Hold date required" : "Target date required"}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-1.5 py-1.5 border-r border-slate-100 align-top">
                        <input
                          type="text"
                          value={plan.remark}
                          onChange={(e) => setItemRemark(plan.key, e.target.value)}
                          placeholder="Item remark..."
                          className={`${INPUT} w-full`}
                        />
                      </td>
                      <td className="px-1 py-1.5 align-top">
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            title="View transaction log"
                            onClick={() => setHistoryItem(plan.row)}
                            className={`${ICON_BTN} text-slate-600 hover:text-indigo-700 hover:border-indigo-300`}
                          >
                            <History size={11} />
                            View
                          </button>
                          {canApprove ? (
                            String(plan.row.shortage_no || "").trim() ? (
                              <span
                                className="text-[9px] font-bold uppercase text-amber-800 px-1 py-0.5 border border-amber-200 bg-amber-50"
                                title={`Shortage No: ${plan.row.shortage_no}`}
                              >
                                Shorted
                              </span>
                            ) : (
                              <button
                                type="button"
                                title="Record shortage (APPROVE)"
                                onClick={() => {
                                  setShortageBulkOpen(false);
                                  setShortageItem(plan.row);
                                }}
                                className={`${ICON_BTN} text-amber-800 hover:bg-amber-50 hover:border-amber-300`}
                              >
                                <PackageMinus size={11} />
                                Short
                              </button>
                            )
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Drawer>

      <SchedulePlanHistoryModal
        open={Boolean(historyItem)}
        item={historyItem}
        onClose={() => setHistoryItem(null)}
        stackLevel={1}
      />

      <ScheduleShortageModal
        open={Boolean(shortageItem) || shortageBulkOpen}
        item={shortageBulkOpen ? null : shortageItem}
        items={shortageBulkOpen ? itemPlans.map((p) => p.row) : null}
        onClose={() => {
          setShortageItem(null);
          setShortageBulkOpen(false);
        }}
        onSaved={(savedByKey) => {
          if (savedByKey && typeof savedByKey === "object") {
            setItemPlans((prev) =>
              prev.map((p) => {
                const saved = savedByKey[p.key];
                if (!saved) return p;
                const no = typeof saved === "object" ? saved.shortage_no : saved;
                if (!no) return p;
                const remark =
                  typeof saved === "object" && saved.item_remark != null
                    ? String(saved.item_remark).trim()
                    : String(p.row.item_remark ?? p.remark ?? "").trim();
                return {
                  ...p,
                  // Keep modal remark in sync so next Authorize/Save does not wipe shortage remark.
                  remark: remark || p.remark,
                  row: {
                    ...p.row,
                    shortage_no: String(no),
                    item_remark: remark || null,
                    last_action_type: "shortage",
                    last_action_label: "Shortage",
                    last_action_date: p.row.last_action_date || null,
                  },
                };
              })
            );
          }
          onSaved?.();
        }}
        stackLevel={1}
      />
    </>
  );
}

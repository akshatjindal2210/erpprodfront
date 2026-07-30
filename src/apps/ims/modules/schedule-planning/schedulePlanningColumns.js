"use client";

import { Calendar, List } from "lucide-react";
import { formatDateTime, formatDocDate, filterDateToDisplay } from "@/platform/utils/core/utilHelper";
import { IMS_TABLE_CELL_TEXT } from "@/ui/common/list/listPageShellClasses";
import { SCHEDULE_PLAN_STATUS, SCHEDULE_STATUS_FILTER_OPTIONS, isDbRow, statusLabel, resolveScheduleDisplayStatus } from "./schedulePlanStatus";

export { SCHEDULE_STATUS_FILTER_OPTIONS, SCHEDULE_REPORT_FILTER, SCHEDULE_REPORT_FILTER_OPTIONS } from "./schedulePlanStatus";
export { isDbRow as isScheduleRowPlanned, canDeleteRow } from "./schedulePlanStatus";

export const SCHEDULE_PAGE_TABS = [
  { id: "schedule", label: "Schedule", icon: Calendar },
  { id: "item-wise", label: "Schedule Item Wise", icon: List },
];

export const MONTH_FULL_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const MONTH_FILTER_OPTIONS = [
  { value: "all", label: "All Months" },
  ...MONTH_FULL_NAMES.map((label, i) => ({ value: String(i + 1), label })),
];

export function currentScheduleMonthValue() {
  return String(new Date().getMonth() + 1);
}

export function scheduleItemRowKey(row) {
  const dcode = resolveScheduleItemdcode(row);
  return dcode != null ? `${row.schno}-${dcode}` : String(row.schno ?? "");
}

export function scheduleSchnoKey(row) {
  return String(row.schno ?? "");
}

/** Item dcode from list row or selected row key (`schno-itemdcode`). */
export function resolveScheduleItemdcode(row, selectedKey = "") {
  const fromRow = row?.itemdcode ?? row?.item_dcode ?? row?.Itemdcode ?? row?.ItemDcode;
  if (fromRow != null && String(fromRow).trim() !== "") {
    const n = Number(fromRow);
    if (Number.isFinite(n)) return n;
  }
  const key = String(selectedKey || "").trim();
  const dash = key.lastIndexOf("-");
  if (dash > 0) {
    const n = Number(key.slice(dash + 1));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** IMS Remarks JSON — one or many `{ date, qty }` pairs, e.g. `[{"date":"1/7/26","qty":6000}]`. */
export function normalizeScheduleRemarksRaw(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  const text = String(raw).trim();
  if (!text) return [];
  try {
    let parsed = JSON.parse(text);
    if (typeof parsed === "string") {
      const inner = String(parsed).trim();
      parsed = inner ? JSON.parse(inner) : [];
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseScheduleRemarks(raw) {
  const arr = normalizeScheduleRemarksRaw(raw);
  if (!arr.length) return [];
  return arr
    .map((e, index) => {
      if (e == null || typeof e !== "object") return null;
      const iso = remarkDateToInputValue(e.date);
      const d = iso ? formatDocDate(iso) : formatDocDate(e.date);
      const qty = Number(e.qty ?? e.quantity ?? 0);
      return {
        index: index + 1,
        date: d || (e.date != null ? String(e.date) : "—"),
        qty: Number.isFinite(qty) ? qty : 0,
        sortKey: iso || String(e.date || ""),
      };
    })
    .filter(Boolean)
    .filter((e) => e.date !== "—" || e.qty > 0)
    .sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));
}

export function formatScheduleRemarks(raw) {
  const entries = parseScheduleRemarks(raw);
  if (!entries.length) {
    if (raw == null || String(raw).trim() === "") return "—";
    return String(raw);
  }
  return entries.map((e) => `${e.date} — Qty: ${e.qty.toLocaleString()}`).join("; ");
}

export function ScheduleCustRequestCell({ raw, className = "", showIndex = false }) {
  const entries = parseScheduleRemarks(raw);
  if (!entries.length) {
    const text = raw != null && String(raw).trim() !== "" ? String(raw) : "—";
    return <span className={`${IMS_TABLE_CELL_TEXT} text-slate-500 ${className}`.trim()}>{text}</span>;
  }

  const multi = entries.length > 1;

  return (
    <div
      className={`min-w-[130px] ${multi ? "divide-y divide-slate-200/90" : ""} ${className}`.trim()}
      title={formatScheduleRemarks(raw)}
    >
      {entries.map((e) => (
        <div
          key={`${e.date}-${e.qty}-${e.index}`}
          className={`leading-snug ${multi ? "py-1 first:pt-0 last:pb-0" : ""}`}
        >
          <div className="flex items-baseline gap-1.5">
            {showIndex && multi ? (
              <span className="text-[9px] font-bold text-slate-400 tabular-nums shrink-0">{e.index}.</span>
            ) : null}
            <span className={`${IMS_TABLE_CELL_TEXT} text-slate-800 font-medium`}>{e.date}</span>
          </div>
          <div className={`whitespace-nowrap ${showIndex && multi ? "pl-4" : ""}`}>
            <span className="text-[10px] font-semibold uppercase text-slate-500">Qty:</span>{" "}
            <span className="text-[10px] font-bold tabular-nums text-slate-900">{e.qty.toLocaleString()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Last Action meta: always date + remark/reason when present (Hold / Reject / any). */
export function formatLastActionMeta(row) {
  if (!row) return "";

  const dateRaw =
    row.last_action_date
    ?? row.action_date
    ?? row.last_action_at
    ?? null;
  const dateText =
    formatDocDate(remarkDateToInputValue(dateRaw) || dateRaw)
    || formatDocDate(dateRaw)
    || "";

  const remark = String(row.item_remark || "").trim();
  const reason = String(row.action_reason || row.last_action_reason || "").trim();
  const notes = [];
  if (remark) notes.push(remark);
  if (reason && reason.toLowerCase() !== remark.toLowerCase()) notes.push(reason);
  const note = notes.join(" · ");

  if (dateText && note) return `${dateText} — ${note}`;
  return dateText || note || "";
}

/** Previous column: plan/hold history as "DD/MM/YYYY — remark" (oldest → newest). */
export function formatPreviousPlanDates(row, txnRows) {
  if (row == null || typeof row !== "object" || Array.isArray(row)) return "—";

  const fromTxn = (Array.isArray(txnRows) ? txnRows : [])
    .filter((t) => {
      const type = String(t?.action_type || "").toLowerCase();
      return (type === "plan" || type === "hold") && t?.action_date;
    })
    .slice()
    .reverse(); // API newest-first → show oldest first

  const lines = fromTxn.map((t) => {
    const dateText = formatDocDate(t.action_date);
    if (!dateText) return "";
    const remark = String(t.remark || "").trim();
    return remark ? `${dateText} — ${remark}` : dateText;
  }).filter(Boolean);

  if (lines.length) return lines.join("; ");

  // No txn yet — show current saved date + remark
  const date = row.action_date ?? row.last_action_date;
  if (!date) return "—";
  const dateText = formatDocDate(remarkDateToInputValue(date) || date);
  if (!dateText) return "—";
  const remark = String(row.item_remark || "").trim();
  return remark ? `${dateText} — ${remark}` : dateText;
}

/** Current saved plan snapshot for list/modal (not history). */
export function formatCurrentPlanInfo(row) {
  if (!row) return "—";
  const parts = [];
  if (row.action_date) parts.push(formatDocDate(row.action_date));
  if (row.action_reason) parts.push(`Reason: ${row.action_reason}`);
  if (row.item_remark) parts.push(`Remark: ${row.item_remark}`);
  return parts.length ? parts.join(" · ") : "—";
}

export function formatTxnTargetDates(_raw, actionType, row = null) {
  const t = String(actionType || row?.action_type || "").toLowerCase();
  if ((t === "plan" || t === "hold") && row?.action_date) {
    return formatDocDate(row.action_date) || "—";
  }
  if (t === "reject" && row?.action_reason) {
    return row.action_reason;
  }
  return "—";
}

export function remarkDateToInputValue(dateStr) {
  if (!dateStr) return "";
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parts = s.split("/");
  if (parts.length === 3) {
    let [d, m, y] = parts.map((p) => p.trim());
    if (y.length === 2) y = `20${y}`;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  }
  return "";
}

export function localTodayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Target date window: schedule month only, from today through month-end (future days left in that month). */
export function getScheduleTargetDateRange(schmonth, schdt) {
  const month = Number(schmonth);
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return { min: null, max: null, hasRange: false, exhausted: false };
  }

  let year = new Date().getFullYear();
  const schIso = remarkDateToInputValue(schdt);
  if (schIso && /^\d{4}-\d{2}-\d{2}/.test(schIso)) {
    year = parseInt(schIso.slice(0, 4), 10);
    const schMonthFromDt = parseInt(schIso.slice(5, 7), 10);
    if (Number.isFinite(schMonthFromDt) && month < schMonthFromDt) {
      year += 1;
    }
  }

  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  const max = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;
  const monthStart = `${year}-${mm}-01`;
  const today = localTodayYmd();
  const min = today > monthStart ? today : monthStart;

  if (min > max) {
    return { min: null, max: null, hasRange: false, exhausted: true };
  }
  return { min, max, hasRange: true, exhausted: false };
}

export function isScheduleTargetDateAllowed(ymd, schmonth, schdt) {
  if (!ymd) return false;
  const { min, max, hasRange } = getScheduleTargetDateRange(schmonth, schdt);
  if (!hasRange) return false;
  return ymd >= min && ymd <= max;
}

export function formatScheduleTargetDateHint(schmonth, schdt) {
  const { min, max, hasRange, exhausted } = getScheduleTargetDateRange(schmonth, schdt);
  if (exhausted) return "No dates left in schedule month";
  if (!hasRange) return "DD/MM/YYYY";
  return `${filterDateToDisplay(min)} – ${filterDateToDisplay(max)}`;
}

export function inputDateToRemarkDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${Number(d)}/${Number(m)}/${String(y).slice(-2)}`;
}

export function buildRemarkTargetsPayload(targets) {
  return JSON.stringify(
    targets
      .filter((t) => t.date && t.qty !== "" && t.qty != null)
      .map((t) => ({ date: inputDateToRemarkDate(t.date), qty: Number(t.qty) || 0 }))
  );
}

function formatScheduleRemarksForSearch(raw) {
  if (raw == null || String(raw).trim() === "") return "";
  return formatScheduleRemarks(raw);
}

export function formatSchHeaderDate(v) {
  return formatDocDate(v) || "—";
}

function formatSchHeaderDateForSearch(v) {
  if (!v) return "";
  const formatted = formatSchHeaderDate(v);
  return formatted === "—" ? "" : formatted;
}

export function schMonthLabel(schmonth) {
  const n = Number(schmonth);
  if (!Number.isFinite(n) || n < 1 || n > 12) return "—";
  return MONTH_FULL_NAMES[n - 1];
}

function schMonthShortLabel(schmonth) {
  const n = Number(schmonth);
  if (!Number.isFinite(n) || n < 1 || n > 12) return "";
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][n - 1];
}

function collectSearchParts(values) {
  return values.filter((v) => v != null && String(v).trim() !== "" && String(v).trim() !== "—").map(String);
}

export function scheduleItemSearchParts(row) {
  return collectSearchParts([
    row.schno, row.acc_name, row.acc_code, row.item_code, row.custitemcode, row.itemdesc, row.itemdcode,
    schMonthLabel(row.schmonth), schMonthShortLabel(row.schmonth), row.schmonth,
    formatSchHeaderDateForSearch(row.schdt), row.schdt,
    row.status_label, row.status, row.action_reason,
    formatDocDate(row.action_date),
  ]);
}

export function scheduleItemWiseSearchParts(row) {
  const qty = row.totalqty ?? row.total_qty;
  const remarksRaw = row.Remarks ?? row.remarks;
  return collectSearchParts([
    ...scheduleItemSearchParts(row),
    qty, qty != null ? Number(qty).toLocaleString() : null,
    row.schedule_qty, row.dispatch_qty, row.balance_qty,
    row.fg_stock_qty, row.in_hand_qty,
    row.item_remark,
    formatScheduleRemarksForSearch(remarksRaw), remarksRaw,
    row.created_by_name, row.updated_by_name,
    formatDateTime(row.created_at), formatDateTime(row.updated_at),
    row.last_action_label, row.last_action_type, row.last_action_by_name,
    row.shortage_no,
  ]);
}

export function scheduleUniqueSearchParts(row) {
  const parts = [
    row.schno, row.acc_name, row.acc_code, schMonthLabel(row.schmonth), schMonthShortLabel(row.schmonth),
    row.schmonth, formatSchHeaderDateForSearch(row.schdt), row.schdt, row.item_count, row.total_qty,
    row.status_label, statusLabel(row.is_planned),
    row.created_by_name, row.updated_by_name, formatDateTime(row.created_at), formatDateTime(row.updated_at),
  ];
  for (const item of row._items ?? []) parts.push(...scheduleItemWiseSearchParts(item));
  return collectSearchParts(parts);
}

function pickScheduleStatusFromItems(items = []) {
  if (!items.length) {
    return {
      is_planned: SCHEDULE_PLAN_STATUS.PENDING,
      status_label: statusLabel(SCHEDULE_PLAN_STATUS.PENDING),
    };
  }
  const codes = items.map((i) => {
    if (!isDbRow(i)) return SCHEDULE_PLAN_STATUS.PENDING;
    return resolveScheduleDisplayStatus(i);
  });
  const unique = [...new Set(codes)];
  if (unique.length === 1) {
    const code = unique[0];
    return { is_planned: code, status_label: statusLabel(code) };
  }
  return { is_planned: null, status_label: "Partial" };
}

function pickScheduleAuditFromItems(items = []) {
  const dbItems = items.filter((i) => isDbRow(i));
  if (!dbItems.length) return {};
  let created = null;
  let updated = null;
  for (const item of dbItems) {
    const createdMs = item.created_at ? new Date(item.created_at).getTime() : NaN;
    const updatedMs = item.updated_at ? new Date(item.updated_at).getTime() : NaN;
    if (!Number.isNaN(createdMs) && (!created || createdMs < created.ms)) {
      created = { ms: createdMs, name: item.created_by_name, at: item.created_at };
    }
    if (!Number.isNaN(updatedMs) && (!updated || updatedMs > updated.ms)) {
      updated = { ms: updatedMs, name: item.updated_by_name, at: item.updated_at };
    }
  }
  return {
    created_by_name: created?.name ?? null,
    created_at: created?.at ?? null,
    updated_by_name: updated?.name ?? null,
    updated_at: updated?.at ?? null,
  };
}

export const SCHEDULE_AUDIT_HEADERS = [
  ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase font-bold">{v || "—"}</span>, { width: "110px" }],
  ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "130px" }],
  ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase font-bold">{v || "—"}</span>, { width: "110px" }],
  ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "130px" }],
];

export const SCHEDULE_ACTION_HEADERS = [
  ["Action Date", "action_date", (v) => <span className="text-[10px] text-slate-600 font-medium">{formatDocDate(v) || "—"}</span>, { width: "110px" }],
  ["Action Reason", "action_reason", (v) => <span className="text-[10px] text-slate-500 break-words">{v || "—"}</span>, { width: "160px", wrap: true }],
];

export function toUniqueScheduleRows(records) {
  const groups = new Map();
  for (const row of records) {
    const key = String(row.schno ?? "");
    if (!key) continue;
    if (!groups.has(key)) {
      groups.set(key, { schno: key, schdt: row.schdt, acc_name: row.acc_name, schmonth: row.schmonth, acc_code: row.acc_code, items: [] });
    }
    groups.get(key).items.push(row);
  }
  return [...groups.values()].map((g) => ({
    schno: g.schno,
    schdt: g.schdt,
    acc_name: g.acc_name,
    schmonth: g.schmonth,
    acc_code: g.acc_code,
    item_count: g.items.length,
    total_qty: g.items.reduce((sum, i) => sum + Number(i.totalqty ?? i.total_qty ?? 0), 0),
    _items: g.items,
    ...pickScheduleStatusFromItems(g.items),
    ...pickScheduleAuditFromItems(g.items),
  }));
}

export function ScheduleStatusBadge({ row }) {
  const isPartial = row?.status_label === "Partial" || row?.is_planned == null;
  const resolvedCode = isPartial ? null : resolveScheduleDisplayStatus(row);

  const label = isPartial ? "Partial" : statusLabel(resolvedCode);

  let className = "bg-slate-50 text-slate-600 border-slate-200";
  if (isPartial) className = "bg-slate-50 text-slate-600 border-slate-200";
  else if (resolvedCode === SCHEDULE_PLAN_STATUS.PENDING) {
    className = "bg-amber-50 text-amber-700 border-amber-200";
  } else if (resolvedCode === SCHEDULE_PLAN_STATUS.READY_TO_DISPATCH) {
    className = "bg-cyan-50 text-cyan-700 border-cyan-200";
  } else if (resolvedCode === SCHEDULE_PLAN_STATUS.PLANNED) {
    className = "bg-indigo-50 text-indigo-700 border-indigo-200";
  } else if (resolvedCode === SCHEDULE_PLAN_STATUS.RUNNING) {
    className = "bg-violet-50 text-violet-700 border-violet-200";
  } else if (resolvedCode === SCHEDULE_PLAN_STATUS.COMPLETE) {
    className = "bg-emerald-50 text-emerald-600 border-emerald-100";
  } else if (resolvedCode === SCHEDULE_PLAN_STATUS.REJECT) {
    className = "bg-rose-50 text-rose-700 border-rose-200";
  } else if (resolvedCode === SCHEDULE_PLAN_STATUS.HOLD) {
    className = "bg-orange-50 text-orange-700 border-orange-200";
  }

  const isPending = resolvedCode === SCHEDULE_PLAN_STATUS.PENDING;
  const isReadyToDispatch = resolvedCode === SCHEDULE_PLAN_STATUS.READY_TO_DISPATCH;
  const prefix = isPartial || (isPending && !isDbRow(row)) ? "○ " : "● ";
  const title = isPartial ? "Items in this schedule have different statuses" : undefined;
  return (
    <span
      title={title}
      className={`px-2 py-0.5 text-[9px] font-black uppercase border w-fit ${className}`}
    >
      {prefix}
      {isReadyToDispatch ? "Ready to Dispatch" : isPending ? "Pending" : label}
    </span>
  );
}

/** Simple status row colors. */
export const SCHEDULE_LIST_ROW_LEGEND = [
  { swatch: "bg-amber-50 border border-amber-200 shadow-[inset_3px_0_0_0_#f59e0b]", label: "Pending" },
  { swatch: "bg-cyan-50 border border-cyan-200 shadow-[inset_3px_0_0_0_#06b6d4]", label: "Ready to Dispatch" },
  { swatch: "bg-indigo-50 border border-indigo-200 shadow-[inset_3px_0_0_0_#6366f1]", label: "Plan" },
  { swatch: "bg-orange-50 border border-orange-200 shadow-[inset_3px_0_0_0_#f97316]", label: "Hold" },
  { swatch: "bg-rose-50 border border-rose-200 shadow-[inset_3px_0_0_0_#f43f5e]", label: "Reject" },
  { swatch: "bg-emerald-50 border border-emerald-200 shadow-[inset_3px_0_0_0_#10b981]", label: "Complete" },
];

export function getScheduleListRowClassName(row) {
  if (hasScheduleComparisonMismatch(row)) {
    return "[&_td]:bg-rose-50/70 [&_td:first-child]:shadow-[inset_3px_0_0_0_#f43f5e]";
  }

  if (row?.status_label === "Partial" && Array.isArray(row?._items) && row._items.length) {
    return "[&_td]:bg-slate-50 [&_td:first-child]:shadow-[inset_3px_0_0_0_#94a3b8]";
  }

  const status = resolveScheduleDisplayStatus(row);

  if (status === SCHEDULE_PLAN_STATUS.PENDING) {
    return "[&_td]:bg-amber-50/80 [&_td:first-child]:shadow-[inset_3px_0_0_0_#f59e0b]";
  }
  if (status === SCHEDULE_PLAN_STATUS.READY_TO_DISPATCH) {
    return "[&_td]:bg-cyan-50/80 [&_td:first-child]:shadow-[inset_3px_0_0_0_#06b6d4]";
  }
  if (status === SCHEDULE_PLAN_STATUS.PLANNED || status === SCHEDULE_PLAN_STATUS.RUNNING) {
    return "[&_td]:bg-indigo-50/80 [&_td:first-child]:shadow-[inset_3px_0_0_0_#6366f1]";
  }
  if (status === SCHEDULE_PLAN_STATUS.HOLD) {
    return "[&_td]:bg-orange-50/80 [&_td:first-child]:shadow-[inset_3px_0_0_0_#f97316]";
  }
  if (status === SCHEDULE_PLAN_STATUS.REJECT) {
    return "[&_td]:bg-rose-50/80 [&_td:first-child]:shadow-[inset_3px_0_0_0_#f43f5e]";
  }
  if (status === SCHEDULE_PLAN_STATUS.COMPLETE) {
    return "[&_td]:bg-emerald-50/70 [&_td:first-child]:shadow-[inset_3px_0_0_0_#10b981]";
  }
  return "";
}

function formatComparePlain(v, { date = false, qty = false, month = false } = {}) {
  if (v == null || v === "") return "—";
  if (date) return formatDocDate(v) || "—";
  if (qty) return Number(v || 0).toLocaleString();
  if (month) return schMonthLabel(v);
  return String(v);
}

function CompareErpDbLines({ erpText, dbText, mismatch = false }) {
  const rowClass = mismatch ? "rounded border border-rose-200 bg-rose-50 px-1 py-0.5" : "";
  const labelClass = mismatch ? "text-rose-500" : "text-slate-400";
  const textClass = mismatch ? "font-bold text-rose-700" : "font-semibold text-slate-700";

  return (
    <div className="space-y-1 text-[10px] leading-snug min-w-[120px]">
      <div className={`flex flex-wrap gap-x-1 ${rowClass}`}>
        <span className={`shrink-0 font-black uppercase text-[8px] ${labelClass}`}>ERP</span>
        <span className={`${textClass} break-words`}>{erpText}</span>
      </div>
      <div className={`flex flex-wrap gap-x-1 ${rowClass}`}>
        <span className={`shrink-0 font-black uppercase text-[8px] ${labelClass}`}>DB</span>
        <span className={`${textClass} break-words`}>{dbText}</span>
      </div>
    </div>
  );
}

const SCHEDULE_COMPARE_FIELD_LABELS = {
  schmonth: "Month",
  schdt: "Date",
  acc_code: "Party code",
  acc_name: "Party",
  item_code: "Item",
  itemdesc: "Description",
  totalqty: "Qty",
};

export function hasScheduleComparisonMismatch(row, { ignoreCustomer = true } = {}) {
  if (row?.comparison?.missing_ims) return true;
  const fields = row?.comparison?.fields || {};
  return Object.entries(fields).some(([key, f]) => {
    if (ignoreCustomer && (key === "acc_name" || key === "acc_code")) return false;
    return Boolean(f?.mismatch);
  });
}

function renderScheduleCompareCell(row, field, opts = {}) {
  if (row?.comparison?.missing_ims) {
    const dbVal = row?.comparison?.fields?.[field]?.local ?? row?.[field];
    return (
      <CompareErpDbLines
        erpText="—"
        dbText={formatComparePlain(dbVal, opts)}
        mismatch
      />
    );
  }
  const cmp = row?.comparison?.fields?.[field];
  if (!cmp) {
    return <span className="text-[10px] text-slate-400" title="No saved DB snapshot for this field">—</span>;
  }
  const ignoreMismatch = field === "acc_name" || field === "acc_code";
  return (
    <CompareErpDbLines
      erpText={formatComparePlain(cmp.ims, opts)}
      dbText={formatComparePlain(cmp.local, opts)}
      mismatch={ignoreMismatch ? false : Boolean(cmp.mismatch)}
    />
  );
}

function renderScheduleErpParty(_v, row) {
  if (row?.comparison?.missing_ims) {
    return (
      <CompareErpDbLines
        erpText="—"
        dbText={formatComparePlain(row?.acc_name ?? row?.comparison?.fields?.acc_name?.local)}
        mismatch
      />
    );
  }
  const name = row?.comparison?.fields?.acc_name?.ims ?? row?.acc_name ?? "—";
  return (
    <span className="font-bold text-slate-900 text-[10px] uppercase break-words leading-snug" title={name}>
      {name}
    </span>
  );
}

function renderScheduleMismatchSummary(_v, row) {
  if (row?.comparison?.missing_ims) {
    return <span className="text-[9px] font-bold uppercase text-rose-700">Not in ERP</span>;
  }
  const fields = row?.comparison?.fields || {};
  const keys = Object.keys(fields).filter(
    (k) => k !== "acc_name" && k !== "acc_code" && fields[k]?.mismatch
  );
  if (!keys.length) return <span className="text-[10px] text-slate-400">—</span>;
  return (
    <span className="text-[9px] font-bold uppercase text-rose-700 leading-snug">
      {keys.map((k) => SCHEDULE_COMPARE_FIELD_LABELS[k] || k).join(", ")}
    </span>
  );
}

function renderScheduleGroupMismatch(_v, row) {
  const items = row?._items ?? [];
  if (!items.length) return <span className="text-[10px] text-slate-400">—</span>;
  const labels = new Set();
  for (const item of items) {
    if (item?.comparison?.missing_ims) {
      labels.add("Not in ERP");
      continue;
    }
    const fields = item?.comparison?.fields || {};
    for (const [k, f] of Object.entries(fields)) {
      if (k !== "acc_name" && k !== "acc_code" && f?.mismatch) {
        labels.add(SCHEDULE_COMPARE_FIELD_LABELS[k] || k);
      }
    }
  }
  if (!labels.size) return <span className="text-[10px] text-slate-400">—</span>;
  return (
    <span className="text-[9px] font-bold uppercase text-rose-700 leading-snug break-words">
      {[...labels].join(", ")}
    </span>
  );
}

export function buildScheduleItemWiseComparisonHeaders({ onDrillToItems } = {}) {
  return [
    [
      "Sch No",
      "schno",
      (v, row) => scheduleDrillButton(row, v || "—", onDrillToItems, "Show all items in this schedule"),
      { fixed: true, width: "100px" },
    ],
    ["Month", "schmonth", (_v, row) => renderScheduleCompareCell(row, "schmonth", { month: true }), { width: "140px", wrap: true }],
    ["Date", "schdt", (_v, row) => renderScheduleCompareCell(row, "schdt", { date: true }), { width: "140px", wrap: true }],
    ["Custommer", "acc_name", renderScheduleErpParty, { width: "200px", wrap: true }],
    ["Item", "item_code", (_v, row) => renderScheduleCompareCell(row, "item_code"), { width: "140px", wrap: true }],
    ["Cust. Item Code", "custitemcode", (_v, row) => (
      <span className="font-bold text-slate-900 text-[10px] uppercase">{row.custitemcode || "—"}</span>
    ), { width: "140px", wrap: true, copyValue: (row) => row.custitemcode || "—" }],
    ["Description", "itemdesc", (_v, row) => renderScheduleCompareCell(row, "itemdesc"), { width: "200px", wrap: true }],
    ["Qty", "totalqty", (_v, row) => renderScheduleCompareCell(row, "totalqty", { qty: true }), { width: "140px", wrap: true }],
    ["Mismatch", "has_comparison_mismatch", renderScheduleMismatchSummary, { width: "120px", wrap: true }],
    ["Status", "is_planned", (_v, row) => <ScheduleStatusBadge row={row} />, { width: "100px" }],
  ];
}

export function buildScheduleUniqueComparisonHeaders({ onDrillToItems } = {}) {
  return [
    [
      "Sch No",
      "schno",
      (v, row) => scheduleDrillButton(row, v || "—", onDrillToItems, `View ${row.item_count ?? 0} mismatch item(s)`),
      { fixed: true, width: "100px" },
    ],
    ["Date", "schdt", (v) => <span className="text-slate-600 font-bold text-[10px] uppercase">{formatSchHeaderDate(v)}</span>, { width: "100px" }],
    ["Custommer", "acc_name", (v) => (
      <span className="font-bold text-slate-900 text-[10px] uppercase break-words leading-snug" title={v}>{v || "—"}</span>
    ), { width: "220px", wrap: true }],
    ["Items", "item_count", (v) => <span className="font-black text-[11px] tabular-nums">{Number(v ?? 0).toLocaleString()}</span>, { align: "center", width: "80px" }],
    ["Mismatch", "has_comparison_mismatch", renderScheduleGroupMismatch, { width: "200px", wrap: true }],
  ];
}

function scheduleDrillButton(row, label, onDrillToItems, title) {
  if (!onDrillToItems || !row?.schno) return label;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onDrillToItems(row);
      }}
      className="font-mono text-indigo-600 font-bold text-[10px] uppercase hover:underline cursor-pointer"
      title={title}
    >
      {label}
    </button>
  );
}

export function buildScheduleUniqueHeaders({ onDrillToItems } = {}) {
  return [
    [
      "Sch No",
      "schno",
      (v, row) => scheduleDrillButton(row, v || "—", onDrillToItems, `View ${row.item_count ?? 0} item(s) in item-wise list`),
      { fixed: true, width: "100px" },
    ],
    ["Date", "schdt", (v) => <span className="text-slate-600 font-bold text-[10px] uppercase">{formatSchHeaderDate(v)}</span>, { width: "100px" }],
    ["Customer", "acc_name", (v) => (
      <span className="font-bold text-slate-900 text-[10px] uppercase whitespace-normal break-words leading-snug" title={v}>{v || "—"}</span>
    ), { width: "280px", wrap: true, copyValue: (row) => row.acc_name || "—" }],
    ["Month", "schmonth", (_v, row) => <span className="text-[10px] text-slate-600 font-medium">{schMonthLabel(row.schmonth)}</span>, { width: "110px" }],
    [
      "Items",
      "item_count",
      (v, row) => scheduleDrillButton(
        row,
        <span className="font-black text-[11px] tabular-nums">{Number(v ?? 0).toLocaleString()}</span>,
        onDrillToItems,
        `Open ${Number(v ?? 0).toLocaleString()} item(s) in Schedule Item Wise`
      ),
      { align: "center", width: "80px" },
    ],
    ["Total Qty", "total_qty", (v) => <span className="font-black text-slate-700 text-[11px] tabular-nums">{Number(v ?? 0).toLocaleString()}</span>, { align: "center", width: "110px" }],
    ["Status", "is_planned", (_v, row) => <ScheduleStatusBadge row={row} />, { align: "center", width: "140px", copyValue: (row) => row.status_label || statusLabel(row.is_planned) }],
    ...SCHEDULE_AUDIT_HEADERS,
  ];
}

export const SCHEDULE_UNIQUE_HEADERS = buildScheduleUniqueHeaders();

export function buildScheduleItemWiseHeaders({ onDrillToItems, onViewHistory } = {}) {
  return [
    [
      "Sch No",
      "schno",
      (v, row) => scheduleDrillButton(row, v || "—", onDrillToItems, "Show all items in this schedule"),
      { fixed: true, width: "100px" },
    ],
    ["Date", "schdt", (v) => <span className="text-slate-600 font-bold text-[10px] uppercase">{formatSchHeaderDate(v)}</span>, { width: "100px" }],
    ["Status", "is_planned", (_v, row) => <ScheduleStatusBadge row={row} />, { align: "center", width: "160px", copyValue: (row) => row.status_label || statusLabel(row.is_planned) }],
    ["Last Action", "last_action_label", (_v, row) => {
        const label = row.last_action_label || "—";
        const meta = formatLastActionMeta(row);
        return (
          <div className="flex flex-col items-start gap-0.5 min-w-0">
            <span className={`${IMS_TABLE_CELL_TEXT} text-slate-800 uppercase`}>{label}</span>
            {meta ? (
              <span className="text-[9px] text-slate-500 leading-snug break-words whitespace-normal" title={meta}>
                {meta}
              </span>
            ) : null}
            {onViewHistory && row.last_action_type ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewHistory(row);
                }}
                className="text-[10px] font-bold uppercase text-indigo-600 hover:underline"
              >
                View
              </button>
            ) : null}
          </div>
        );
      },
      {
        width: "220px",
        wrap: true,
        copyValue: (row) => {
          const label = row.last_action_label || "";
          const meta = formatLastActionMeta(row);
          return [label, meta].filter(Boolean).join(" | ") || "—";
        },
      },
    ],
    ["Customer", "acc_name", (v) => (
      <span className="font-bold text-slate-900 text-[10px] uppercase whitespace-normal break-words leading-snug" title={v}>{v || "—"}</span>
    ), { width: "220px", wrap: true, copyValue: (row) => row.acc_name || "—" }],
    ["Month", "schmonth", (_v, row) => <span className="text-[10px] text-slate-600 font-medium">{schMonthLabel(row.schmonth)}</span>, { width: "100px" }],
    ["Item Code", "item_code", (v) => <span className="font-bold text-slate-900 text-[10px] uppercase">{v || "—"}</span>, { width: "160px" }],
    ["Cust. Item Code", "custitemcode", (v) => <span className="font-bold text-slate-900 text-[10px] uppercase">{v || "—"}</span>, { width: "140px", copyValue: (row) => row.custitemcode || "—" }],
    ["Description", "itemdesc", (v) => <span className={`${IMS_TABLE_CELL_TEXT} break-words`}>{v || "—"}</span>, { width: "220px", wrap: true }],
    ["Schedule Qty", "totalqty", (v, row) => (
      <span className="font-black text-slate-700 text-[11px] tabular-nums">
        {Number(v ?? row.schedule_qty ?? row.total_qty ?? 0).toLocaleString()}
      </span>
    ), { align: "center", width: "100px" }],
    ["FG Stock", "in_hand_qty", (v, row) => (
      <span className="font-black text-emerald-700 text-[11px] tabular-nums">{Number(v ?? row.fg_stock_qty ?? 0).toLocaleString()}</span>
    ), { align: "center", width: "90px" }],
    ["Balance Qty", "balance_qty", (v, row) => (
      <span className="font-black text-slate-700 text-[11px] tabular-nums">{Number(v ?? 0).toLocaleString()}</span>
    ), { align: "center", width: "95px" }],
    ["Dispatch Qty", "dispatch_qty", (v, row) => (
      <span className="font-black text-slate-600 text-[11px] tabular-nums">{Number(v ?? 0).toLocaleString()}</span>
    ), { align: "center", width: "95px" }],
    ["Shortage No", "shortage_no", (v) => (
      <span className="font-bold text-amber-800 text-[10px] tabular-nums uppercase">{v || "—"}</span>
    ), { align: "center", width: "110px", copyValue: (row) => row.shortage_no || "—" }],
    ["Cust. Request", "remarks", (_v, row) => (
      <ScheduleCustRequestCell raw={row.Remarks ?? row.remarks} />
    ), { width: "150px", wrap: true }],
    ...SCHEDULE_ACTION_HEADERS,
    ...SCHEDULE_AUDIT_HEADERS
  ];
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { loanService } from "@/apps/hrms/lib/services/hrms";
import { employeeHelperRows, fetchEmployeeByDcode, fetchEmployeeViews } from "@/apps/hrms/lib/helpers/employeeHelper";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { IMS_DRAWER_BTN_APPROVE, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_CLOSE, IMS_DRAWER_BTN_PRIMARY, IMS_DRAWER_FOOTER_WRAP } from "@/apps/ims/lib/helpers/masterListUi";
import { canApproveAsManager } from "@/apps/hrms/lib/gatePassUtils";
import { useSelector } from "react-redux";
import {
  LOAN_TYPE_OPTIONS,
  GP_FIELD,
  GP_LABEL,
  GP_ROW2,
  ReadonlyField,
  TextInput,
  emptyLoanForm,
  empPickerRow,
  empResolved,
  formatRupee,
  isPendingApprove,
  isPendingManager,
  loanPayload,
  parseRupeeInput,
  rebuildFormSchedule,
  adjustScheduleRow,
  scheduleSum,
  scheduleMatchesAmount,
  toLoanForm,
  validateLoanForm,
} from "@/apps/hrms/lib/loanUtils";

const MODULE = "hrms_loan";
const DRAWER_DESC = "Employee loan / advance";
const NUM = "tabular-nums";

const TITLES = {
  add: "New Loan / Advance",
  edit: "Edit Loan / Advance",
  "verify-approve": "Loan / Advance",
  "verify-manager": "Loan / Advance",
  view: "View Loan / Advance",
};

function AmountInput({ label, value, error, onCommit, disabled, required, placeholder }) {
  return (
    <TextInput
      label={label}
      required={required}
      error={error}
      disabled={disabled}
      type="text"
      inputMode="decimal"
      placeholder={placeholder || "0.00"}
      value={value === "" || value == null ? "" : String(value)}
      onChange={(e) => {
        let s = String(e.target.value ?? "").replace(/[^\d.]/g, "");
        const dot = s.indexOf(".");
        if (dot >= 0) s = `${s.slice(0, dot + 1)}${s.slice(dot + 1).replace(/\./g, "").slice(0, 2)}`;
        onCommit(s === "" || s === "." ? "" : s);
      }}
      onBlur={() => onCommit(parseRupeeInput(value))}
      onPaste={(e) => {
        e.preventDefault();
        onCommit(parseRupeeInput(e.clipboardData.getData("text")));
      }}
      onKeyDown={(e) => {
        if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
      }}
    />
  );
}

function SchedulePreview({ schedule, loanAmount, editable, onChangeAmount, error }) {
  if (!schedule?.length) return null;
  const sum = scheduleSum(schedule);
  const total = Number(loanAmount) || 0;
  const ok = scheduleMatchesAmount(schedule, total);
  const last = schedule.length - 1;
  return (
    <div className="space-y-1.5">
      <span className={GP_LABEL}>EMI Schedule</span>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200">
        <div className="sticky top-0 z-[1] flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          <span className="w-24 shrink-0">Month</span>
          <span className="min-w-0 flex-1">Amount</span>
        </div>
        {schedule.map((row, i) => {
          const locked = !editable || (i === last && schedule.length > 1);
          const val = row.amount === "" || row.amount == null ? "" : String(row.amount);
          return (
            <div key={row.month} className="flex items-center gap-3 border-b border-slate-100 px-3 py-1.5 last:border-b-0">
              <span className="w-24 shrink-0 tabular-nums text-[11px] font-semibold text-slate-700">{row.month}</span>
              <input
                type="text"
                inputMode="numeric"
                disabled={locked}
                className={`min-w-0 flex-1 h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-900 outline-none focus:border-indigo-400 ${
                  locked ? "bg-slate-50 text-slate-600" : ""
                }`}
                value={val}
                onChange={(e) => {
                  if (locked) return;
                  const s = String(e.target.value ?? "").replace(/[^\d]/g, "");
                  onChangeAmount(i, s === "" ? "" : s, false);
                }}
                onBlur={() => {
                  if (!locked) onChangeAmount(i, parseRupeeInput(row.amount), true);
                }}
                onKeyDown={(e) => {
                  if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
                }}
              />
            </div>
          );
        })}
      </div>
      <p className={`text-[11px] font-semibold ${ok ? "text-emerald-700" : "text-rose-600"}`}>
        Sum {formatRupee(sum)} / Loan {formatRupee(total)}
        {ok ? " · Exact" : " · Must match loan amount"}
      </p>
      {error ? <p className="text-[10px] font-semibold text-rose-600">{error}</p> : null}
    </div>
  );
}

function LoanReadonlyFields({
  r,
  showSup = false,
  showApprove = false,
  remark = "",
  onRemarkChange,
  saving = false,
  deductions = [],
  summary = null,
}) {
  if (!r) return null;
  const rows = (Array.isArray(deductions) ? deductions : []).filter((x) => x.type === "loan" || x.type === "advance" || x.type === "E");
  return (
    <div className="space-y-4">
      <div className={GP_ROW2}>
        <ReadonlyField label="Emp Code" value={r.emp_code || "—"} />
        <ReadonlyField label="Name" value={r.emp_name || "—"} />
      </div>
      <div className={GP_ROW2}>
        <ReadonlyField label="Department" value={r.deptname || "—"} />
        <ReadonlyField label="Status" value={summary?.closed ? "Closed" : r.status_display || "—"} />
      </div>
      <div className={GP_ROW2}>
        <ReadonlyField label="Type" value={r.type_display || r.type || "—"} />
        <ReadonlyField label="Amount" value={formatRupee(r.amount)} tabular />
      </div>
      <div className={GP_ROW2}>
        <ReadonlyField label="EMI Months" value={r.emi_months != null ? String(r.emi_months) : "—"} tabular />
        <ReadonlyField label="First EMI" value={formatRupee(r.emi_amount)} tabular />
      </div>
      <ReadonlyField label="Start Month" value={r.start_month_display || "—"} tabular />
      <ReadonlyField label="Reason" value={r.reason || "—"} />

      {summary ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total</p>
              <p className={`text-base font-black text-slate-800 ${NUM}`}>{formatRupee(summary.total)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Paid (EMI)</p>
              <p className={`text-base font-black text-emerald-700 ${NUM}`}>{formatRupee(summary.paid)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Balance (EMI)</p>
              <p className={`text-base font-black text-slate-800 ${NUM}`}>{formatRupee(summary.balance)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Next due</p>
              <p className={`text-base font-black text-slate-800 ${NUM}`}>{summary.next_due || "—"}</p>
            </div>
          </div>
          {summary.closed ? <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700">Closed</p> : null}
        </div>
      ) : null}

      {rows.length ? (
        <div className="space-y-2">
          <span className={GP_LABEL}>EMI Schedule</span>
          <div className="max-h-56 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 text-slate-500 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left font-bold">Month</th>
                  <th className="px-2 py-1 text-left font-bold">Amount</th>
                  <th className="px-2 py-1 text-left font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const pending = !row.deducted_at;
                  const tone = !pending ? "text-emerald-700" : row.overdue ? "text-rose-600" : "text-slate-800";
                  return (
                    <tr key={row.id} className={`border-t border-slate-100 ${row.overdue ? "bg-rose-50" : ""}`}>
                      <td className="px-2 py-1 tabular-nums">{row.month}</td>
                      <td className={`px-2 py-1 font-bold tabular-nums ${tone}`}>{formatRupee(row.amount)}</td>
                      <td className={`px-2 py-1 font-bold ${tone}`}>{row.status_display}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className={GP_ROW2}>
        <ReadonlyField label="Manager By" value={r.sup_by || "—"} />
        <ReadonlyField label="Manager At" value={r.sup_at_display || "—"} tabular />
      </div>
      {showSup ? (
        <FormTextarea label="Remark" required rows={3} value={remark} onChange={onRemarkChange} placeholder="Enter remark" disabled={saving} />
      ) : (
        <ReadonlyField label="Manager Remark" value={r.sup_remarks || "—"} />
      )}
      <div className={GP_ROW2}>
        <ReadonlyField label="Approved By" value={r.approved_by || "—"} />
        <ReadonlyField label="Approved At" value={r.approved_at_display || "—"} tabular />
      </div>
      {showApprove ? (
        <FormTextarea label="Remark" required rows={3} value={remark} onChange={onRemarkChange} placeholder="Enter remark" disabled={saving} />
      ) : (
        <ReadonlyField label="Approved Remark" value={r.approved_remarks || "—"} />
      )}
    </div>
  );
}

async function runAction(fn, okMsg, onSuccess, onClose, setSaving) {
  setSaving(true);
  try {
    const res = await fn();
    if (!res?.success) throw new Error(res?.message || "Request failed.");
    toast.success(res.message || okMsg);
    onSuccess?.();
    onClose?.();
  } catch (e) {
    toast.error(e.message || "Request failed.");
  } finally {
    setSaving(false);
  }
}

export default function LoanDrawer({ open, mode = "add", record = null, onClose, onSuccess }) {
  const readOnly = mode === "view" || mode.startsWith("verify-");
  const canAccess = useCanAccess();
  const authUser = useSelector((s) => s.auth?.user);
  const authRole = useSelector((s) => s.auth?.role);
  const canMgr = canApproveAsManager({ ...authUser, type: authUser?.type || authRole, role: authRole });
  const [form, setForm] = useState(() => toLoanForm(record));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [remark, setRemark] = useState("");
  const [deductions, setDeductions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loanView, setLoanView] = useState(record);
  const sopAckRef = useRef(null);
  const sopPermissionType =
    mode === "verify-approve" ? "authorize" : mode === "verify-manager" ? "view" : mode === "edit" ? "edit" : mode === "add" ? "add" : "view";
  const patch = useCallback((p) => setForm((f) => ({ ...f, ...p })), []);
  const clr = useCallback((...keys) => {
    setErrors((prev) => {
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      return next;
    });
  }, []);

  const reloadDeductions = useCallback(async (loanId) => {
    if (!loanId) return null;
    const res = await loanService.deductionsList({ loan_id: loanId });
    if (!res?.success) return null;
    setDeductions(Array.isArray(res.data) ? res.data : []);
    setSummary(res.summary || null);
    if (res.loan) setLoanView(res.loan);
    return res;
  }, []);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setRemark("");
    setLoanView(record);
    let cancelled = false;
    (async () => {
      if (record?.id) {
        const res = await reloadDeductions(record.id);
        if (cancelled) return;
        if (mode === "edit" && res?.data?.length) {
          const schedule = res.data
            .filter((d) => d.type === "loan" || d.type === "advance" || d.type === "E")
            .map((d) => ({ month: d.month, amount: Number(d.amount) }));
          setForm({
            ...toLoanForm(record),
            schedule,
            first_month_amount: schedule[0] ? String(schedule[0].amount) : "",
          });
          return;
        }
      } else {
        setDeductions([]);
        setSummary(null);
      }
      if (!cancelled) setForm(toLoanForm(record));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, record, mode, reloadDeductions]);

  const empAction = mode === "add" ? "add" : "edit";
  const fetchEmployees = useCallback(
    async (params) => {
      const res = await fetchEmployeeViews({ pageModule: MODULE, pageAction: empAction, ...params });
      const data = employeeHelperRows(res.data).map(empPickerRow);
      return { data, total: res.total ?? data.length };
    },
    [empAction]
  );
  const getEmployeeByDcode = useCallback(
    async (id) => empPickerRow(await fetchEmployeeByDcode({ pageModule: MODULE, pageAction: empAction, emp_dcode: id })),
    [empAction]
  );
  const onEmpChange = useCallback((item) => {
    setErrors({});
    if (!item) return setForm(emptyLoanForm());
    const dcode = item.emp_dcode ?? item.id;
    setForm((f) =>
      rebuildFormSchedule({
        ...f,
        emp_dcode: dcode != null && Number(dcode) > 0 ? Number(dcode) : "",
        emp_code: item.emp_code || "",
        emp_name: item.emp_name || "",
        deptname: item.deptname || "",
      })
    );
  }, []);

  const empOpt = useMemo(() => empResolved(form), [form]);
  const canAdd = canAccess(MODULE, "add").allowed;
  const canEdit = canAccess(MODULE, "edit").allowed;
  const canAuthorize = canAccess(MODULE, "authorize").allowed;
  const canView = canAccess(MODULE, "view").allowed;
  const showApprove = mode === "verify-approve" && canAuthorize && isPendingApprove(record);
  const showSup = mode === "verify-manager" && canMgr && isPendingManager(record);
  const canSaveForm = (mode === "add" && canAdd) || (mode === "edit" && canEdit);
  const isAdvance = form.type === "advance";
  const r = loanView || record;

  useEffect(() => {
    if (!open) return;
    const allowed =
      (mode === "add" && canAdd) ||
      (mode === "edit" && canEdit) ||
      (mode === "view" && canView) ||
      (mode === "verify-manager" && canMgr) ||
      (mode === "verify-approve" && canAuthorize);
    if (!allowed) {
      toast.error("You do not have permission for this action.");
      onClose?.();
    }
  }, [open, mode, canAdd, canEdit, canView, canAuthorize, canMgr, onClose]);

  const save = () => {
    if (!canSaveForm) return toast.error("You do not have permission for this action.");
    if (!sopAckRef.current?.assertAcknowledged()) return;
    const next = validateLoanForm(form);
    setErrors(next);
    if (Object.keys(next).length) return toast.error(next.schedule || "Please fix the highlighted fields.");
    void runAction(
      () => loanService[mode === "edit" ? "update" : "submit"]({ ...(mode === "edit" ? { id: record?.id } : {}), ...loanPayload(form) }),
      mode === "edit" ? "Updated." : "Saved.",
      onSuccess,
      onClose,
      setSaving
    );
  };

  const isView = mode === "view";
  const showFormFooter = !readOnly && canSaveForm;
  const closeOnly = isView || (readOnly && !showApprove && !showSup);

  const decide = (fn, okMsg) => {
    if (!sopAckRef.current?.assertAcknowledged()) return;
    const text = String(remark).trim();
    if (!text) return toast.warning("Remark is required.");
    void runAction(() => fn({ id: r?.id, remarks: text }), okMsg, onSuccess, onClose, setSaving);
  };

  const footer = (
    <div className={IMS_DRAWER_FOOTER_WRAP}>
      <button type="button" onClick={onClose} disabled={saving} className={closeOnly ? IMS_DRAWER_BTN_CLOSE : IMS_DRAWER_BTN_CANCEL}>
        {closeOnly ? "Close" : "Cancel"}
      </button>
      {showFormFooter ? (
        <button type="button" title="Ctrl+S" onClick={save} disabled={saving} className={IMS_DRAWER_BTN_PRIMARY}>
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {mode === "edit" ? "Update" : "Save"}
        </button>
      ) : null}
      {showSup ? (
        <button type="button" title="Ctrl+S" disabled={saving} className={IMS_DRAWER_BTN_APPROVE} onClick={() => decide(loanService.verifyManager, "Manager approval done.")}>
          {saving ? <Loader2 size={18} className="animate-spin" /> : null}
          Manager Approve
        </button>
      ) : null}
      {showApprove ? (
        <button type="button" title="Ctrl+S" disabled={saving} className={IMS_DRAWER_BTN_APPROVE} onClick={() => decide(loanService.verifyApprove, "Approved.")}>
          {saving ? <Loader2 size={18} className="animate-spin" /> : null}
          Approve
        </button>
      ) : null}
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={showFormFooter ? save : showSup ? () => decide(loanService.verifyManager, "Manager approval done.") : showApprove ? () => decide(loanService.verifyApprove, "Approved.") : undefined}
      title={TITLES[mode] || TITLES.view}
      description={DRAWER_DESC}
      maxWidth="max-w-2xl"
      footer={footer}
    >
      <div className="space-y-4 pb-4">
        {readOnly ? (
          <LoanReadonlyFields
            r={r}
            showSup={showSup}
            showApprove={showApprove}
            remark={remark}
            onRemarkChange={(e) => setRemark(e.target.value)}
            saving={saving}
            deductions={deductions}
            summary={summary}
          />
        ) : (
          <>
            <SearchableSelect
              label="Employee"
              required
              key={empOpt ? `emp-${empOpt.emp_dcode}` : "emp-empty"}
              value={form.emp_dcode || null}
              onChange={(id, item) => {
                if (id == null && !item) return onEmpChange(null);
                if (item?.emp_name || item?.emp_code || item?.display_label) return onEmpChange(item);
                if (id != null) void getEmployeeByDcode(id).then((row) => row && onEmpChange(row));
              }}
              fetchService={fetchEmployees}
              getByIdService={getEmployeeByDcode}
              dataKey="emp_dcode"
              labelKey="emp_name"
              selectedLabelKey="display_label"
              subLabelKey="emp_code"
              listHintKey="deptname"
              listHintLabel="Dept"
              placeholder="Search employee…"
              heightClass="h-[38px]"
              resolvedOption={empOpt}
              error={errors.emp_dcode || ""}
            />
            <div className={GP_ROW2}>
              <ReadonlyField label="Name" value={form.emp_name || "—"} />
              <ReadonlyField label="Department" value={form.deptname || "—"} />
            </div>
            <div className={GP_ROW2}>
              <div className="space-y-1">
                <label className={GP_LABEL}>
                  Type <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    className={`${GP_FIELD} appearance-none pr-10`}
                    value={form.type}
                    onChange={(e) => {
                      const type = e.target.value;
                      clr("type", "emi_months", "schedule");
                      setForm((f) =>
                        rebuildFormSchedule({
                          ...f,
                          type,
                          emi_months: type === "advance" ? "1" : f.emi_months === "1" ? "6" : f.emi_months,
                          first_month_amount: "",
                        })
                      );
                    }}
                  >
                    {LOAN_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>
              </div>
              <AmountInput
                label="Amount"
                required
                value={form.amount}
                error={errors.amount}
                onCommit={(n) => {
                  clr("amount", "schedule");
                  setForm((f) => rebuildFormSchedule({ ...f, amount: n }));
                }}
              />
            </div>
            <div className={GP_ROW2}>
              <TextInput
                label="EMI Months"
                required
                type="number"
                min="1"
                step="1"
                className="tabular-nums"
                value={isAdvance ? "1" : form.emi_months}
                error={errors.emi_months}
                disabled={isAdvance}
                onChange={(e) => {
                  clr("emi_months", "schedule");
                  setForm((f) => rebuildFormSchedule({ ...f, emi_months: e.target.value, first_month_amount: "" }));
                }}
              />
              <TextInput
                label="Start Month"
                required
                type="month"
                value={form.start_month}
                error={errors.start_month}
                onChange={(e) => {
                  clr("start_month", "schedule");
                  setForm((f) => rebuildFormSchedule({ ...f, start_month: e.target.value }));
                }}
              />
            </div>
            <SchedulePreview
              schedule={form.schedule}
              loanAmount={form.amount}
              editable={!isAdvance}
              error={errors.schedule}
              onChangeAmount={(index, value, finalize = true) => {
                clr("schedule", "first_month_amount");
                setForm((f) => {
                  if (!finalize) {
                    const schedule = (f.schedule || []).map((row, i) => (i === index ? { ...row, amount: value } : row));
                    return { ...f, schedule };
                  }
                  const schedule = adjustScheduleRow(f.schedule, f.amount, index, value);
                  return {
                    ...f,
                    schedule,
                    first_month_amount: schedule[0] != null ? String(schedule[0].amount) : "",
                  };
                });
              }}
            />
            <FormTextarea
              label="Reason"
              labelClassName={GP_LABEL}
              required
              rows={3}
              value={form.reason}
              error={errors.reason}
              placeholder="Reason for loan / advance"
              onChange={(e) => {
                clr("reason");
                patch({ reason: e.target.value });
              }}
            />
          </>
        )}
        {mode !== "view" ? (
          <ModuleSopAcknowledgment ref={sopAckRef} key={`${open}-${sopPermissionType}`} isOpen={open} moduleSlug={MODULE} permissionType={sopPermissionType} />
        ) : null}
      </div>
    </Drawer>
  );
}

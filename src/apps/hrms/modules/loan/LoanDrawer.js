"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import { loanService } from "@/apps/hrms/lib/services/hrms";
import { employeeHelperRows, fetchEmployeeByDcode, fetchEmployeeViews } from "@/apps/hrms/lib/helpers/employeeHelper";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { IMS_DRAWER_BTN_APPROVE, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_CLOSE, IMS_DRAWER_BTN_PRIMARY, IMS_DRAWER_FOOTER_WRAP } from "@/apps/ims/lib/helpers/masterListUi";
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
  formEmiPreview,
  isPendingHr,
  isPendingManager,
  loanPayload,
  toLoanForm,
  validateLoanForm,
} from "@/apps/hrms/lib/loanUtils";

const MODULE = "hrms_loan";
const DRAWER_DESC = "Employee loan / advance";

const TITLES = {
  add: "New Loan / Advance",
  edit: "Edit Loan / Advance",
  "verify-hr": "Loan / Advance",
  "verify-manager": "Loan / Advance",
  view: "View Loan / Advance",
};

export function LoanReadonlyFields({ r }) {
  if (!r) return null;
  const schedule = Array.isArray(r.emi_schedule) ? r.emi_schedule : [];
  return (
    <div className="space-y-4">
      <div className={GP_ROW2}>
        <ReadonlyField label="Emp Code" value={r.emp_code || "—"} />
        <ReadonlyField label="Name" value={r.emp_name || "—"} />
      </div>
      <div className={GP_ROW2}>
        <ReadonlyField label="Department" value={r.deptname || "—"} />
        <ReadonlyField label="Status" value={r.status_display || "—"} />
      </div>
      <div className={GP_ROW2}>
        <ReadonlyField label="Type" value={r.type_display || r.type || "—"} />
        <ReadonlyField label="Amount" value={r.amount != null ? String(r.amount) : "—"} tabular />
      </div>
      <div className={GP_ROW2}>
        <ReadonlyField label="EMI Months" value={r.emi_months != null ? String(r.emi_months) : "—"} tabular />
        <ReadonlyField label="EMI Amount" value={r.emi_amount != null ? String(r.emi_amount) : "—"} tabular />
      </div>
      <ReadonlyField label="Start Month" value={r.start_month_display || "—"} tabular />
      <ReadonlyField label="Reason" value={r.reason || "—"} />
      {schedule.length ? (
        <div className="space-y-1">
          <span className={GP_LABEL}>EMI Schedule</span>
          <div className="max-h-40 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-1 text-left font-bold">Month</th>
                  <th className="px-2 py-1 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row) => (
                  <tr key={row.month} className="border-t border-slate-100">
                    <td className="px-2 py-1 tabular-nums">{row.month}</td>
                    <td className="px-2 py-1 text-right tabular-nums font-bold">{row.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
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
  const [form, setForm] = useState(() => toLoanForm(record));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const patch = useCallback((p) => setForm((f) => ({ ...f, ...p })), []);
  const clr = useCallback((...keys) => {
    setErrors((prev) => {
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      return next;
    });
  }, []);

  useEffect(() => {
    if (open) {
      setForm(toLoanForm(record));
      setErrors({});
    }
  }, [open, record, mode]);

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
    setForm((f) => ({
      ...f,
      emp_dcode: dcode != null && Number(dcode) > 0 ? Number(dcode) : "",
      emp_code: item.emp_code || "",
      emp_name: item.emp_name || "",
      deptname: item.deptname || "",
    }));
  }, []);

  const empOpt = useMemo(() => empResolved(form), [form]);
  const emiPreview = useMemo(() => formEmiPreview(form), [form]);
  const canAdd = canAccess(MODULE, "add").allowed;
  const canEdit = canAccess(MODULE, "edit").allowed;
  const canAuthorize = canAccess(MODULE, "authorize").allowed;
  const canView = canAccess(MODULE, "view").allowed;
  const showHr = mode === "verify-hr" && canAuthorize && isPendingHr(record);
  const showSup = mode === "verify-manager" && canEdit && isPendingManager(record);
  const canSaveForm = (mode === "add" && canAdd) || (mode === "edit" && canEdit);
  const isAdvance = form.type === "advance";

  useEffect(() => {
    if (!open) return;
    const allowed =
      (mode === "add" && canAdd) ||
      (mode === "edit" && canEdit) ||
      (mode === "view" && canView) ||
      (mode === "verify-manager" && canEdit) ||
      (mode === "verify-hr" && canAuthorize);
    if (!allowed) {
      toast.error("You do not have permission for this action.");
      onClose?.();
    }
  }, [open, mode, canAdd, canEdit, canView, canAuthorize, onClose]);

  const save = () => {
    if (!canSaveForm) {
      toast.error("You do not have permission for this action.");
      return;
    }
    const next = validateLoanForm(form);
    setErrors(next);
    if (Object.keys(next).length) return toast.error("Please fix the highlighted fields.");
    void runAction(
      () =>
        loanService[mode === "edit" ? "update" : "submit"]({
          ...(mode === "edit" ? { id: record?.id } : {}),
          ...loanPayload(form),
        }),
      mode === "edit" ? "Updated." : "Saved.",
      onSuccess,
      onClose,
      setSaving
    );
  };

  const r = record;
  const isView = mode === "view";
  const showFormFooter = !readOnly && canSaveForm;
  const closeOnly = isView || (readOnly && !showHr && !showSup);

  const footer = (
    <div className={IMS_DRAWER_FOOTER_WRAP}>
      <button type="button" onClick={onClose} disabled={saving} className={closeOnly ? IMS_DRAWER_BTN_CLOSE : IMS_DRAWER_BTN_CANCEL}>
        {closeOnly ? "Close" : "Cancel"}
      </button>
      {showFormFooter ? (
        <button type="button" onClick={save} disabled={saving} className={IMS_DRAWER_BTN_PRIMARY}>
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          {mode === "edit" ? "Update" : "Save"}
        </button>
      ) : null}
      {showSup ? (
        <button
          type="button"
          disabled={saving}
          className={IMS_DRAWER_BTN_APPROVE}
          onClick={() =>
            runAction(() => loanService.verifyManager({ id: r?.id }), "Supervisor approval done.", onSuccess, onClose, setSaving)
          }
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : null}
          Supervisor Approve
        </button>
      ) : null}
      {showHr ? (
        <button
          type="button"
          disabled={saving}
          className={IMS_DRAWER_BTN_APPROVE}
          onClick={() => runAction(() => loanService.verifyHr({ id: r?.id }), "HR approval done.", onSuccess, onClose, setSaving)}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : null}
          HR Approve
        </button>
      ) : null}
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={showFormFooter ? save : undefined}
      title={TITLES[mode] || TITLES.view}
      description={DRAWER_DESC}
      maxWidth="max-w-2xl"
      footer={footer}
    >
      <div className="space-y-4 pb-4">
        {readOnly ? (
          <LoanReadonlyFields r={r} />
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
                      clr("type", "emi_months");
                      patch({ type, emi_months: type === "advance" ? "1" : form.emi_months === "1" ? "6" : form.emi_months });
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
              <TextInput
                label="Amount"
                required
                type="number"
                min="1"
                step="0.01"
                className="tabular-nums"
                value={form.amount}
                error={errors.amount}
                onChange={(e) => {
                  clr("amount");
                  patch({ amount: e.target.value });
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
                  clr("emi_months");
                  patch({ emi_months: e.target.value });
                }}
              />
              <TextInput
                label="Start Month"
                required
                type="month"
                value={form.start_month}
                error={errors.start_month}
                onChange={(e) => {
                  clr("start_month");
                  patch({ start_month: e.target.value });
                }}
              />
            </div>
            <ReadonlyField label="EMI Amount" value={emiPreview} tabular />
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
      </div>
    </Drawer>
  );
}

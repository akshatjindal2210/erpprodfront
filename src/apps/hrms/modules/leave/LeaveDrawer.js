"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import { leaveService } from "@/apps/hrms/lib/services/hrms";
import { employeeHelperRows, fetchEmployeeByDcode, fetchEmployeeViews } from "@/apps/hrms/lib/helpers/employeeHelper";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { IMS_DRAWER_BTN_APPROVE, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_CLOSE, IMS_DRAWER_BTN_PRIMARY, IMS_DRAWER_FOOTER_WRAP } from "@/apps/ims/lib/helpers/masterListUi";
import { todayYmd } from "@/apps/hrms/lib/gatePassUtils";
import {
  LEAVE_TYPE_OPTIONS,
  GP_FIELD,
  GP_LABEL,
  GP_ROW2,
  ReadonlyField,
  TextInput,
  calcLeaveDays,
  emptyLeaveForm,
  empPickerRow,
  empResolved,
  isPendingHr,
  isPendingManager,
  leavePayload,
  leaveTypeLabel,
  toLeaveForm,
  validateLeaveForm,
} from "@/apps/hrms/lib/leaveUtils";

const MODULE = "hrms_leave";
const TITLES = { add: "New Leave", edit: "Edit Leave", "verify-hr": "Leave", "verify-manager": "Leave", view: "View Leave" };

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

export default function LeaveDrawer({ open, mode = "add", record = null, onClose, onSuccess }) {
  const readOnly = mode === "view" || mode.startsWith("verify-");
  const canAccess = useCanAccess();
  const [form, setForm] = useState(() => toLeaveForm(record));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const patch = useCallback((p) => setForm((f) => ({ ...f, ...p })), []);
  const today = todayYmd();

  useEffect(() => {
    if (open) {
      setForm(toLeaveForm(record));
      setErrors({});
    }
  }, [open, record, mode]);

  const empAction = mode === "add" ? "add" : "edit";
  const fetchEmployees = useCallback(async (params) => {
    const res = await fetchEmployeeViews({ pageModule: MODULE, pageAction: empAction, ...params });
    const data = employeeHelperRows(res.data).map(empPickerRow);
    return { data, total: res.total ?? data.length };
  }, [empAction]);
  const getEmployeeByDcode = useCallback(
    async (id) => empPickerRow(await fetchEmployeeByDcode({ pageModule: MODULE, pageAction: empAction, emp_dcode: id })),
    [empAction]
  );

  const onEmpChange = (item) => {
    setErrors({});
    if (!item) return setForm(emptyLeaveForm());
    const dcode = item.emp_dcode ?? item.id;
    setForm((f) => ({
      ...f,
      emp_dcode: dcode != null && Number(dcode) > 0 ? Number(dcode) : "",
      emp_code: item.emp_code || "",
      emp_name: item.emp_name || "",
      deptname: item.deptname || "",
    }));
  };

  const empOpt = useMemo(() => empResolved(form), [form]);
  const daysPreview = useMemo(() => calcLeaveDays(form.from_date, form.to_date), [form.from_date, form.to_date]);
  const canAdd = canAccess(MODULE, "add").allowed;
  const canEdit = canAccess(MODULE, "edit").allowed;
  const canAuthorize = canAccess(MODULE, "authorize").allowed;
  const canView = canAccess(MODULE, "view").allowed;
  const showHr = mode === "verify-hr" && canAuthorize && isPendingHr(record);
  const showSup = mode === "verify-manager" && canEdit && isPendingManager(record);
  const canSaveForm = (mode === "add" && canAdd) || (mode === "edit" && canEdit);

  useEffect(() => {
    if (!open) return;
    const ok =
      (mode === "add" && canAdd) ||
      (mode === "edit" && canEdit) ||
      (mode === "view" && canView) ||
      (mode === "verify-manager" && canEdit) ||
      (mode === "verify-hr" && canAuthorize);
    if (!ok) {
      toast.error("You do not have permission for this action.");
      onClose?.();
    }
  }, [open, mode, canAdd, canEdit, canView, canAuthorize, onClose]);

  const save = () => {
    if (!canSaveForm) return toast.error("You do not have permission for this action.");
    const next = validateLeaveForm(form);
    setErrors(next);
    if (Object.keys(next).length) return toast.error("Please fix the highlighted fields.");
    void runAction(
      () => leaveService[mode === "edit" ? "update" : "submit"]({ ...(mode === "edit" ? { id: record?.id } : {}), ...leavePayload(form) }),
      mode === "edit" ? "Updated." : "Saved.",
      onSuccess,
      onClose,
      setSaving
    );
  };

  const showFormFooter = !readOnly && canSaveForm;
  const closeOnly = mode === "view" || (readOnly && !showHr && !showSup);
  const r = record;

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={showFormFooter ? save : undefined}
      title={TITLES[mode] || TITLES.view}
      description="Employee leave"
      maxWidth="max-w-2xl"
      footer={
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
              onClick={() => runAction(() => leaveService.verifyManager({ id: r?.id }), "Supervisor approval done.", onSuccess, onClose, setSaving)}
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
              onClick={() => runAction(() => leaveService.verifyHr({ id: r?.id }), "HR approval done.", onSuccess, onClose, setSaving)}
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : null}
              HR Approve
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4 pb-4">
        {readOnly ? (
          <div className="space-y-4">
            <div className={GP_ROW2}>
              <ReadonlyField label="Emp Code" value={r?.emp_code || "—"} />
              <ReadonlyField label="Name" value={r?.emp_name || "—"} />
            </div>
            <div className={GP_ROW2}>
              <ReadonlyField label="Department" value={r?.deptname || "—"} />
              <ReadonlyField label="Status" value={r?.status_display || "—"} />
            </div>
            <div className={GP_ROW2}>
              <ReadonlyField label="Type" value={r?.leave_type_display || leaveTypeLabel(r?.leave_type)} />
              <ReadonlyField label="Days" value={r?.days != null ? String(r.days) : "—"} tabular />
            </div>
            <div className={GP_ROW2}>
              <ReadonlyField label="From" value={r?.from_date_display || r?.from_date || "—"} tabular />
              <ReadonlyField label="To" value={r?.to_date_display || r?.to_date || "—"} tabular />
            </div>
            <ReadonlyField label="Reason" value={r?.reason || "—"} />
          </div>
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
                  <select className={`${GP_FIELD} appearance-none pr-10`} value={form.leave_type} onChange={(e) => patch({ leave_type: e.target.value })}>
                    {LEAVE_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>
              </div>
              <ReadonlyField label="Days" value={daysPreview != null ? String(daysPreview) : "—"} tabular />
            </div>
            <div className={GP_ROW2}>
              <TextInput
                label="From Date"
                required
                type="date"
                min={today}
                value={form.from_date}
                error={errors.from_date}
                onChange={(e) => {
                  const from = e.target.value;
                  patch({ from_date: from, ...(form.to_date && form.to_date < from ? { to_date: from } : {}) });
                  setErrors((prev) => {
                    const n = { ...prev };
                    delete n.from_date;
                    delete n.to_date;
                    return n;
                  });
                }}
              />
              <TextInput
                label="To Date"
                required
                type="date"
                min={form.from_date > today ? form.from_date : today}
                value={form.to_date}
                error={errors.to_date}
                onChange={(e) => {
                  patch({ to_date: e.target.value });
                  setErrors((prev) => {
                    const n = { ...prev };
                    delete n.to_date;
                    return n;
                  });
                }}
              />
            </div>
            <FormTextarea
              label="Reason"
              labelClassName={GP_LABEL}
              required
              rows={3}
              value={form.reason}
              error={errors.reason}
              placeholder="Reason for leave"
              onChange={(e) => {
                patch({ reason: e.target.value });
                setErrors((prev) => {
                  const n = { ...prev };
                  delete n.reason;
                  return n;
                });
              }}
            />
          </>
        )}
      </div>
    </Drawer>
  );
}

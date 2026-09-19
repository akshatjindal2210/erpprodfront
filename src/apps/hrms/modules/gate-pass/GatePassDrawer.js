"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import { gatePassService } from "@/apps/hrms/lib/services/hrms";
import { employeeHelperRows, fetchEmployeeByDcode, fetchEmployeeViews } from "@/apps/hrms/lib/helpers/employeeHelper";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { IMS_DRAWER_BTN_APPROVE, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_CLOSE, IMS_DRAWER_BTN_PRIMARY, IMS_DRAWER_FOOTER_WRAP } from "@/apps/ims/lib/helpers/masterListUi";
import { PASS_TYPE_OPTIONS, gatePassTimeView, isPendingHr, isPendingManager, maxAllowedPassDateYmd, minAllowedPassDateYmd } from "@/apps/hrms/lib/gatePassUtils";
import { GP_FIELD, GP_LABEL, GP_ROW2, ReadonlyField, TextInput, durationLabel, empPickerRow, empResolved, gatePassPayload, toGatePassForm, validateGatePassForm } from "@/apps/hrms/lib/gatePassForm";

const MODULE = "hrms_gate_pass";
const DRAWER_DESC = "Employee gate pass";

const TITLES = {
  add: "New Gate Pass",
  edit: "Edit Gate Pass",
  "verify-hr": "Gate Pass",
  "verify-manager": "Gate Pass",
  view: "View Gate Pass",
};

/** Same layout for view, supervisor approve, HR approve — one screen for everyone */
export function GatePassReadonlyFields({ r }) {
  if (!r) return null;
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
        <ReadonlyField label="Pass Date" value={r.pass_date_display || r.pass_date || "—"} tabular />
        <ReadonlyField label="Type" value={r.pass_type_display || r.pass_type || "—"} />
      </div>
      <div className={GP_ROW2}>
        <ReadonlyField label="Out Time" value={gatePassTimeView(r, "out")} tabular />
        <ReadonlyField label="In Time" value={gatePassTimeView(r, "in")} tabular />
      </div>
      <ReadonlyField label="Duration" value={r.duration || "—"} tabular />
      <ReadonlyField label="Reason" value={r.reason || "—"} />
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

export default function GatePassDrawer({ open, mode = "add", record = null, onClose, onSuccess }) {
  const readOnly = mode === "view" || mode.startsWith("verify-");
  const canAccess = useCanAccess();
  const [form, setForm] = useState(() => toGatePassForm(record));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const patch = useCallback((p) => setForm((f) => ({ ...f, ...p })), []);
  const clr = useCallback((...keys) => {
    setErrors((prev) => {
      const next = { ...prev };
      keys.forEach((k) => delete next[k]);
      if (keys.some((k) => k === "out_time" || k === "in_time")) {
        delete next.out_time;
        delete next.in_time;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (open) {
      setForm(toGatePassForm(record));
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
  const onEmpChange = useCallback(
    (item) => {
      clr("emp_dcode");
      if (!item) return patch({ emp_dcode: "", emp_code: "", emp_name: "", deptname: "" });
      const dcode = item.emp_dcode ?? item.id;
      patch({
        emp_dcode: dcode != null && Number(dcode) > 0 ? Number(dcode) : "",
        emp_code: item.emp_code || "",
        emp_name: item.emp_name || "",
        deptname: item.deptname || "",
      });
    },
    [clr, patch]
  );

  const empOpt = useMemo(() => empResolved(form), [form]);
  const dur = useMemo(() => durationLabel(form), [form]);
  const canAdd = canAccess(MODULE, "add").allowed;
  const canEdit = canAccess(MODULE, "edit").allowed;
  const canAuthorize = canAccess(MODULE, "authorize").allowed;
  const canView = canAccess(MODULE, "view").allowed;

  const showHr = mode === "verify-hr" && canAuthorize && isPendingHr(record);
  const showSup = mode === "verify-manager" && canEdit && isPendingManager(record);
  const canSaveForm = (mode === "add" && canAdd) || (mode === "edit" && canEdit);

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
    const next = validateGatePassForm(form);
    setErrors(next);
    if (Object.keys(next).length) return toast.error("Please fix the highlighted fields.");
    void runAction(
      () =>
        gatePassService[mode === "edit" ? "update" : "submit"]({
          ...(mode === "edit" ? { id: record?.id } : {}),
          ...gatePassPayload(form),
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
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className={closeOnly ? IMS_DRAWER_BTN_CLOSE : IMS_DRAWER_BTN_CANCEL}
      >
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
            runAction(
              () => gatePassService.verifyManager({ id: r?.id }),
              "Supervisor approval done.",
              onSuccess,
              onClose,
              setSaving
            )
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
          onClick={() =>
            runAction(() => gatePassService.verifyHr({ id: r?.id }), "HR approval done.", onSuccess, onClose, setSaving)
          }
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
          <GatePassReadonlyFields r={r} />
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
              <TextInput
                label="Pass Date"
                required
                type="date"
                min={minAllowedPassDateYmd()}
                max={maxAllowedPassDateYmd()}
                value={form.pass_date}
                error={errors.pass_date}
                onChange={(e) => {
                  clr("pass_date");
                  patch({ pass_date: e.target.value });
                }}
              />
              <div className="space-y-1">
                <label className={GP_LABEL}>
                  Type <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    className={`${GP_FIELD} appearance-none pr-10`}
                    value={form.pass_type}
                    onChange={(e) => patch({ pass_type: e.target.value })}
                  >
                    {PASS_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>
              </div>
            </div>
            <div className={GP_ROW2}>
              <TextInput
                label="Out Time"
                required
                type="time"
                className="tabular-nums"
                value={form.out_time}
                error={errors.out_time}
                onChange={(e) => {
                  clr("out_time", "in_time");
                  patch({ out_time: e.target.value });
                }}
              />
              <TextInput
                label="In Time"
                required
                type="time"
                className="tabular-nums"
                value={form.in_time}
                error={errors.in_time && errors.in_time !== errors.out_time ? errors.in_time : ""}
                onChange={(e) => {
                  clr("out_time", "in_time");
                  patch({ in_time: e.target.value });
                }}
              />
            </div>
            <ReadonlyField label="Duration" value={dur} tabular />
            <FormTextarea
              label="Reason"
              labelClassName={GP_LABEL}
              required
              rows={3}
              value={form.reason}
              error={errors.reason}
              placeholder="Reason for gate pass"
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

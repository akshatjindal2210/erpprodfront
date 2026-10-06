"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

import Drawer from "@/ui/primitives/Drawer";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { loanDeductionService } from "@/apps/hrms/lib/services/hrms";
import { employeeHelperRows, fetchEmployeeByDcode, fetchEmployeeViews } from "@/apps/hrms/lib/helpers/employeeHelper";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import {
  IMS_DRAWER_BTN_APPROVE,
  IMS_DRAWER_BTN_CANCEL,
  IMS_DRAWER_BTN_CLOSE,
  IMS_DRAWER_BTN_PRIMARY,
  IMS_DRAWER_FOOTER_WRAP,
} from "@/apps/ims/lib/helpers/masterListUi";
import {
  DEDUCTION_CREATE_TYPES,
  GP_FIELD,
  GP_LABEL,
  GP_ROW2,
  ReadonlyField,
  TextInput,
  currentMonthYm,
  empPickerRow,
  empResolved,
  formatRupee,
  parseRupeeInput,
} from "@/apps/hrms/lib/loanUtils";

const MODULE = "hrms_deduction";
const TITLES = {
  add: "New Deduction",
  edit: "Edit Deduction",
  "verify-approve": "Deduction",
  view: "View Deduction",
};
const DRAWER_DESC = "Employee deduction";

function emptyForm() {
  return {
    emp_dcode: "",
    emp_code: "",
    emp_name: "",
    deptname: "",
    type: "extra",
    month: currentMonthYm(),
    amount: "",
    remarks: "",
  };
}

function toForm(record) {
  if (!record) return emptyForm();
  return {
    emp_dcode: record.emp_dcode != null ? Number(record.emp_dcode) : "",
    emp_code: record.emp_code || "",
    emp_name: record.emp_name || "",
    deptname: record.deptname || "",
    type: record.type && record.type !== "loan" && record.type !== "advance" ? record.type : "extra",
    month: String(record.month || currentMonthYm()).slice(0, 7),
    amount: record.amount != null ? String(record.amount) : "",
    remarks: record.remarks || "",
  };
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

export default function LoanDeductionDrawer({ open, mode = "add", record = null, onClose, onSuccess }) {
  const readOnly = mode === "view" || mode === "verify-approve";
  const canAccess = useCanAccess();
  const [form, setForm] = useState(() => toForm(record));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [remark, setRemark] = useState("");
  const sopAckRef = useRef(null);
  const sopPermissionType =
    mode === "verify-approve" ? "authorize" : mode === "edit" ? "edit" : mode === "add" ? "add" : "view";
  const patch = useCallback((p) => setForm((f) => ({ ...f, ...p })), []);
  const r = record;
  const isManual = r && r.type !== "loan" && r.type !== "advance";
  const showApprove = mode === "verify-approve" && isManual && r?.status === "pending";
  const showComplete = mode === "verify-approve" && r?.status === "approved";
  const showFormFooter = mode === "add" || mode === "edit";
  const closeOnly = mode === "view";

  useEffect(() => {
    if (open) {
      setForm(toForm(record));
      setErrors({});
      setRemark(record?.remarks || "");
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

  const onEmpChange = (item) => {
    setErrors((prev) => {
      const n = { ...prev };
      delete n.emp_dcode;
      return n;
    });
    if (!item) return setForm(emptyForm());
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

  const validate = () => {
    const next = {};
    if (!Number.isFinite(Number(form.emp_dcode)) || Number(form.emp_dcode) <= 0) next.emp_dcode = "Employee is required";
    if (!form.type || form.type === "loan" || form.type === "advance") next.type = "Type is required";
    if (!/^\d{4}-\d{2}$/.test(String(form.month || ""))) next.month = "Month is required";
    if (!(Number(form.amount) > 0)) next.amount = "Amount is required";
    if (!String(form.remarks || "").trim()) next.remarks = "Remark is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = () => {
    if (!sopAckRef.current?.assertAcknowledged()) return;
    if (!validate()) return;
    const body = {
      emp_dcode: Number(form.emp_dcode),
      type: form.type,
      month: form.month,
      amount: Number(form.amount),
      remarks: String(form.remarks).trim(),
    };
    if (mode === "edit") {
      if (!canAccess(MODULE, "edit").allowed) return toast.error("No edit permission.");
      return runAction(
        () => loanDeductionService.extraUpdate({ id: r.id, ...body }),
        "Deduction updated.",
        onSuccess,
        onClose,
        setSaving
      );
    }
    if (!canAccess(MODULE, "add").allowed) return toast.error("No add permission.");
    return runAction(() => loanDeductionService.extra(body), "Deduction added.", onSuccess, onClose, setSaving);
  };

  const decide = (fn, okMsg) => {
    if (!sopAckRef.current?.assertAcknowledged()) return;
    const remarks = String(remark || r?.remarks || "").trim();
    if (!remarks) return toast.warning("Remark is required.");
    return runAction(() => fn({ id: r.id, remarks }), okMsg, onSuccess, onClose, setSaving);
  };

  const onDrawerSubmit = showFormFooter
    ? save
    : showApprove
      ? () => decide(loanDeductionService.approve, "Approved.")
      : showComplete
        ? () =>
            runAction(
              () => loanDeductionService.mark({ ids: [r.id] }),
              "Marked deducted.",
              onSuccess,
              onClose,
              setSaving
            )
        : undefined;

  if (!open) return null;
  if (readOnly && !r) return null;

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={onDrawerSubmit}
      title={TITLES[mode] || TITLES.view}
      description={DRAWER_DESC}
      maxWidth="max-w-2xl"
      footer={
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
          {showApprove ? (
            <button
              type="button"
              title="Ctrl+S"
              disabled={saving}
              className={IMS_DRAWER_BTN_APPROVE}
              onClick={() => decide(loanDeductionService.approve, "Approved.")}
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : null}
              Approve
            </button>
          ) : null}
          {showComplete ? (
            <button
              type="button"
              title="Ctrl+S"
              disabled={saving}
              className={IMS_DRAWER_BTN_APPROVE}
              onClick={() =>
                runAction(() => loanDeductionService.mark({ ids: [r.id] }), "Marked deducted.", onSuccess, onClose, setSaving)
              }
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : null}
              Complete
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
              <ReadonlyField label="Type" value={r?.type_display || r?.type || "—"} />
              <ReadonlyField label="Month" value={r?.month || "—"} tabular />
            </div>
            <ReadonlyField label="Amount" value={formatRupee(r?.amount)} tabular />
            <ReadonlyField label="Remark" value={r?.remarks || "—"} />
            {showApprove || showComplete ? (
              <FormTextarea
                label="Remark"
                required
                rows={3}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Enter remark"
                disabled={saving}
              />
            ) : null}
            <div className={GP_ROW2}>
              <ReadonlyField label="Created By" value={r?.created_by || "—"} />
              <ReadonlyField label="Created At" value={r?.created_at_display || "—"} tabular />
            </div>
            <div className={GP_ROW2}>
              <ReadonlyField label="Approved By" value={r?.approved_by || "—"} />
              <ReadonlyField label="Approved At" value={r?.approved_at_display || "—"} tabular />
            </div>
            {r?.approved_remarks ? <ReadonlyField label="Approved Remark" value={r.approved_remarks} /> : null}
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
              disabled={mode === "edit"}
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
                    disabled={saving || mode === "edit"}
                    onChange={(e) => {
                      patch({ type: e.target.value });
                      setErrors((prev) => {
                        const n = { ...prev };
                        delete n.type;
                        return n;
                      });
                    }}
                  >
                    {DEDUCTION_CREATE_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>
                {errors.type ? <p className="text-[9px] text-rose-500 font-bold ml-1">{errors.type}</p> : null}
              </div>
              <TextInput
                label="Month"
                required
                type="month"
                value={form.month || ""}
                error={errors.month || ""}
                disabled={saving}
                onChange={(e) => {
                  patch({ month: e.target.value });
                  setErrors((prev) => {
                    const n = { ...prev };
                    delete n.month;
                    return n;
                  });
                }}
              />
            </div>
            <TextInput
              label="Amount"
              required
              inputMode="decimal"
              className="tabular-nums"
              value={form.amount === "" || form.amount == null ? "" : String(form.amount)}
              error={errors.amount || ""}
              disabled={saving}
              onChange={(e) => {
                let s = String(e.target.value ?? "").replace(/[^\d.]/g, "");
                const dot = s.indexOf(".");
                if (dot >= 0) s = `${s.slice(0, dot + 1)}${s.slice(dot + 1).replace(/\./g, "").slice(0, 2)}`;
                patch({ amount: s === "" || s === "." ? "" : s });
                setErrors((prev) => {
                  const n = { ...prev };
                  delete n.amount;
                  return n;
                });
              }}
              onBlur={() => patch({ amount: parseRupeeInput(form.amount) })}
            />
            <FormTextarea
              label="Remark"
              labelClassName={GP_LABEL}
              required
              rows={3}
              value={form.remarks || ""}
              error={errors.remarks || ""}
              placeholder="e.g. Machine damage / nuksan"
              disabled={saving}
              onChange={(e) => {
                patch({ remarks: e.target.value });
                setErrors((prev) => {
                  const n = { ...prev };
                  delete n.remarks;
                  return n;
                });
              }}
            />
          </>
        )}
        {mode !== "view" ? (
          <ModuleSopAcknowledgment
            ref={sopAckRef}
            key={`${open}-${sopPermissionType}`}
            isOpen={open}
            moduleSlug={MODULE}
            permissionType={sopPermissionType}
          />
        ) : null}
      </div>
    </Drawer>
  );
}

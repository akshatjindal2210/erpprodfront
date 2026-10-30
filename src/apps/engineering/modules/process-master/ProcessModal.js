"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Check, AlertCircle, Loader2, Shield } from "lucide-react";
import { toast } from "react-toastify";

import { processMasterService } from "@/apps/engineering/lib/services/processMaster";
import { helperPerms } from "@/apps/engineering/lib/helpers/helperPerms";
import { ENG_MODULES } from "@/apps/engineering/lib/config/modules";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import Drawer from "@/ui/primitives/Drawer";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { ERR_INPUT, OK_INPUT, FormLabel } from "@/ui/common/Constants";
import { focusFirstError } from "@/platform/utils/form/formFocus";
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_PRIMARY, IMS_DRAWER_BTN_KEEP_PENDING, IMS_DRAWER_BTN_APPROVE } from "@/apps/ims/lib/helpers/masterListUi";

const FIELD_ORDER = ["procname", "parent_id", "stage", "deptname"];
const FIELD_INPUT_CLASS =
  "min-h-9 h-9 sm:h-[38px] text-sm sm:text-[11px] rounded-lg border-slate-200 text-slate-900 placeholder:text-slate-500 placeholder:opacity-100";

const IMS_APPROVAL_TOGGLE =
  "w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-400";

const FLAG_FIELDS = [
  { key: "rm_wire", label: "RM wire" },
  { key: "tooling", label: "Tooling" },
  { key: "fg", label: "FG" },
  { key: "prime", label: "Prime" },
  { key: "rework", label: "Rework" },
  { key: "inhouse", label: "Machine" },
  { key: "multi_jc", label: "Multiple Machine" },
  { key: "jobwork", label: "Jobwork" },
  { key: "connectivity", label: "Connectivity" },
];

const INITIAL_FORM = {
  procname: "",
  parent_id: null,
  stage: "MID",
  multi_jc: false,
  rm_wire: false,
  tooling: false,
  fg: false,
  prime: false,
  rework: false,
  inhouse: false,
  jobwork: false,
  connectivity: false,
  deptname: "",
  approved: false,
};

function levelLabel(depth) {
  const d = Number(depth);
  if (!Number.isFinite(d) || d <= 0) return "Master";
  return `Sub level ${d}`;
}

function ImsRoundToggle({ checked, onChange, disabled = false, ariaLabel }) {
  return (
    <label className={`relative inline-flex items-center shrink-0 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className={IMS_APPROVAL_TOGGLE} />
    </label>
  );
}

export default function ProcessModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const canAccess = useCanAccess();
  const MODULE = ENG_MODULES.PROCESS_MASTER;
  const canApprove = canAccess(MODULE, "authorize").allowed;

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const isClone = mode === "add" && editData?.proccode != null;
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";
  // New and Clone both create a record → same Approval Status toggle
  const showApproval = canApprove && mode === "add";

  const [loading, setLoading] = useState(false);
  const [activeSubmit, setActiveSubmit] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [levelHint, setLevelHint] = useState("Master");
  const sopAckRef = useRef(null);
  const formRef = useRef(null);

  const editId = editData?.proccode ?? null;
  const helperBody = useMemo(() => helperPerms(MODULE, sopPermissionType), [MODULE, sopPermissionType]);

  useEffect(() => {
    let timeoutId;
    if (open) {
      if (editData && (isEdit || isApprove || isClone)) {
        setForm({
          procname: isClone ? `${editData.procname || ""}`.trim() : editData.procname || "",
          parent_id: editData.parent_id || null,
          stage: editData.stage || "MID",
          multi_jc: !!editData.multi_jc,
          rm_wire: !!editData.rm_wire,
          tooling: !!editData.tooling,
          fg: !!editData.fg,
          prime: !!editData.prime,
          rework: !!editData.rework,
          inhouse: !!editData.inhouse,
          jobwork: !!editData.jobwork,
          connectivity: !!editData.connectivity,
          deptname: editData.deptname || editData.pattern || "",
          approved: isApprove ? (editData.approved ?? false) : false,
        });
        setLevelHint(levelLabel(editData.depth));
      } else {
        setForm(INITIAL_FORM);
        setLevelHint("Master");
      }
      setErrors({});
    } else {
      timeoutId = setTimeout(() => {
        setForm(INITIAL_FORM);
        setErrors({});
        setLevelHint("Master");
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [open, editId, isApprove, isEdit, isClone, editData]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      if (!form.parent_id) {
        if (!cancelled) setLevelHint("Master");
        return;
      }
      try {
        const res = await processMasterService.getViewById(form.parent_id, helperBody);
        const row = res?.data;
        if (cancelled || !row) return;
        const parentDepth = Number(row.depth);
        const d = Number.isFinite(parentDepth) ? parentDepth + 1 : 1;
        setLevelHint(levelLabel(d));
      } catch {
        if (!cancelled) setLevelHint("Sub");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, form.parent_id, helperBody]);

  const handleChange = (k, value) => {
    setForm((prev) => ({ ...prev, [k]: value }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.procname?.trim()) e.procname = "Name is required";
    return e;
  };

  const handleSave = async (statusOverride = null, actionKey = "save") => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      toast.error("Please fix the highlighted fields before saving.");
      focusFirstError(e, FIELD_ORDER, (key) => formRef.current?.querySelector(`[data-field="${key}"]`));
      return;
    }
    if (!sopAckRef.current?.assertAcknowledged()) return;
    setActiveSubmit(actionKey);
    setLoading(true);

    try {
      let finalApproved = form.approved;
      if (statusOverride !== null) finalApproved = statusOverride;
      else if (isEdit && editData?.approved) finalApproved = false;

      const payload = {
        procname: form.procname.trim(),
        parent_id: form.parent_id || null,
        stage: form.stage || "MID",
        multi_jc: !!form.multi_jc,
        rm_wire: !!form.rm_wire,
        tooling: !!form.tooling,
        fg: !!form.fg,
        prime: !!form.prime,
        rework: !!form.rework,
        inhouse: !!form.inhouse,
        jobwork: !!form.jobwork,
        connectivity: !!form.connectivity,
        deptname: form.deptname?.trim() || null,
        approved: finalApproved,
      };

      const isUpdate = isEdit || isApprove;
      const response = isUpdate
        ? await processMasterService.update(editData.proccode, payload)
        : await processMasterService.create(payload);

      toast.success(response?.message || "Successfully saved");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Operation failed");
    } finally {
      setLoading(false);
      setActiveSubmit(null);
    }
  };

  const drawerFooter = (
    <div className={IMS_DRAWER_FOOTER_WRAP}>
      <button type="button" onClick={onClose} disabled={loading} className={IMS_DRAWER_BTN_CANCEL}>
        Cancel
      </button>
      {isApprove ? (
        <>
          <button type="button" onClick={() => handleSave(false, "keep_pending")} disabled={loading} className={IMS_DRAWER_BTN_KEEP_PENDING}>
            {loading && activeSubmit === "keep_pending" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Saving...
              </span>
            ) : (
              "Keep Pending"
            )}
          </button>
          <button type="button" onClick={() => handleSave(true, "approve")} disabled={loading} className={IMS_DRAWER_BTN_APPROVE}>
            {loading && activeSubmit === "approve" ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />} Approve
          </button>
        </>
      ) : (
        <>
          {isEdit && canApprove && (
            <button type="button" onClick={() => handleSave(true, "approve")} disabled={loading} className={IMS_DRAWER_BTN_APPROVE}>
              {loading && activeSubmit === "approve" ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />} Save & Approve
            </button>
          )}
          <button type="button" onClick={() => handleSave(null, "save")} disabled={loading} className={IMS_DRAWER_BTN_PRIMARY}>
            {loading && activeSubmit === "save" ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Check size={18} /> Save
              </>
            )}
          </button>
        </>
      )}
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={() => handleSave(isApprove ? true : null, isApprove ? "approve" : "save")}
      title={isApprove ? "Approve Process" : isEdit ? "Edit Process" : isClone ? "Clone Process" : "New Process"}
      description="Process master"
      footer={drawerFooter}
      maxWidth="max-w-2xl"
    >
      <div ref={formRef} className="space-y-4 pb-4">
        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized process will reset its status to{" "}
              <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require re-approval.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1 md:col-span-2" data-field="procname">
            <FormLabel required>Name</FormLabel>
            <input
              value={form.procname}
              onChange={(e) => handleChange("procname", e.target.value)}
              className={`${errors.procname ? ERR_INPUT : OK_INPUT} ${FIELD_INPUT_CLASS} w-full`}
              placeholder="e.g. Turning, Assembly"
            />
            {errors.procname && (
              <p className="text-[9px] text-rose-500 mt-1 flex items-center gap-1 font-bold">
                <AlertCircle size={10} />
                {errors.procname}
              </p>
            )}
          </div>

          <div className="space-y-1 md:col-span-2" data-field="parent_id">
            <SearchableSelect
              label="Parent process (optional)"
              placeholder="Leave empty for master · pick parent for sub-process"
              value={form.parent_id}
              onChange={(id) => handleChange("parent_id", id || null)}
              preserveApiOrder
              fetchService={(params) =>
                processMasterService.getViews({
                  ...params,
                  ...helperBody,
                  exclude_id: isEdit || isApprove ? editData?.proccode : undefined,
                  filters: { approved: true },
                })
              }
              getByIdService={async (id) => {
                const res = await processMasterService.getViewById(id, helperBody);
                const row = res?.data;
                return row
                  ? {
                      proccode: row.proccode,
                      procname: row.procname,
                      label: row.procname,
                      path_label: row.path_label || row.procname,
                    }
                  : null;
              }}
              dataKey="proccode"
              labelKey="procname"
              subLabelKey="path_label"
              labelOnlyDisplay
              usePortal={false}
            />
            <p className="text-[9px] text-slate-500">
              Level after save: <span className="font-bold text-slate-700">{levelHint}</span>
            </p>
          </div>

          <div className="space-y-1">
            <FormLabel>Stage</FormLabel>
            <select
              data-field="stage"
              value={form.stage}
              onChange={(e) => handleChange("stage", e.target.value)}
              className={`${OK_INPUT} ${FIELD_INPUT_CLASS} w-full`}
            >
              <option value="START">START</option>
              <option value="MID">MID</option>
              <option value="END">END</option>
            </select>
          </div>

          <div className="space-y-1" data-field="deptname">
            <SearchableSelect
              label="Department (optional)"
              placeholder="Pick employee department from HRMS"
              value={form.deptname || null}
              onChange={(id) => handleChange("deptname", id || "")}
              preserveApiOrder
              fetchService={(params) => processMasterService.getDepartments(params)}
              getByIdService={(id) => processMasterService.getDepartmentByName(id)}
              dataKey="id"
              labelKey="deptname"
              labelOnlyDisplay
              usePortal={false}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Options</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            {FLAG_FIELDS.map(({ key, label }) => (
              <li key={key} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0 sm:border-0">
                <span className="text-[11px] font-medium text-slate-800">{label}</span>
                <ImsRoundToggle checked={!!form[key]} ariaLabel={label} onChange={(v) => handleChange(key, v)} />
              </li>
            ))}
          </ul>
        </div>

        <div className="h-px bg-slate-100" />

        {showApproval ? (
          <div
            className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
              form.approved ? "bg-emerald-600 border-emerald-700 shadow-sm" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${form.approved ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"}`}>
                <Shield size={16} />
              </div>
              <div>
                <p className={`text-xs font-bold ${form.approved ? "text-white" : "text-slate-700"}`}>Approval Status</p>
                <p
                  className={`text-[9px] uppercase font-bold tracking-tight ${
                    form.approved ? "text-emerald-100" : "text-slate-400"
                  }`}
                >
                  {form.approved ? "Final & Locked" : "Draft Mode"}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.approved}
                onChange={(e) => handleChange("approved", e.target.checked)}
                className="sr-only peer"
              />
              <div className={IMS_APPROVAL_TOGGLE} />
            </label>
          </div>
        ) : isApprove ? (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400 shrink-0" />
            <p className="text-[10px] text-slate-500 italic">Use Keep Pending to save as draft, or Approve to authorize.</p>
          </div>
        ) : isEdit && canApprove ? (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400 shrink-0" />
            <p className="text-[10px] text-slate-500 italic">Use Save to keep as draft, or Save &amp; Approve to authorize.</p>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400" />
            <p className="text-[10px] text-slate-500 italic">This entry will require authorization before becoming active.</p>
          </div>
        )}

        <ModuleSopAcknowledgment
          ref={sopAckRef}
          key={`${open}-${sopPermissionType}`}
          moduleSlug={MODULE}
          permissionType={sopPermissionType}
          isOpen={open}
        />
      </div>
    </Drawer>
  );
}

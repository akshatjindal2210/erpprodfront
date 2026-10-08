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

const FIELD_ORDER = ["name", "type", "parent_id", "stage", "pattern"];
const FIELD_INPUT_CLASS =
  "min-h-9 h-9 sm:h-[38px] text-sm sm:text-[11px] rounded-lg border-slate-200 text-slate-900 placeholder:text-slate-500 placeholder:opacity-100";

const INITIAL_FORM = {
  name: "",
  type: "MASTER",
  parent_id: null,
  stage: "START",
  multi_mc: false,
  pattern: "",
  approved: false,
};

function isValidRegex(text) {
  if (!text?.trim()) return true;
  try {
    // eslint-disable-next-line no-new
    new RegExp(text.trim());
    return true;
  } catch {
    return false;
  }
}

export default function ProcessModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const canAccess = useCanAccess();
  const MODULE = ENG_MODULES.PROCESS_MASTER;
  const canApprove = canAccess(MODULE, "authorize").allowed;

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";
  // IMS style: Approval Status toggle only on create; edit/approve use footer buttons.
  const showApproval = canApprove && mode === "add";

  const [loading, setLoading] = useState(false);
  const [activeSubmit, setActiveSubmit] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const sopAckRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    let timeoutId;
    if (open) {
      if (editData) {
        setForm({
          name: editData.name || "",
          type: editData.type || "MASTER",
          parent_id: editData.parent_id || null,
          stage: editData.stage || "MID",
          multi_mc: !!editData.multi_mc,
          pattern: editData.pattern || "",
          approved: isApprove ? (editData.approved ?? false) : false,
        });
      } else {
        setForm(INITIAL_FORM);
      }
      setErrors({});
    } else {
      timeoutId = setTimeout(() => {
        setForm(INITIAL_FORM);
        setErrors({});
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [open, editData?.id, isApprove]);

  const parentTypeFilter = useMemo(() => {
    if (form.type === "SUB") return "MASTER";
    if (form.type === "SUB_SUB") return "SUB";
    return null;
  }, [form.type]);

  const handleChange = (k, value) => {
    setForm((prev) => {
      const next = { ...prev, [k]: value };
      if (k === "type") {
        if (value === "MASTER") next.parent_id = null;
        else if (prev.type !== value) next.parent_id = null;
      }
      return next;
    });
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = "Name is required";
    if (!["MASTER", "SUB", "SUB_SUB"].includes(form.type)) e.type = "Type required";
    if (form.type !== "MASTER" && !form.parent_id) e.parent_id = "Parent is required";
    if (!isValidRegex(form.pattern)) e.pattern = "Invalid regular expression";
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
        name: form.name.trim(),
        type: form.type,
        parent_id: form.type === "MASTER" ? null : form.parent_id,
        stage: form.stage || "MID",
        multi_mc: !!form.multi_mc,
        pattern: form.pattern?.trim() || null,
        approved: finalApproved,
      };

      const isUpdate = isEdit || isApprove;
      const response = isUpdate
        ? await processMasterService.update(editData.id, payload)
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
    <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 sm:gap-3 w-full">
      <button onClick={onClose} disabled={loading} className="w-full sm:w-auto px-4 sm:px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl bg-white">
        Cancel
      </button>
      {isApprove ? (
        <>
          <button onClick={() => handleSave(false, "keep_pending")} disabled={loading} className="w-full sm:w-auto px-4 sm:px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl">
            {loading && activeSubmit === "keep_pending" ? <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Saving...</span> : "Keep Pending"}
          </button>
          <button onClick={() => handleSave(true, "approve")} disabled={loading} className="w-full sm:w-auto sm:min-w-[140px] px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center justify-center gap-2">
            {loading && activeSubmit === "approve" ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />} Approve
          </button>
        </>
      ) : (
        <>
          {isEdit && canApprove && (
            <button onClick={() => handleSave(true, "approve")} disabled={loading} className="w-full sm:w-auto sm:min-w-[160px] px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center justify-center gap-2">
              {loading && activeSubmit === "approve" ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />} Save & Approve
            </button>
          )}
          <button onClick={() => handleSave(null, "save")} disabled={loading} title="Ctrl+S" className="w-full sm:w-auto sm:min-w-[160px] px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center justify-center gap-2">
            {loading && activeSubmit === "save" ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : <><Check size={18} /> Save</>}
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
      title={isApprove ? "Approve Process" : isEdit ? "Edit Process" : "New Process"}
      description="Engineering process hierarchy"
      footer={drawerFooter}
      maxWidth="max-w-3xl"
    >
      <div ref={formRef} className="space-y-4 pb-4">
        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium">
              Editing this authorized process will reset status to <span className="font-bold uppercase">Pending</span>.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1 md:col-span-2">
            <FormLabel required>Name</FormLabel>
            <input
              data-field="name"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className={`${errors.name ? ERR_INPUT : OK_INPUT} ${FIELD_INPUT_CLASS}`}
              placeholder="Process name"
            />
            {errors.name && <p className="text-[9px] text-rose-500 font-bold flex items-center gap-1"><AlertCircle size={10} />{errors.name}</p>}
          </div>

          <div className="space-y-1">
            <FormLabel required>Type</FormLabel>
            <select
              data-field="type"
              value={form.type}
              onChange={(e) => handleChange("type", e.target.value)}
              className={`${errors.type ? ERR_INPUT : OK_INPUT} ${FIELD_INPUT_CLASS}`}
            >
              <option value="MASTER">MASTER</option>
              <option value="SUB">SUB</option>
              <option value="SUB_SUB">SUB_SUB</option>
            </select>
          </div>

          <div className="space-y-1">
            <FormLabel required>Stage</FormLabel>
            <select
              data-field="stage"
              value={form.stage}
              onChange={(e) => handleChange("stage", e.target.value)}
              className={`${OK_INPUT} ${FIELD_INPUT_CLASS}`}
            >
              <option value="START">START</option>
              <option value="MID">MID</option>
              <option value="END">END</option>
            </select>
          </div>

          {form.type !== "MASTER" && (
            <div className="space-y-1 md:col-span-2" data-field="parent_id">
              <SearchableSelect
                label={`Parent (${parentTypeFilter})`}
                required
                placeholder={`Select ${parentTypeFilter} process...`}
                value={form.parent_id}
                onChange={(id) => handleChange("parent_id", id || null)}
                fetchService={(params) =>
                  processMasterService.getViews({
                    ...params,
                    ...helperPerms(MODULE, sopPermissionType),
                    filters: { type: parentTypeFilter, approved: true },
                  })
                }
                getByIdService={async (id) => {
                  const res = await processMasterService.getViewById(id, helperPerms(MODULE, sopPermissionType));
                  const row = res?.data;
                  return row ? { id: row.id, label: row.label || row.name, name: row.name } : null;
                }}
                dataKey="id"
                labelKey="label"
                labelOnlyDisplay
              />
              {errors.parent_id && <p className="text-[9px] text-rose-500 font-bold flex items-center gap-1"><AlertCircle size={10} />{errors.parent_id}</p>}
            </div>
          )}

          <div className="space-y-1 md:col-span-2">
            <FormLabel>Pattern (optional regex)</FormLabel>
            <input
              data-field="pattern"
              value={form.pattern}
              onChange={(e) => handleChange("pattern", e.target.value)}
              className={`${errors.pattern ? ERR_INPUT : OK_INPUT} ${FIELD_INPUT_CLASS} font-mono`}
              placeholder="e.g. ^JC-\\d{4}$"
            />
            {errors.pattern && <p className="text-[9px] text-rose-500 font-bold flex items-center gap-1"><AlertCircle size={10} />{errors.pattern}</p>}
          </div>

          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700 md:col-span-2">
            <input
              type="checkbox"
              checked={!!form.multi_mc}
              onChange={(e) => handleChange("multi_mc", e.target.checked)}
            />
            Allow multi-machine job card
          </label>
        </div>

        <div className="h-px bg-slate-100" />

        {showApproval ? (
          <div className={`p-3 rounded-xl border transition-all flex items-center justify-between ${form.approved ? "bg-emerald-600 border-emerald-700 shadow-sm" : "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${form.approved ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"}`}>
                <Shield size={16} />
              </div>
              <div>
                <p className={`text-xs font-bold ${form.approved ? "text-white" : "text-slate-700"}`}>Approval Status</p>
                <p className={`text-[9px] uppercase font-bold tracking-tight ${form.approved ? "text-emerald-100" : "text-slate-400"}`}>
                  {form.approved ? "Final & Locked" : "Draft Mode"}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={!!form.approved} onChange={(e) => handleChange("approved", e.target.checked)} className="sr-only peer" />
              <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-400" />
            </label>
          </div>
        ) : isApprove ? (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400 shrink-0" />
            <p className="text-[10px] text-slate-500 italic">
              Use Keep Pending to save as draft, or Approve to authorize.
            </p>
          </div>
        ) : isEdit && canApprove ? (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400 shrink-0" />
            <p className="text-[10px] text-slate-500 italic">
              Use Save to keep as draft, or Save &amp; Approve to authorize.
            </p>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400 shrink-0" />
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

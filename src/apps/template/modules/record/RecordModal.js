"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Check, AlertCircle, Loader2, Shield } from "lucide-react";
import { toast } from "react-toastify";

import { recordService } from "@/apps/template/lib/services/record";
import Drawer from "@/ui/primitives/Drawer";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { ERR_INPUT, OK_INPUT, FormLabel } from "@/ui/common/Constants";
import { focusFirstError } from "@/platform/utils/form/formFocus";

const MODULE = "template_record";
const FIELD_ORDER = ["name"];
const INITIAL_FORM = { name: "", notes: "", approved: false };

export default function RecordModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const canAccess = useCanAccess();
  const canApprove = canAccess(MODULE, "authorize").allowed;
  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";
  const showApproval = canApprove && (mode === "add" || mode === "approve");

  const [loading, setLoading] = useState(false);
  const [activeSubmit, setActiveSubmit] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const sopAckRef = useRef(null);
  const formRef = useRef(null);
  const editId = editData?.record_id ?? null;

  useEffect(() => {
    if (!open) return;
    setForm(editData
      ? { name: editData.name ?? "", notes: editData.notes ?? "", approved: isApprove ? (editData.approved ?? false) : false }
      : INITIAL_FORM);
    setErrors({});
  }, [open, editId, isApprove]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleSave = async (statusOverride = null, actionKey = "save") => {
    const nextErrors = {};
    if (!String(form.name || "").trim()) nextErrors.name = "Name is required";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      toast.error("Please fix the highlighted fields before saving.");
      focusFirstError(nextErrors, FIELD_ORDER, (key) => formRef.current?.querySelector(`[data-field="${key}"]`));
      return;
    }
    if (!sopAckRef.current?.assertAcknowledged()) return;
    if ((isEdit || isApprove) && !editId) {
      toast.error("Record ID missing — close and open the row again.");
      return;
    }

    setActiveSubmit(actionKey);
    setLoading(true);
    try {
      let approved = form.approved;
      if (statusOverride != null) approved = statusOverride;
      else if (isEdit && editData?.approved) approved = false;

      const payload = { name: form.name.trim(), notes: form.notes?.trim() || null, approved };
      const response = isEdit || isApprove
        ? await recordService.update(editId, payload)
        : await recordService.create(payload);

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

  const footer = (
    <div className="flex items-center justify-end gap-3 w-full">
      <button type="button" onClick={onClose} disabled={loading} className="px-5 py-2.5 text-sm font-bold text-slate-500">
        Cancel
      </button>
      {isApprove ? (
        <>
          <button type="button" onClick={() => handleSave(false, "keep_pending")} disabled={loading} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl">
            {loading && activeSubmit === "keep_pending" ? <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Saving...</span> : "Keep Pending"}
          </button>
          <button type="button" onClick={() => handleSave(true, "approve")} disabled={loading} className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center justify-center gap-2">
            {loading && activeSubmit === "approve" ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />} Approve
          </button>
        </>
      ) : (
        <>
          {isEdit && canApprove && (
            <button type="button" onClick={() => handleSave(true, "approve")} disabled={loading} className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center justify-center gap-2">
              {loading && activeSubmit === "approve" ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />} Save & Approve
            </button>
          )}
          <button type="button" onClick={() => handleSave(showApproval && !isEdit ? form.approved : null, "save")} disabled={loading} className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center justify-center gap-2">
            {loading && activeSubmit === "save" ? <><Loader2 size={18} className="animate-spin" /> Saving</> : <><Check size={18} /> Save</>}
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
      title={isApprove ? "Approve Record" : isEdit ? "Edit Record" : "New Record"}
      description="Sample CRUD master — copy this drawer when adding a real module"
      footer={footer}
      maxWidth="max-w-lg"
    >
      <div ref={formRef} className="space-y-4 pb-4">
        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium">
              Editing an authorized record resets it to <span className="font-bold uppercase">Pending</span>.
            </p>
          </div>
        )}

        <div className="space-y-1" data-field="name">
          <FormLabel required>Name</FormLabel>
          <input
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            maxLength={120}
            className={`${errors.name ? ERR_INPUT : OK_INPUT} text-[11px] h-[38px] rounded-lg`}
            placeholder="Record name"
          />
          {errors.name && <p className="text-[9px] text-rose-500 font-bold ml-1">{errors.name}</p>}
        </div>

        <div className="space-y-1">
          <FormLabel>Notes</FormLabel>
          <textarea
            value={form.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            rows={3}
            className={`${OK_INPUT} text-[11px] rounded-lg py-2`}
            placeholder="Optional notes"
          />
        </div>

        {showApproval && !isEdit && (
          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
            <input
              type="checkbox"
              checked={!!form.approved}
              onChange={(e) => handleChange("approved", e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
            />
            Approve on save
          </label>
        )}

        <ModuleSopAcknowledgment ref={sopAckRef} module={MODULE} permissionType={sopPermissionType} />
      </div>
    </Drawer>
  );
}

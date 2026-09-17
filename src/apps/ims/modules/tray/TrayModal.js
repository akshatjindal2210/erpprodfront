"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, MessageSquareQuote, Shield } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { trayService } from "@/apps/ims/lib/services/tray";
import { ERR_INPUT, OK_INPUT, FormLabel } from "@/ui/common/Constants";

const FIELD_INPUT_CLASS =
  "min-h-9 h-9 sm:h-[38px] text-sm sm:text-[11px] rounded-lg border-slate-200 text-slate-900 placeholder:text-slate-500 placeholder:opacity-100";

const INITIAL_FORM = {
  type: "",
  quantity: "",
  remark: "",
  approved: false,
};

function isBatchAuthorized(batch) {
  return Number(batch?.pending_count || 0) === 0 && Number(batch?.active_count || batch?.tray_count || 0) > 0;
}

export default function TrayModal({ open, onClose, onSuccess, editData, mode = "add", typeOptions = [], stackLevel = 0 }) {
  const canAccess = useCanAccess();
  const canApprove = canAccess("tray_master", "authorize").allowed;

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";
  const showApproval = canApprove && (mode === "add" || mode === "approve");
  const batchAuthorized = isBatchAuthorized(editData);

  const [loading, setLoading] = useState(false);
  const [activeSubmit, setActiveSubmit] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const sopAckRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM);
      setErrors({});
      return;
    }

    if (editData) {
      setForm({
        type: editData.type || "",
        quantity: String(editData.tray_count ?? editData.active_count ?? ""),
        remark: String(editData.remark || ""),
        approved: isApprove ? !!batchAuthorized : false,
      });
      return;
    }

    setForm({
      ...INITIAL_FORM,
      type: typeOptions?.[0]?.code || "",
    });
  }, [open, editData?.batch_id, isApprove, batchAuthorized, typeOptions]);

  const handleInputChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!String(form.type || "").trim()) e.type = "Type is required";
    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty <= 0 || Math.trunc(qty) !== qty) {
      e.quantity = "Quantity must be a positive whole number";
    }
    return e;
  };

  const handleSave = async (statusOverride = null, actionKey = "save") => {
    if (!sopAckRef.current?.assertAcknowledged()) return;

    if (isApprove && statusOverride === false) {
      onClose?.();
      return;
    }

    if (isApprove) {
      setActiveSubmit(actionKey);
      setLoading(true);
      try {
        const res = await trayService.approveBatch(editData.batch_id, true, String(form.remark || "").trim());
        toast.success(res?.message || "Batch authorized successfully");
        onSuccess?.(res?.data);
        onClose?.();
      } catch (err) {
        toast.error(err?.message || "Operation failed");
      } finally {
        setLoading(false);
        setActiveSubmit(null);
      }
      return;
    }

    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      toast.error("Please fix highlighted fields.");
      return;
    }

    setActiveSubmit(actionKey);
    setLoading(true);

    try {
      if (isEdit) {
        const payload = {
          type: String(form.type || "").trim().toUpperCase(),
          quantity: Number(form.quantity),
          remark: String(form.remark || "").trim(),
        };
        if (statusOverride === true) {
          payload.approved = true;
        } else if (batchAuthorized) {
          payload.approved = false;
        }
        const res = await trayService.updateBatch(editData.batch_id, payload);
        toast.success(res?.message || "Batch updated successfully");
        onSuccess?.(res?.data);
      } else {
        const res = await trayService.create({
          type: String(form.type || "").trim().toUpperCase(),
          quantity: Number(form.quantity),
          remark: String(form.remark || "").trim(),
          approved: Boolean(form.approved && canApprove),
        });
        const data = res?.data;
        toast.success(
          form.approved && canApprove
            ? res?.message || "Tray batch created and authorized"
            : res?.message || "Tray batch created"
        );
        onSuccess?.(data);
      }

      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Operation failed");
    } finally {
      setLoading(false);
      setActiveSubmit(null);
    }
  };

  const drawerFooter = (
    <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 sm:gap-3 w-full">
      <button
        type="button"
        onClick={onClose}
        disabled={loading}
        className="w-full sm:w-auto px-4 sm:px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl bg-white"
      >
        Cancel
      </button>

      {isApprove ? (
        <>
          <button
            type="button"
            onClick={() => void handleSave(false, "keep_pending")}
            disabled={loading}
            className="w-full sm:w-auto px-4 sm:px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            {loading && activeSubmit === "keep_pending" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Saving...
              </span>
            ) : (
              "Keep Pending"
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleSave(true, "approve")}
            disabled={loading}
            className="w-full sm:w-auto sm:min-w-[140px] px-5 sm:px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
          >
            {loading && activeSubmit === "approve" ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
            Approve
          </button>
        </>
      ) : (
        <>
          {isEdit && canApprove ? (
            <button
              type="button"
              onClick={() => void handleSave(true, "approve")}
              disabled={loading}
              className="w-full sm:w-auto sm:min-w-[160px] px-5 sm:px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
            >
              {loading && activeSubmit === "approve" ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
              Save & Approve
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSave(null, "save")}
            disabled={loading}
            title="Ctrl+S"
            className="w-full sm:w-auto sm:min-w-[160px] px-5 sm:px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
          >
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

  const title = isApprove ? "Approve Tray Batch" : isEdit ? "Edit Tray Batch" : "New Tray Batch";

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={() => void handleSave(isApprove ? true : null, isApprove ? "approve" : "save")}
      title={title}
      description="Manage tray batches"
      footer={drawerFooter}
      maxWidth="max-w-lg"
      stackLevel={stackLevel}
    >
      <div className="space-y-4 pb-2">
        {isEdit && batchAuthorized ? (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized batch will reset its status to{" "}
              <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require re-approval.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <FormLabel required>Tray Type</FormLabel>
            <select
              value={form.type}
              onChange={(e) => handleInputChange("type", e.target.value)}
              disabled={isApprove}
              className={`${errors.type ? ERR_INPUT : OK_INPUT} ${FIELD_INPUT_CLASS} ${isApprove ? "bg-slate-50 text-slate-600" : ""}`}
            >
              {(typeOptions || []).length ? (
                (typeOptions || []).map((row) => (
                  <option key={row.code} value={row.code}>
                    {row.code} - {row.label}
                  </option>
                ))
              ) : (
                <option value="">No tray types available</option>
              )}
            </select>
            {errors.type ? (
              <p className="text-[9px] text-rose-500 mt-1 flex items-center gap-1 font-bold">
                <AlertCircle size={10} />
                {errors.type}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <FormLabel required>Quantity</FormLabel>
            <input
              type="number"
              min={1}
              value={form.quantity}
              onChange={(e) => handleInputChange("quantity", e.target.value)}
              disabled={isApprove}
              className={`${errors.quantity ? ERR_INPUT : OK_INPUT} ${FIELD_INPUT_CLASS} ${isApprove ? "bg-slate-50 text-slate-600" : ""}`}
              placeholder="e.g. 100"
            />
            {errors.quantity ? (
              <p className="text-[9px] text-rose-500 mt-1 flex items-center gap-1 font-bold">
                <AlertCircle size={10} />
                {errors.quantity}
              </p>
            ) : null}
          </div>
        </div>

        <div data-field="remark">
          <FormTextarea
            label="Remarks"
            labelIcon={<MessageSquareQuote size={12} className="text-indigo-500" />}
            className="[&_textarea]:!text-[11px] [&_textarea]:!min-h-[4.5rem] [&_textarea]:!py-2"
            value={form.remark}
            onChange={(e) => handleInputChange("remark", e.target.value)}
            placeholder="Optional — short note if needed..."
            disabled={loading}
            rows={4}
          />
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
                <p className={`text-[9px] uppercase font-bold tracking-tight ${form.approved ? "text-emerald-100" : "text-slate-400"}`}>
                  {form.approved ? "Final & Locked" : "Draft Mode"}
                </p>
              </div>
            </div>
            {!isApprove ? (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.approved}
                  onChange={(e) => handleInputChange("approved", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-400" />
              </label>
            ) : null}
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400" />
            <p className="text-[10px] text-slate-500 italic">
              {isEdit
                ? "This entry will require authorization before becoming active."
                : "This entry will require authorization before QR print or download."}
            </p>
          </div>
        )}

        <ModuleSopAcknowledgment
          ref={sopAckRef}
          key={`${open}-${sopPermissionType}-${editData?.batch_id || "new"}`}
          moduleSlug="tray_master"
          permissionType={sopPermissionType}
          isOpen={open}
        />
      </div>
    </Drawer>
  );
}

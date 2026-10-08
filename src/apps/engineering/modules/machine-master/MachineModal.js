"use client";

import { useState, useEffect, useRef } from "react";
import { Check, AlertCircle, Loader2, Shield, X, Paperclip, ExternalLink } from "lucide-react";
import { toast } from "react-toastify";

import { machineMasterService } from "@/apps/engineering/lib/services/machineMaster";
import { processMasterService } from "@/apps/engineering/lib/services/processMaster";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import Drawer from "@/ui/primitives/Drawer";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import { ERR_INPUT, OK_INPUT, FormLabel } from "@/ui/common/Constants";
import { focusFirstError } from "@/platform/utils/form/formFocus";
import { FILE_BASE_URL } from "@/platform/utils/core/lib";
import { helperPerms } from "@/apps/engineering/lib/helpers/helperPerms";
import { ENG_MODULES } from "@/apps/engineering/lib/config/modules";

/** Resolve stored upload path (e.g. uploads/eng/machine/…) to a browser URL. */
function attachmentHref(storedPath) {
  if (!storedPath) return "";
  const p = String(storedPath).trim().replace(/\\/g, "/");
  if (!p) return "";
  if (/^https?:\/\//i.test(p) || p.startsWith("blob:")) return p;
  const base = String(FILE_BASE_URL || "").replace(/\/$/, "");
  const rel = p.replace(/^\/+/, "");
  if (rel.startsWith("uploads/")) return `${base}/${rel}`;
  return `${base}/uploads/${rel}`;
}

const FIELD_ORDER = ["name", "number", "process_id", "speed", "duration_value"];
const FIELD_INPUT_CLASS = "min-h-9 h-9 sm:h-[38px] text-sm sm:text-[11px] rounded-lg border-slate-200 text-slate-900 placeholder:text-slate-500 placeholder:opacity-100";

const INITIAL_FORM = {
  name: "",
  number: "",
  process_id: null,
  speed: "",
  duration_value: 60,
  duration_unit: "sec",
  make: "",
  model: "",
  remark: "",
  approved: false,
};

function secondsToDisplay(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s < 0) return { duration_value: 60, duration_unit: "sec" };
  if (s >= 3600 && s % 3600 === 0) return { duration_value: s / 3600, duration_unit: "hour" };
  if (s >= 60 && s % 60 === 0) return { duration_value: s / 60, duration_unit: "min" };
  return { duration_value: s, duration_unit: "sec" };
}

export default function MachineModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const canAccess = useCanAccess();
  const MODULE = ENG_MODULES.MACHINE_MASTER;
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
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [removeAttachmentIds, setRemoveAttachmentIds] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [newFileUrls, setNewFileUrls] = useState([]);
  const sopAckRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    const urls = newFiles.map((f) => URL.createObjectURL(f));
    setNewFileUrls(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [newFiles]);

  useEffect(() => {
    let timeoutId;
    let cancelled = false;

    async function load() {
      if (!open) {
        timeoutId = setTimeout(() => {
          setForm(INITIAL_FORM);
          setErrors({});
          setExistingAttachments([]);
          setRemoveAttachmentIds([]);
          setNewFiles([]);
        }, 300);
        return;
      }

      if (editData?.id && (isEdit || isApprove)) {
        try {
          const res = await machineMasterService.getById(editData.id);
          const row = res?.data || editData;
          if (cancelled) return;
          const dur = secondsToDisplay(row.duration);
          setForm({
            name: row.name || "",
            number: row.number || "",
            process_id: row.process_id || null,
            speed: row.speed ?? "",
            duration_value: dur.duration_value,
            duration_unit: dur.duration_unit,
            make: row.make || "",
            model: row.model || "",
            remark: row.remark || "",
            approved: isApprove ? (row.approved ?? false) : false,
          });
          setExistingAttachments(Array.isArray(row.attachments) ? row.attachments : []);
        } catch {
          if (cancelled) return;
          const dur = secondsToDisplay(editData.duration);
          setForm({
            ...INITIAL_FORM,
            name: editData.name || "",
            number: editData.number || "",
            process_id: editData.process_id || null,
            speed: editData.speed ?? "",
            duration_value: dur.duration_value,
            duration_unit: dur.duration_unit,
            make: editData.make || "",
            model: editData.model || "",
            remark: editData.remark || "",
            approved: isApprove ? (editData.approved ?? false) : false,
          });
          setExistingAttachments(Array.isArray(editData.attachments) ? editData.attachments : []);
        }
      } else if (editData && mode === "add") {
        // clone
        const dur = secondsToDisplay(editData.duration);
        setForm({
          ...INITIAL_FORM,
          name: editData.name || "",
          number: "",
          process_id: editData.process_id || null,
          speed: editData.speed ?? "",
          duration_value: dur.duration_value,
          duration_unit: dur.duration_unit,
          make: editData.make || "",
          model: editData.model || "",
          remark: editData.remark || "",
        });
        setExistingAttachments([]);
      } else {
        setForm(INITIAL_FORM);
        setExistingAttachments([]);
      }
      setRemoveAttachmentIds([]);
      setNewFiles([]);
      setErrors({});
    }

    load();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [open, editData?.id, isApprove, mode]);

  const handleChange = (k, value) => {
    setForm((prev) => ({ ...prev, [k]: value }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.name?.trim()) e.name = "Name is required";
    if (!form.number?.trim()) e.number = "Number is required";
    if (!form.process_id) e.process_id = "Process is required";
    if (form.duration_value === "" || Number(form.duration_value) < 0) e.duration_value = "Enter valid duration";
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

      const fd = new FormData();
      fd.append("name", form.name.trim());
      fd.append("number", form.number.trim());
      fd.append("process_id", String(form.process_id));
      if (form.speed !== "" && form.speed != null) fd.append("speed", String(form.speed));
      fd.append("duration_value", String(form.duration_value));
      fd.append("duration_unit", form.duration_unit);
      if (form.make) fd.append("make", form.make);
      if (form.model) fd.append("model", form.model);
      if (form.remark) fd.append("remark", form.remark);
      fd.append("approved", String(!!finalApproved));
      if (removeAttachmentIds.length) {
        fd.append("remove_attachment_ids", JSON.stringify(removeAttachmentIds));
      }
      newFiles.forEach((file) => fd.append("attachments", file));

      const isUpdate = isEdit || isApprove;
      const response = isUpdate
        ? await machineMasterService.update(editData.id, fd)
        : await machineMasterService.create(fd);

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

  const visibleExisting = existingAttachments.filter((a) => !removeAttachmentIds.includes(a.id));

  const drawerFooter = (
    <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 sm:gap-3 w-full">
      <button onClick={onClose} disabled={loading} className="w-full sm:w-auto px-4 sm:px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl bg-white">Cancel</button>
      {isApprove ? (
        <>
          <button onClick={() => handleSave(false, "keep_pending")} disabled={loading} className="w-full sm:w-auto px-4 sm:px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl">
            {loading && activeSubmit === "keep_pending" ? <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Saving...</span> : "Keep Pending"}
          </button>
          <button onClick={() => handleSave(true, "approve")} disabled={loading} className="w-full sm:w-auto sm:min-w-[140px] px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl flex items-center justify-center gap-2">
            {loading && activeSubmit === "approve" ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />} Approve
          </button>
        </>
      ) : (
        <>
          {isEdit && canApprove && (
            <button onClick={() => handleSave(true, "approve")} disabled={loading} className="w-full sm:w-auto sm:min-w-[160px] px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl flex items-center justify-center gap-2">
              {loading && activeSubmit === "approve" ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />} Save & Approve
            </button>
          )}
          <button onClick={() => handleSave(null, "save")} disabled={loading} title="Ctrl+S" className="w-full sm:w-auto sm:min-w-[160px] px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 rounded-xl flex items-center justify-center gap-2">
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
      title={isApprove ? "Approve Machine" : isEdit ? "Edit Machine" : "New Machine"}
      description="Engineering machine master"
      footer={drawerFooter}
      maxWidth="max-w-3xl"
    >
      <div ref={formRef} className="space-y-4 pb-4">
        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium">
              Editing this authorized machine will reset status to <span className="font-bold uppercase">Pending</span>.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <FormLabel required>Name</FormLabel>
            <input data-field="name" value={form.name} onChange={(e) => handleChange("name", e.target.value)} className={`${errors.name ? ERR_INPUT : OK_INPUT} ${FIELD_INPUT_CLASS}`} />
            {errors.name && <p className="text-[9px] text-rose-500 font-bold flex items-center gap-1"><AlertCircle size={10} />{errors.name}</p>}
          </div>
          <div className="space-y-1">
            <FormLabel required>Number</FormLabel>
            <input data-field="number" value={form.number} onChange={(e) => handleChange("number", e.target.value)} className={`${errors.number ? ERR_INPUT : OK_INPUT} ${FIELD_INPUT_CLASS}`} />
            {errors.number && <p className="text-[9px] text-rose-500 font-bold flex items-center gap-1"><AlertCircle size={10} />{errors.number}</p>}
          </div>

          <div className="space-y-1 md:col-span-2" data-field="process_id">
            <SearchableSelect
              label="Process (approved only)"
              required
              placeholder="Select process..."
              value={form.process_id}
              onChange={(id) => handleChange("process_id", id || null)}
              fetchService={(params) =>
                processMasterService.getViews({
                  ...params,
                  ...helperPerms(MODULE, sopPermissionType),
                  filters: { approved: true },
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
            {errors.process_id && <p className="text-[9px] text-rose-500 font-bold flex items-center gap-1"><AlertCircle size={10} />{errors.process_id}</p>}
          </div>

          <div className="space-y-1">
            <FormLabel>Speed</FormLabel>
            <input
              data-field="speed"
              type="text"
              inputMode="decimal"
              value={form.speed}
              onChange={(e) => handleChange("speed", e.target.value)}
              placeholder="e.g. 10"
              className={`${OK_INPUT} ${FIELD_INPUT_CLASS}`}
            />
          </div>

          <div className="space-y-1">
            <FormLabel required>Duration</FormLabel>
            <div
              className={`flex items-stretch overflow-hidden rounded-lg border bg-white ${
                errors.duration_value ? "border-rose-300" : "border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-50/80"
              }`}
            >
              <input
                data-field="duration_value"
                type="number"
                min={0}
                value={form.duration_value}
                onChange={(e) => handleChange("duration_value", e.target.value)}
                placeholder="60"
                className="min-h-9 h-9 sm:h-[38px] flex-1 min-w-0 border-0 px-3 text-sm sm:text-[11px] text-slate-900 outline-none bg-transparent"
              />
              <select
                value={form.duration_unit}
                onChange={(e) => handleChange("duration_unit", e.target.value)}
                className="w-[84px] shrink-0 border-0 border-l border-slate-200 bg-slate-50 px-2 text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="sec">Sec</option>
                <option value="min">Min</option>
                <option value="hour">Hour</option>
              </select>
            </div>
            {errors.duration_value && <p className="text-[9px] text-rose-500 font-bold flex items-center gap-1"><AlertCircle size={10} />{errors.duration_value}</p>}
          </div>

          <div className="space-y-1">
            <FormLabel>Make</FormLabel>
            <input value={form.make} onChange={(e) => handleChange("make", e.target.value)} className={`${OK_INPUT} ${FIELD_INPUT_CLASS}`} />
          </div>
          <div className="space-y-1">
            <FormLabel>Model</FormLabel>
            <input value={form.model} onChange={(e) => handleChange("model", e.target.value)} className={`${OK_INPUT} ${FIELD_INPUT_CLASS}`} />
          </div>

          <div className="md:col-span-2">
            <FormTextarea label="Remark" value={form.remark} onChange={(e) => handleChange("remark", e.target.value)} rows={2} />
          </div>
        </div>

        <div className="space-y-2">
          <FormLabel>Attachments</FormLabel>
          <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 text-[11px] font-bold text-slate-600">
            <Paperclip size={14} /> Add files
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length) setNewFiles((prev) => [...prev, ...files]);
                e.target.value = "";
              }}
            />
          </label>
          {visibleExisting.map((att) => {
            const href = attachmentHref(att.path);
            return (
              <div key={att.id} className="flex items-center justify-between gap-2 text-[11px] bg-slate-50 border border-slate-200 px-2 py-1.5 rounded">
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-indigo-600 font-bold truncate min-w-0 hover:underline" title="Open attachment">
                    <ExternalLink size={12} className="shrink-0" />
                    <span className="truncate">{att.file_name}</span>
                  </a>
                ) : (
                  <span className="font-bold text-slate-500 truncate">{att.file_name || "—"}</span>
                )}
                <button type="button" onClick={() => setRemoveAttachmentIds((prev) => [...prev, att.id])} className="text-rose-500 shrink-0" title="Remove">
                  <X size={14} />
                </button>
              </div>
            );
          })}
          {newFiles.map((file, idx) => (
            <div key={`${file.name}-${idx}`} className="flex items-center justify-between gap-2 text-[11px] bg-indigo-50 border border-indigo-100 px-2 py-1.5 rounded">
              {newFileUrls[idx] ? (
                <a href={newFileUrls[idx]} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-indigo-700 font-bold truncate min-w-0 hover:underline" title="Preview file">
                  <ExternalLink size={12} className="shrink-0" />
                  <span className="truncate">{file.name}</span>
                </a>
              ) : (
                <span className="font-bold text-indigo-700 truncate">{file.name}</span>
              )}
              <button type="button" onClick={() => setNewFiles((prev) => prev.filter((_, i) => i !== idx))} className="text-rose-500 shrink-0" title="Remove">
                <X size={14} />
              </button>
            </div>
          ))}
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

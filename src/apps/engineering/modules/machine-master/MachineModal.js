"use client";

import { useState, useEffect, useRef } from "react";
import { Check, AlertCircle, Loader2, Shield, X, FileText, Upload, MessageSquareQuote } from "lucide-react";
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
import FilePreviewLink from "@/ui/common/system/FilePreviewLink";
import { helperPerms } from "@/apps/engineering/lib/helpers/helperPerms";
import { ENG_MODULES } from "@/apps/engineering/lib/config/modules";
import { uploadAccept, uploadUrl } from "@/lib/documents";
import { IMS_DRAWER_FOOTER_WRAP, IMS_DRAWER_BTN_CANCEL, IMS_DRAWER_BTN_PRIMARY, IMS_DRAWER_BTN_APPROVE, IMS_DRAWER_BTN_KEEP_PENDING } from "@/apps/ims/lib/helpers/masterListUi";

const ATTACH_ACCEPT = uploadAccept("eng_machine_master");

const FIELD_ORDER = ["name", "number", "process_id", "speed", "duration_value", "setup_time_value"];
const FIELD_INPUT_CLASS = "min-h-9 h-9 sm:h-[38px] text-sm sm:text-[11px] rounded-lg border-slate-200 text-slate-900 placeholder:text-slate-500 placeholder:opacity-100";

const INITIAL_FORM = {
  name: "",
  number: "",
  process_id: null,
  speed: "",
  duration_value: 60,
  duration_unit: "sec",
  setup_time_value: 0,
  setup_time_unit: "sec",
  make: "",
  model: "",
  remark: "",
  approved: false,
};

/** Time fields: stored in seconds (DB), edited as value + unit (sec / min / hour). field → default seconds */
const TIME_FIELDS = { duration: 60, setup_time: 0 };

/** Seconds → `{ <field>_value, <field>_unit }` in the biggest whole unit. */
function secondsToDisplay(seconds, field) {
  let s = Number(seconds);
  if (seconds == null || !Number.isFinite(s) || s < 0) s = TIME_FIELDS[field];
  const [value, unit] = s >= 3600 && s % 3600 === 0 ? [s / 3600, "hour"] : s >= 60 && s % 60 === 0 ? [s / 60, "min"] : [s, "sec"];
  return { [`${field}_value`]: value, [`${field}_unit`]: unit };
}

/** All time fields of a machine row → form values. */
const timeFormValues = (row) => Object.assign({}, ...Object.keys(TIME_FIELDS).map((f) => secondsToDisplay(row?.[f], f)));

/** Number + unit (Sec / Min / Hour) input. */
function TimeInput({ field, form, errors, onChange, placeholder }) {
  const valueKey = `${field}_value`;
  const unitKey = `${field}_unit`;
  return (
    <>
      <div
        className={`flex items-stretch overflow-hidden rounded-lg border bg-white ${
          errors[valueKey] ? "border-rose-300" : "border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-50/80"
        }`}
      >
        <input
          data-field={valueKey}
          type="number"
          min={0}
          value={form[valueKey]}
          onChange={(e) => onChange(valueKey, e.target.value)}
          placeholder={placeholder}
          className="min-h-9 h-9 sm:h-[38px] flex-1 min-w-0 border-0 px-3 text-sm sm:text-[11px] text-slate-900 outline-none bg-transparent"
        />
        <select
          value={form[unitKey]}
          onChange={(e) => onChange(unitKey, e.target.value)}
          className="w-[84px] shrink-0 border-0 border-l border-slate-200 bg-slate-50 px-2 text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
        >
          <option value="sec">Sec</option>
          <option value="min">Min</option>
          <option value="hour">Hour</option>
        </select>
      </div>
      {errors[valueKey] && <p className="text-[9px] text-rose-500 font-bold flex items-center gap-1"><AlertCircle size={10} />{errors[valueKey]}</p>}
    </>
  );
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
  const [newFileRemarks, setNewFileRemarks] = useState([]);
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
          setNewFileRemarks([]);
        }, 300);
        return;
      }

      if (editData?.id && (isEdit || isApprove)) {
        try {
          const res = await machineMasterService.getById(editData.id);
          const row = res?.data || editData;
          if (cancelled) return;
          setForm({
            name: row.name || "",
            number: row.number || "",
            process_id: row.process_id || null,
            speed: row.speed ?? "",
            ...timeFormValues(row),
            make: row.make || "",
            model: row.model || "",
            remark: row.remark || "",
            approved: isApprove ? (row.approved ?? false) : false,
          });
          setExistingAttachments(Array.isArray(row.attachments) ? row.attachments : []);
        } catch {
          if (cancelled) return;
          setForm({
            ...INITIAL_FORM,
            name: editData.name || "",
            number: editData.number || "",
            process_id: editData.process_id || null,
            speed: editData.speed ?? "",
            ...timeFormValues(editData),
            make: editData.make || "",
            model: editData.model || "",
            remark: editData.remark || "",
            approved: isApprove ? (editData.approved ?? false) : false,
          });
          setExistingAttachments(Array.isArray(editData.attachments) ? editData.attachments : []);
        }
      } else if (editData && mode === "add") {
        // clone
        setForm({
          ...INITIAL_FORM,
          name: editData.name || "",
          number: "",
          process_id: editData.process_id || null,
          speed: editData.speed ?? "",
          ...timeFormValues(editData),
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
      setNewFileRemarks([]);
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
    if (form.setup_time_value !== "" && Number(form.setup_time_value) < 0) e.setup_time_value = "Enter valid setup time";
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
      fd.append("setup_time_value", String(form.setup_time_value === "" ? 0 : form.setup_time_value));
      fd.append("setup_time_unit", form.setup_time_unit);
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
    <div className={`${IMS_DRAWER_FOOTER_WRAP} flex-wrap sm:flex-nowrap gap-2 sm:gap-3`}>
      <button type="button" onClick={onClose} disabled={loading} className={IMS_DRAWER_BTN_CANCEL}>
        Cancel
      </button>
      {isApprove ? (
        <>
          <button type="button" onClick={() => handleSave(false, "keep_pending")} disabled={loading} className={IMS_DRAWER_BTN_KEEP_PENDING} >
            {loading && activeSubmit === "keep_pending" ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Saving...
              </span>
            ) : ( "Keep Pending" )}
          </button>
          <button type="button" onClick={() => handleSave(true, "approve")} disabled={loading} className={IMS_DRAWER_BTN_APPROVE} >
            {loading && activeSubmit === "approve" ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
            Approve
          </button>
        </>
      ) : (
        <>
          {isEdit && canApprove ? (
            <button type="button" onClick={() => handleSave(true, "approve")} disabled={loading} className={IMS_DRAWER_BTN_APPROVE} >
              {loading && activeSubmit === "approve" ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />}
              Save & Approve
            </button>
          ) : null}
          <button type="button" onClick={() => handleSave(null, "save")} disabled={loading} title="Ctrl+S" className={IMS_DRAWER_BTN_PRIMARY} >
            {loading && activeSubmit === "save" ? (
              <><Loader2 size={18} className="animate-spin" /> Saving...</>
            ) : (<><Check size={18} /> Save</>)}
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

          <div className="space-y-1" data-field="process_id">
            <SearchableSelect
              label="Process"
              required
              placeholder="Select process..."
              value={form.process_id}
              onChange={(id) => handleChange("process_id", id || null)}
              preserveApiOrder
              fetchService={(params) =>
                processMasterService.getViews({
                  ...params,
                  ...helperPerms(MODULE, sopPermissionType),
                  filters: { approved: true, inhouse: true },
                })
              }
              getByIdService={async (id) => {
                const res = await processMasterService.getViewById(id, helperPerms(MODULE, sopPermissionType));
                const row = res?.data;
                return row ? { id: row.id, name: row.name, label: row.name, path_label: row.path_label || row.name } : null;
              }}
              dataKey="id"
              labelKey="name"
              subLabelKey="path_label"
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
            <TimeInput field="duration" form={form} errors={errors} onChange={handleChange} placeholder="60" />
          </div>

          <div className="space-y-1">
            <FormLabel>Setup Time</FormLabel>
            <TimeInput field="setup_time" form={form} errors={errors} onChange={handleChange} placeholder="0" />
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
            <FormTextarea
              label="Remarks"
              labelIcon={<MessageSquareQuote size={12} className="text-indigo-500" />}
              rows={3}
              value={form.remark}
              onChange={(e) => handleChange("remark", e.target.value)}
              placeholder="Optional notes"
            />
          </div>
        </div>

        <div className="space-y-2">
          <FormLabel>Attachments</FormLabel>

          {visibleExisting.length > 0 ? (
            <ul className="space-y-1">
              {visibleExisting.map((att) => {
                const href = uploadUrl(att.path);
                const name = att.file_name || "—";
                return (
                  <li key={att.id} className="flex flex-col gap-1 px-3 py-2 border border-slate-200 rounded-lg bg-white">
                    <div className="flex items-center gap-2 min-h-5">
                      <FileText size={14} className="shrink-0 text-indigo-600" />
                      {href ? (
                        <FilePreviewLink href={href} fileName={name} className="truncate text-[11px] font-semibold text-indigo-700 flex-1 text-left">
                          {name}
                        </FilePreviewLink>
                      ) : (
                        <span className="truncate text-[11px] flex-1">{name}</span>
                      )}
                      <button type="button" disabled={loading} onClick={() => setRemoveAttachmentIds((prev) => [...prev, att.id])}
                        className="text-slate-400 hover:text-rose-600 shrink-0" title="Remove">
                        <X size={14} />
                      </button>
                    </div>
                    {/* Per-file attachment remark: Invoice Receiving only */}
                  </li>
                );
              })}
            </ul>
          ) : null}

          {newFiles.length > 0 ? (
            <ul className="space-y-1">
              {newFiles.map((file, idx) => (
                <li key={`${file.name}-${idx}`} className="flex flex-col gap-1 px-3 py-2 border border-emerald-200 rounded-lg bg-emerald-50/40">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="shrink-0 text-emerald-600" />
                    {newFileUrls[idx] ? (
                      <FilePreviewLink href={newFileUrls[idx]} fileName={file.name} mimeType={file.type} className="truncate text-[11px] font-medium flex-1 text-left">
                        {file.name}
                      </FilePreviewLink>
                    ) : (
                      <span className="truncate text-[11px] font-medium flex-1">{file.name}</span>
                    )}
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setNewFiles((prev) => prev.filter((_, i) => i !== idx));
                        setNewFileRemarks((prev) => prev.filter((_, i) => i !== idx));
                      }}
                      className="text-slate-400 hover:text-rose-600"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {/* Per-file attachment remark: Invoice Receiving only */}
                </li>
              ))}
            </ul>
          ) : null}

          <label className="flex items-center gap-2 min-h-9 px-3 border border-dashed border-slate-300 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100">
            <Upload size={14} className="text-slate-500 shrink-0" />
            <span className="text-[11px] font-medium text-slate-600">Add file(s)…</span>
            <input
              type="file"
              multiple
              accept={ATTACH_ACCEPT}
              className="sr-only"
              disabled={loading}
              onChange={(e) => {
                const picked = Array.from(e.target.files || []);
                if (picked.length) {
                  setNewFiles((prev) => [...prev, ...picked]);
                  setNewFileRemarks((prev) => [...prev, ...picked.map(() => "")]);
                }
                e.target.value = "";
              }}
            />
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

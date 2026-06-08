"use client";

import { useState, useEffect, useRef } from "react";
import { Check, AlertCircle, Loader2, Shield, User, Calendar, MapPin } from "lucide-react";
import { toast } from "react-toastify";

// Services & Components
import { auditService } from "@/features/apps/ims/services/audit";
import { userService } from "@/features/shared/auth/services/userService";
import { locationService } from "@/features/apps/ims/services/location";
import SearchableSelect from "@/core/components/common/SearchableSelect";
import Drawer from "@/core/components/ui/Drawer";
import ModuleSopAcknowledgment from "@/core/components/common/ModuleSopAcknowledgment";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { ERR_INPUT, OK_INPUT, FormLabel } from "@/core/components/common/Constants";
import { focusFirstError } from "@/core/utils/formFocus";
import { getAuditExecutionStatusLabel, getAuthorizationLabel } from "./auditStatusHelpers";

const FIELD_ORDER = ["assigned_user_id", "start_date", "end_date", "location_ids"];

const INITIAL_FORM = {
  assigned_user_id: "",
  start_date: "",
  end_date: "",
  remarks: "",
  location_ids: [],
  approved: false,
};

export default function AuditModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const canAccess = useCanAccess();

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const sopPermissionType = isApprove || mode === "add" ? "authorize" : isEdit ? "edit" : "add";

  const authorizationLabel = getAuthorizationLabel(Boolean(editData?.approved));
  const auditExecutionLabel = getAuditExecutionStatusLabel(editData?.status || "pending");

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const sopAckRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    let timeoutId;
    if (open) {
      if (editData) {
        setForm({
          assigned_user_id: editData.assigned_user_id || "",
          start_date: editData.start_date ? editData.start_date.split('T')[0] : "",
          end_date: editData.end_date ? editData.end_date.split('T')[0] : "",
          remarks: editData.remarks || "",
          location_ids: editData.locations ? editData.locations.map(l => l.location_id) : [],
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
  }, [open, editData?.audit_id, isApprove]);

  const handleInputChange = (k, value) => {
    setForm(prev => ({ ...prev, [k]: value }));
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.assigned_user_id) e.assigned_user_id = "Person is required";
    if (!form.start_date) e.start_date = "Start date is required";
    if (!form.end_date) e.end_date = "End date is required";
    if (!form.location_ids || !form.location_ids.length) e.location_ids = "At least one location is required";
    
    if (form.start_date && form.end_date && new Date(form.start_date) > new Date(form.end_date)) {
      e.end_date = "End date cannot be before start date";
    }
    
    return e;
  };

  const handleSave = async (statusOverride = null) => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      toast.error("Please fix the highlighted fields before saving.");
      focusFirstError(e, FIELD_ORDER, (key) =>
        formRef.current?.querySelector(`[data-field="${key}"]`)
      );
      return;
    }
    if (!sopAckRef.current?.assertAcknowledged()) return;
    setLoading(true);

    try {
      const payload = {
        assigned_user_id: form.assigned_user_id,
        start_date: form.start_date,
        end_date: form.end_date,
        remarks: form.remarks,
        location_ids: form.location_ids,
      };

      if (isApprove) {
        payload.approved = statusOverride !== null ? statusOverride : form.approved;
      } else if (isEdit && editData?.approved) {
        payload.approved = false;
      }

      const isUpdate = isEdit || isApprove;
      const request = isUpdate 
        ? auditService.update(editData.audit_id, payload) 
        : auditService.create(payload);
      
      const response = await request;
      toast.success(response?.message || "Successfully saved");
      
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const drawerFooter = (
    <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 sm:gap-3 w-full">
      <button onClick={onClose} disabled={loading} className="w-full sm:w-auto px-4 sm:px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl bg-white">
        Cancel
      </button>

      {isApprove ? (
        <>
          <button
            onClick={() => handleSave(false)}
            disabled={loading}
            className="w-full sm:w-auto px-4 sm:px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            Keep Pending
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={loading}
            className="w-full sm:w-auto sm:min-w-[140px] px-5 sm:px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />} Approve
          </button>
        </>
      ) : (
        <button
          onClick={() => handleSave()}
          disabled={loading}
          className="w-full sm:w-auto sm:min-w-[160px] px-5 sm:px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Saving...</>
          ) : (
            <><Check size={18} /> Save</>
          )}
        </button>
      )}
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={() => handleSave(isApprove ? true : undefined)}
      title={isApprove ? "Approve Audit" : isEdit ? "Edit Audit" : "New Audit"}
      description="Schedule inventory location audit"
      footer={drawerFooter}
      maxWidth="max-w-4xl"
    >
      <div ref={formRef} className="space-y-4 pb-4">
        
        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized audit will reset authorization to <span className="font-bold text-amber-900 uppercase">Pending Authorization</span>. The assigned worker will need manager approval again before starting.
            </p>
          </div>
        )}

        {isApprove && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <Shield size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] text-amber-800 font-bold leading-normal">
                Authorization: <span className="uppercase">{authorizationLabel}</span>
                <span className="mx-2 text-amber-400">|</span>
                Audit Status: <span className="uppercase">{auditExecutionLabel}</span>
              </p>
              <p className="text-[10px] text-amber-700 mt-1 leading-normal">
                Approving only authorizes the assigned worker to start. The audit status will remain <span className="font-bold">Not Started</span> until scanning begins.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchableSelect
            label="Assigned Person"
            value={form.assigned_user_id}
            onChange={(id) => handleInputChange("assigned_user_id", id)}
            fetchService={(params) => userService.getViews({ 
              ...params, 
              permission_module: "audit", 
              permission_action: "view" 
            })}
            getByIdService={(id) => userService.getById(id)}
            dataKey="id"
            labelKey="name"
            subLabelKey="usercode"
            icon={User}
            error={errors.assigned_user_id}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <FormLabel required>Start Date</FormLabel>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="date"
                  data-field="start_date"
                  value={form.start_date} 
                  onChange={(e) => handleInputChange("start_date", e.target.value)} 
                  className={`${errors.start_date ? ERR_INPUT : OK_INPUT} text-[11px] h-[38px] rounded-lg border-slate-200 pl-9`}
                />
              </div>
              {errors.start_date && <p className="text-[9px] text-rose-500 mt-1 flex items-center gap-1 font-bold"><AlertCircle size={10}/>{errors.start_date}</p>}
            </div>

            <div className="space-y-1">
              <FormLabel required>End Date</FormLabel>
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="date"
                  data-field="end_date"
                  value={form.end_date} 
                  onChange={(e) => handleInputChange("end_date", e.target.value)} 
                  className={`${errors.end_date ? ERR_INPUT : OK_INPUT} text-[11px] h-[38px] rounded-lg border-slate-200 pl-9`}
                />
              </div>
              {errors.end_date && <p className="text-[9px] text-rose-500 mt-1 flex items-center gap-1 font-bold"><AlertCircle size={10}/>{errors.end_date}</p>}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <FormLabel required>Locations to Audit</FormLabel>
          <SearchableSelect
            multiple
            value={form.location_ids}
            onChange={(ids) => handleInputChange("location_ids", ids)}
            fetchService={(params) => locationService.getViews({ 
              ...params, 
              permission_module: "audit", 
              permission_action: "view" 
            })}
            getByIdService={(id) => locationService.getById(id)}
            dataKey="location_id"
            labelKey="location_no"
            icon={MapPin}
            error={errors.location_ids}
            placeholder="Select locations..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Remarks</label>
          <textarea 
            rows={2}
            value={form.remarks} 
            onChange={(e) => handleInputChange("remarks", e.target.value)} 
            placeholder="Audit instructions or notes..." 
            className={`${OK_INPUT} text-[11px] rounded-lg border-slate-200 resize-none py-2`}
          />
        </div>

        <div className="h-px bg-slate-100" />

        {!isApprove && !isEdit && (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400" />
            <p className="text-[10px] text-slate-500 italic">After saving, an authorized user must approve this schedule before the assigned worker can start the audit.</p>
          </div>
        )}

        <ModuleSopAcknowledgment
          ref={sopAckRef}
          key={`${open}-${sopPermissionType}`}
          moduleSlug="audit"
          permissionType={sopPermissionType}
          isOpen={open}
        />
      </div>
    </Drawer>
  );
}

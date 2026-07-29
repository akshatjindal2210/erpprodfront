"use client";

import { useState, useEffect, useRef } from "react";
import { Check, AlertCircle, Loader2, Shield, MapPin } from "lucide-react";
import { toast } from "react-toastify";

// Services & Components
import { locationService } from "@/apps/ims/lib/services/location";
import { masterService } from "@/apps/ims/lib/services/master";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import Drawer from "@/ui/primitives/Drawer";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { ERR_INPUT, OK_INPUT, FormLabel } from "@/ui/common/Constants";
import { focusFirstError } from "@/platform/utils/form/formFocus";

const FIELD_ORDER = ["rack_no", "shelf_no", "total_capacity"];

const INITIAL_FORM = {
  rack_no: "",
  shelf_no: "",
  location_description: "",
  total_capacity: "",
  acc_code: "",
  item_dcode: "",
  approved: false,
};

export default function LocationModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const canAccess = useCanAccess();
  const canApprove = canAccess("location_master", "authorize").allowed;

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";

  const showApproval = canApprove && (mode === "add" || mode === "approve");

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
          rack_no: editData.rack_no || "",
          shelf_no: editData.shelf_no || "",
          location_description: editData.location_description || "",
          total_capacity: editData.total_capacity || "",
          acc_code: editData.acc_code || "",
          item_dcode: editData.item_dcode || "",
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
  }, [open, editData?.location_id, isApprove]);

  const handleInputChange = (k, value) => {
    let finalValue = value;
    if (k === "rack_no") {
      finalValue = String(value || "").replace(/\D+/g, "");
    }
    if (k === "shelf_no") {
      finalValue = String(value || "").replace(/[^A-Za-z]+/g, "").toUpperCase();
    }
    if (["total_capacity"].includes(k) && value !== "") {
      const num = parseInt(value, 10);
      finalValue = isNaN(num) || num < 0 ? "" : num.toString();
    }
    setForm(prev => ({ ...prev, [k]: finalValue }));
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.rack_no?.trim()) e.rack_no = "Rack Number is required";
    else if (!/^\d+$/.test(form.rack_no.trim())) e.rack_no = "Rack Number must be numeric only";
    if (!form.shelf_no?.trim()) e.shelf_no = "Shelf No is required";
    else if (!/^[A-Za-z]+$/.test(form.shelf_no.trim())) e.shelf_no = "Shelf No must be alphabet only";
    if (!form.total_capacity || parseInt(form.total_capacity) <= 0) {
      e.total_capacity = "Enter valid capacity";
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
      let finalApproved = form.approved;
      
      // logic override for buttons
      if (statusOverride !== null) {
        finalApproved = statusOverride;
      } else if (isEdit && editData?.approved) {
        finalApproved = false;
      }

      const payload = {
        ...form,
        shelf_no: form.shelf_no?.trim().toUpperCase(),
        total_capacity: parseInt(form.total_capacity) || 0,
        acc_code: form.acc_code ? Number(form.acc_code) : null,
        item_dcode: form.item_dcode ? Number(form.item_dcode) : null,
        approved: finalApproved,
      };

      const isUpdate = isEdit || isApprove;
      const request = isUpdate 
        ? locationService.update(editData.location_id, payload) 
        : locationService.create(payload);
      
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
      title={isApprove ? "Approve Location" : isEdit ? "Edit Location" : "New Location"}
      description="Manage warehouse storage"
      footer={drawerFooter}
      maxWidth="max-w-4xl"
    >
      <div ref={formRef} className="space-y-4 pb-4">
        
        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized location will reset its status to <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require re-approval.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <FormLabel required>Rack No</FormLabel>
            <input 
              data-field="rack_no"
              value={form.rack_no} 
              onChange={(e) => handleInputChange("rack_no", e.target.value)} 
              placeholder="e.g. 48" 
              className={`${errors.rack_no ? ERR_INPUT : OK_INPUT} text-[11px] h-[38px] rounded-lg border-slate-200`}
            />
            {errors.rack_no && <p className="text-[9px] text-rose-500 mt-1 flex items-center gap-1 font-bold"><AlertCircle size={10}/>{errors.rack_no}</p>}
          </div>

          <div className="space-y-1">
            <FormLabel required>Shelf No</FormLabel>
            <input 
              data-field="shelf_no"
              value={form.shelf_no}
              onChange={(e) => handleInputChange("shelf_no", e.target.value.toUpperCase())}
              placeholder="e.g. A"
              className={`${errors.shelf_no ? ERR_INPUT : OK_INPUT} text-[11px] h-[38px] rounded-lg border-slate-200 uppercase`}
            />
            {errors.shelf_no && <p className="text-[9px] text-rose-500 mt-1 flex items-center gap-1 font-bold"><AlertCircle size={10}/>{errors.shelf_no}</p>}
          </div>

          <div className="space-y-1">
            <FormLabel required>Capacity</FormLabel>
            <input 
              data-field="total_capacity"
              type="number"
              min={1}
              value={form.total_capacity} 
              onChange={(e) => handleInputChange("total_capacity", e.target.value)} 
              className={`${errors.total_capacity ? ERR_INPUT : OK_INPUT} text-[11px] h-[38px] rounded-lg border-slate-200`}
            />
            {errors.total_capacity && (
              <p className="text-[9px] text-rose-500 mt-1 flex items-center gap-1 font-bold">
                <AlertCircle size={10} /> {errors.total_capacity}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchableSelect
            label="Customer / Account (Optional)"
            value={form.acc_code}
            onChange={(id) => handleInputChange("acc_code", id)}
            fetchService={(params) => masterService.getLedgersViews({ 
              ...params, 
              permission_module: "location_master", 
              permission_action: "view" 
            })}
            getByIdService={(id) => masterService.getLedgerViewById(id, { 
              permission_module: "location_master", 
              permission_action: "view" 
            })}
            dataKey="id"
            labelKey="acc_name"
          />

          <SearchableSelect
            label="Item Search (Optional)"
            value={form.item_dcode}
            onChange={(id) => handleInputChange("item_dcode", id)}
            fetchService={(params) => masterService.getItemsViews({ 
              ...params, 
              permission_module: "location_master", 
              permission_action: "view" 
            })}
            getByIdService={(id) => masterService.getItemViewById(id, { 
              permission_module: "location_master", 
              permission_action: "view" 
            })}
            dataKey="id"
            labelKey="item_code"
            subLabelKey="itemdesc"
          />
        </div>

        {/* QR code block (shown above location details when editing/approving) */}
        {(isEdit || isApprove) && editData?.qr_code && (
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg border border-slate-200">
              <MapPin size={14} className="text-indigo-500" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Generated QR Code</p>
              <p className="text-[11px] font-mono font-bold text-slate-700">{editData.qr_code}</p>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Location Details</label>
          <textarea 
            rows={2}
            value={form.location_description} 
            onChange={(e) => handleInputChange("location_description", e.target.value)} 
            placeholder="Special instructions..." 
            className={`${OK_INPUT} text-[11px] rounded-lg border-slate-200 resize-none py-2`}
          />
        </div>

        <div className="h-px bg-slate-100" />

        {/* ── Approval Status ── */}
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
              <input type="checkbox" checked={form.approved} onChange={(e) => handleInputChange("approved", e.target.checked)} className="sr-only peer" />
              <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-400" />
            </label>
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
          moduleSlug="location_master"
          permissionType={sopPermissionType}
          isOpen={open}
        />
      </div>
    </Drawer>
  );
}


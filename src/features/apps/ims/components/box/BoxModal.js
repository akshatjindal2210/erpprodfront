"use client";

import { useState, useEffect, useRef } from "react";
import { Check, Loader2, Hash, ClipboardList, Layers } from "lucide-react";
import { toast } from "react-toastify";

import { boxService } from "@/features/apps/ims/services/box";
import { masterService } from "@/features/apps/ims/services/master";
import Drawer from "@/core/components/ui/Drawer";
import ModuleSopAcknowledgment from "@/core/components/common/ModuleSopAcknowledgment";
import SearchableSelect from "@/core/components/common/SearchableSelect";
import { ERR_INPUT, OK_INPUT } from "@/core/components/common/Constants";
import { locationService } from "@/features/apps/ims/services/location";
import { focusFirstError } from "@/core/utils/formFocus";

const FIELD_ORDER = ["box_no_uid", "qty"];

const INITIAL_FORM = {
  box_no_uid: "",
  packing_number: "",
  qty: 1,
  override_cust: "",
  location_id: "",
  in_uid: "",
  out_uid: "",
};

export default function BoxModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const isEdit = mode === "edit";
  const sopPermissionType = isEdit ? "edit" : "add";

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
          box_no_uid: editData.box_no_uid || "",
          packing_number: editData.packing_number || "",
          qty: Number(editData.qty) || 1,
          override_cust: editData.override_cust || "",
          location_id: editData.location_id || "",
          in_uid: editData.in_uid || "",
          out_uid: editData.out_uid || "",
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
  }, [open, editData?.box_uid]);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: "" }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.box_no_uid?.trim()) newErrors.box_no_uid = "Box UID is required";
    if (!form.qty || Number(form.qty) < 1) newErrors.qty = "Valid quantity required";
    return newErrors;
  };

  const handleSave = async () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      toast.error("Please fix the highlighted fields before saving.");
      focusFirstError(newErrors, FIELD_ORDER, (key) =>
        formRef.current?.querySelector(`[data-field="${key}"]`)
      );
      return;
    }
    if (!sopAckRef.current?.assertAcknowledged()) return;
    setLoading(true);

    try {
      const payload = {
        ...form,
        qty: Number(form.qty),
        location_id: form.location_id || null,
        override_cust: form.override_cust || null,
      };

      const request = isEdit
        ? boxService.update(editData?.box_uid, payload)
        : boxService.create(payload);
        
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

  const footerContent = (
    <div className="flex items-center justify-end gap-3 w-full">
      <button onClick={onClose} disabled={loading} className="px-5 py-2.5 text-sm font-bold text-slate-500">
        Cancel
      </button>

      <button
        onClick={() => handleSave()}
        disabled={loading}
        className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
      >
        {loading ? (
          <><Loader2 size={18} className="animate-spin" /> Processing</>
        ) : (
          <><Check size={18} /> Save</>
        )}
      </button>
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={() => handleSave()}
      title={isEdit ? "Edit Box" : "New Box"}
      description="Manage box tracking and placement"
      footer={footerContent}
      maxWidth="max-w-4xl"
    >
      <div ref={formRef} className="space-y-4 pb-4">

        {/* Core ID Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Box UID / Serial <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input 
                data-field="box_no_uid"
                value={form.box_no_uid} 
                onChange={(e) => handleChange("box_no_uid", e.target.value.toUpperCase())} 
                placeholder="UID-100201" 
                className={`pl-8 text-[11px] h-[38px] rounded-lg border-slate-200 ${errors.box_no_uid ? ERR_INPUT : OK_INPUT}`} 
              />
            </div>
            {errors.box_no_uid && <p className="text-[9px] text-rose-500 font-bold ml-1">{errors.box_no_uid}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Packing Slip Number
            </label>
            <div className="relative">
              <ClipboardList className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input 
                value={form.packing_number} 
                onChange={(e) => handleChange("packing_number", e.target.value)} 
                placeholder="PK-XXXX" 
                className={`pl-8 text-[11px] h-[38px] rounded-lg border-slate-200 ${OK_INPUT}`} 
              />
            </div>
          </div>
        </div>

        {/* Quantity and Smart Location Select */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Unit Quantity <span className="text-rose-500">*</span>
            </label>
            <input 
              data-field="qty"
              type="number" 
              min="1"
              value={form.qty} 
              onChange={(e) => handleChange("qty", e.target.value)} 
              className={`${errors.qty ? ERR_INPUT : OK_INPUT} text-[11px] h-[38px] rounded-lg border-slate-200`} 
            />
          </div>

          <SearchableSelect
            label="Storage Location"
            value={form.location_id}
            onChange={(id) => handleChange("location_id", id)}
            fetchService={(params) => locationService.getViews({ 
              ...params, 
              permission_module: "inventory_inwards", 
              permission_action: "view" 
            })}
            getByIdService={(id) => locationService.getViews({ 
              id, 
              permission_module: "inventory_inwards", 
              permission_action: "view" 
            })}
            dataKey="id"
            labelKey="location_no"
            subLabelKey="rack_no"
            placeholder="Select Location No"
          />
        </div>

        {/* Tracking UIDs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Inbound Reference</label>
            <div className="relative">
              <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input 
                value={form.in_uid} 
                onChange={(e) => handleChange("in_uid", e.target.value)} 
                placeholder="IN-UID" 
                className={`pl-8 text-[11px] h-[38px] rounded-lg border-slate-200 ${OK_INPUT}`} 
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Outbound Reference</label>
            <div className="relative">
              <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input 
                value={form.out_uid} 
                onChange={(e) => handleChange("out_uid", e.target.value)} 
                placeholder="OUT-UID" 
                className={`pl-8 text-[11px] h-[38px] rounded-lg border-slate-200 ${OK_INPUT}`} 
              />
            </div>
          </div>
        </div>

        {/* Customer Select (Same as PackingModal) */}
        <SearchableSelect
          label="Assigned Customer / Account (Optional)"
          value={form.override_cust}
          onChange={(id) => handleChange("override_cust", id)}
          fetchService={masterService.getLedgersViews}
          getByIdService={masterService.getLedgerViewById}
          dataKey="id"
          labelKey="acc_name"
        />

        <ModuleSopAcknowledgment
          ref={sopAckRef}
          key={`${open}-${sopPermissionType}`}
          moduleSlug="boxes"
          permissionType={sopPermissionType}
          isOpen={open}
        />
      </div>
    </Drawer>
  );
}


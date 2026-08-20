"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { AlertCircle, Shield, MapPin } from "lucide-react";
import { notify } from "@/apps/rmstore/lib/utils/notify";

import { storeLocationService as locationService } from "@/apps/rmstore/lib/services/storeLocation";
import { productionErpHelpers } from "@/apps/rmstore/lib/services/production";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import Drawer from "@/ui/primitives/Drawer";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import { ERR_INPUT, OK_INPUT, FormLabel } from "@/ui/common/Constants";
import { focusFirstError } from "@/platform/utils/form/formFocus";

const MODULE = "rm_store_location_master";
const FIELD_ORDER = ["rack_no", "row_no", "total_capacity"];

const FIELD_INPUT_CLASS =
  "min-h-9 h-9 sm:h-[38px] text-sm sm:text-[11px] rounded-lg border-slate-200 text-slate-900 placeholder:text-slate-500 placeholder:opacity-100";

const INITIAL_FORM = {
  rack_no: "",
  row_no: "",
  location_description: "",
  total_capacity: "",
  item_dcode: "",
  approved: false,
};

export default function LocationModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const canAccess = useCanAccess();
  const canApprove = canAccess(MODULE, "authorize").allowed;

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";
  const helperPerms = {
    permission_module: MODULE,
    permission_action: isApprove ? "authorize" : isEdit ? "edit" : "add",
  };

  const showApproval = canApprove && (mode === "add" || mode === "approve");

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const sopAckRef = useRef(null);
  const formRef = useRef(null);
  const savingRef = useRef(false);

  useEffect(() => {
    let timeoutId;
    if (open) {
      if (editData) {
        setForm({
          rack_no: editData.rack_no || "",
          row_no: editData.row_no || "",
          location_description: editData.location_description || "",
          total_capacity: editData.total_capacity || "",
          item_dcode: editData.item_dcode != null ? String(editData.item_dcode) : "",
          approved: isApprove,
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
    if (k === "row_no") {
      finalValue = String(value || "").replace(/[^A-Za-z]+/g, "").toUpperCase();
    }
    if (k === "total_capacity" && value !== "") {
      const num = parseInt(value, 10);
      finalValue = isNaN(num) || num < 0 ? "" : num.toString();
    }
    setForm(prev => ({ ...prev, [k]: finalValue }));
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!form.rack_no?.trim()) e.rack_no = "RM rack is required.";
    else if (!/^\d+$/.test(form.rack_no.trim())) e.rack_no = "RM rack must contain numbers only.";
    if (!form.row_no?.trim()) e.row_no = "RM row is required.";
    else if (!/^[A-Za-z]+$/.test(form.row_no.trim())) e.row_no = "RM row must contain letters only.";
    if (!form.total_capacity || parseInt(form.total_capacity) <= 0) {
      e.total_capacity = "Enter a valid capacity.";
    }
    return e;
  };

  const handleSave = async (statusOverride = null) => {
    if (savingRef.current || loading) return;
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
    if ((isEdit || isApprove) && !editData?.location_id) {
      toast.error("The location is missing. Close and reopen the row.");
      return;
    }
    savingRef.current = true;
    setLoading(true);

    try {
      let finalApproved = form.approved;
      if (statusOverride !== null) {
        finalApproved = statusOverride;
      } else if (isEdit && editData?.approved) {
        finalApproved = false;
      }

      const payload = {
        rack_no: form.rack_no,
        row_no: form.row_no?.trim().toUpperCase(),
        location_description: form.location_description,
        total_capacity: parseInt(form.total_capacity) || 0,
        item_dcode: form.item_dcode ? Number(form.item_dcode) : null,
        approved: finalApproved,
      };

      const isUpdate = isEdit || isApprove;
      const request = isUpdate 
        ? locationService.update(editData.location_id, payload) 
        : locationService.create(payload);
      
      const response = await request;
      notify(response, "Saved successfully.");
      
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Could not save the location. Please try again.");
    } finally {
      savingRef.current = false;
      setLoading(false);
    }
  };

  const drawerFooter = (
    <RmStoreDrawerFooter
      onClose={onClose}
      loading={loading}
      isApprove={isApprove}
      onSave={handleSave}
    />
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={() => handleSave(isApprove ? true : undefined)}
      title={isApprove ? "Approve Store Location" : isEdit ? "Edit Store Location" : "New Store Location"}
      description="Manage warehouse storage locations"
      footer={drawerFooter}
      maxWidth="max-w-4xl"
    >
      <div ref={formRef} className="space-y-4 pb-4">
        
        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized location will reset its status to <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require re-authorization.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <FormLabel required>RM Rack</FormLabel>
            <input 
              data-field="rack_no"
              value={form.rack_no} 
              onChange={(e) => handleInputChange("rack_no", e.target.value)} 
              placeholder="e.g. 48" 
              className={`${errors.rack_no ? ERR_INPUT : OK_INPUT} ${FIELD_INPUT_CLASS}`}
            />
            {errors.rack_no && <p className="text-[9px] text-rose-500 mt-1 flex items-center gap-1 font-bold"><AlertCircle size={10}/>{errors.rack_no}</p>}
          </div>

          <div className="space-y-1">
            <FormLabel required>RM Row</FormLabel>
            <input 
              data-field="row_no"
              value={form.row_no}
              onChange={(e) => handleInputChange("row_no", e.target.value)}
              placeholder="e.g. A"
              className={`${errors.row_no ? ERR_INPUT : OK_INPUT} ${FIELD_INPUT_CLASS} uppercase`}
            />
            {errors.row_no && <p className="text-[9px] text-rose-500 mt-1 flex items-center gap-1 font-bold"><AlertCircle size={10}/>{errors.row_no}</p>}
          </div>

          <div className="space-y-1">
            <FormLabel required>Capacity</FormLabel>
            <input 
              data-field="total_capacity"
              type="number"
              min={1}
              value={form.total_capacity} 
              onChange={(e) => handleInputChange("total_capacity", e.target.value)} 
              className={`${errors.total_capacity ? ERR_INPUT : OK_INPUT} ${FIELD_INPUT_CLASS}`}
            />
            {errors.total_capacity && (
              <p className="text-[9px] text-rose-500 mt-1 flex items-center gap-1 font-bold">
                <AlertCircle size={10} /> {errors.total_capacity}
              </p>
            )}
          </div>
        </div>

        <SearchableSelect
          label="RM Item (optional)"
          value={form.item_dcode}
          onChange={(id) => handleInputChange("item_dcode", id ?? "")}
          fetchService={(params) =>
            productionErpHelpers.getRmItemsViews({ ...params, ...helperPerms })
          }
          getByIdService={(id) => productionErpHelpers.getRmItemViewById(id, helperPerms)}
          dataKey="id"
          labelKey="item_code"
          subLabelKey="itemdesc"
          showDuplicateSubLabel
          preserveApiOrder
        />

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

        <FormTextarea
          label="Location Details"
          rows={3}
          value={form.location_description}
          onChange={(e) => handleInputChange("location_description", e?.target?.value ?? e ?? "")}
          placeholder="Enter special instructions (optional)"
        />

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
          moduleSlug={MODULE}
          permissionType={sopPermissionType}
          isOpen={open}
        />
      </div>
    </Drawer>
  );
}


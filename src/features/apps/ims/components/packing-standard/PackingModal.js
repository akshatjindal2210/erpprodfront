"use client";

import { useState, useEffect, useRef } from "react";
import { Check, AlertCircle, Loader2, Shield, ChevronDown } from "lucide-react";
import { toast } from "react-toastify";

import { packingStandardService } from "@/features/apps/ims/services/packingStandard";
import { masterService } from "@/features/apps/ims/services/master";
import { categoryService } from "@/features/apps/ims/services/category";
import SearchableSelect from "@/core/components/common/SearchableSelect";
import Drawer from "@/core/components/ui/Drawer";
import ModuleSopAcknowledgment from "@/core/components/common/ModuleSopAcknowledgment";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import { ERR_INPUT, OK_INPUT, UNIT_OPTIONS, FormLabel } from "@/core/components/common/Constants";
import { sortFilterOptionsAsc } from "@/core/utils/sortSelectOptions";
import { focusFirstError } from "@/core/utils/formFocus";

const FIELD_ORDER = ["item_dcode", "qty", "type", "sticker_type"];

const INITIAL_FORM = {
  item_dcode: "",
  qty: 1,
  unit: "PCS",
  type: "",
  sticker_type: 1,
  acc_code: "",
  approved: false,
};

const STICKER_TYPE_OPTIONS = [
  { value: 1, label: "BOX" },
];

export default function PackingModal({ open, onClose, onSuccess, editData, mode = "add" }) {

  const canAccess = useCanAccess();
  const canApprove = canAccess("packing_standard", "authorize").allowed;

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";

  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";

  const showApproval = canApprove && (mode === "add" || mode === "approve");

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const sopAckRef = useRef(null);
  const formRef = useRef(null);

  const editStandardId = editData?.standard_id ?? null;

  useEffect(() => {
    let timeoutId;

    if (open) {
      if (editData) {
        setForm({
          item_dcode: editData.item_dcode ?? "",
          qty: Number(editData.qty) > 0 ? Number(editData.qty) : 1,
          unit: editData.unit || "PCS",
          type: editData.type ?? "",
          sticker_type: Number(editData.sticker_type) || 1,
          acc_code: editData.acc_code ?? "",
          approved: isApprove ? (editData?.approved ?? false) : false,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when drawer opens or row/mode changes
  }, [open, editStandardId, isApprove]);

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: "" }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!form.item_dcode) newErrors.item_dcode = "Please select an item";
    if (!Number.isFinite(form.qty) || form.qty < 1) newErrors.qty = "Quantity must be at least 1";
    if (!form.type) newErrors.type = "Category type is mandatory";
    if (!form.sticker_type) newErrors.sticker_type = "Sticker type is mandatory";

    return newErrors;
  };

  const handleSave = async (statusOverride = null) => {
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

    if ((isEdit || isApprove) && !editData?.standard_id) {
      toast.error("Record ID missing — close and open the row again.");
      return;
    }

    setLoading(true);

    try {
      let finalApproved = form.approved;

      if (statusOverride != null) {
        finalApproved = statusOverride;
      } else if (isEdit && editData?.approved) {
        finalApproved = false;
      }

      const payload = {
        item_dcode: Number(form.item_dcode),
        qty: parseInt(String(form.qty), 10),
        unit: form.unit,
        type: Number(form.type),
        sticker_type: Number(form.sticker_type),
        acc_code: form.acc_code !== "" && form.acc_code != null ? Number(form.acc_code) : null,
        approved: finalApproved,
      };

      const isUpdate = isEdit || isApprove;
      const request = isUpdate
        ? packingStandardService.update(editData.standard_id, payload)
        : packingStandardService.create(payload);
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
      <button type="button" onClick={onClose} disabled={loading} className="px-5 py-2.5 text-sm font-bold text-slate-500">
        Cancel
      </button>

      {isApprove ? (
        <>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            Keep Pending
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={loading}
            className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />} Approve
          </button>
        </>
      ) : (
        <button
          type="button"
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
      )}
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={() => handleSave(isApprove ? true : null)}
      title={isApprove ? "Approve Standard" : isEdit ? "Edit Packing Standard" : "New Packing Standard"}
      description="Manage item packing rules"
      footer={footerContent}
      maxWidth="max-w-4xl"
    >
      <div ref={formRef} className="space-y-4 pb-4">

        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized standard will reset its status to <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require re-approval.
            </p>
          </div>
        )}
        
        <div data-field="item_dcode">
        <SearchableSelect
          label="Item Search (Code / Description)"
          value={form.item_dcode}
          onChange={(id) => handleChange("item_dcode", id)}
          fetchService={(params) => masterService.getItemsViews({ 
            ...params, 
            permission_module: "packing_standard", 
            permission_action: "view" 
          })}
          getByIdService={(id) => masterService.getItemViewById(id, { 
            permission_module: "packing_standard", 
            permission_action: "view" 
          })}
          dataKey="id"
          labelKey="item_code"
          subLabelKey="itemdesc"
          error={errors.item_dcode}
          required
          helperText={isApprove ? "Adjust details if needed, then Approve or Keep Pending." : ""}
        />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Packing Qty <span className="text-rose-500">*</span>
            </label>
            <input
              data-field="qty"
              type="number"
              min="1"
              value={form.qty}
              onChange={(e) => {
                const raw = e.target.value;
                handleChange("qty", raw === "" ? "" : Number(raw));
              }}
              className={`${errors.qty ? ERR_INPUT : OK_INPUT} text-[11px] h-[38px] rounded-lg`}
            />
            {errors.qty && <p className="text-[9px] text-rose-500 font-bold ml-1">{errors.qty}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
              Unit of Measure
            </label>
            <div className="relative">
              <select
                value={form.unit}
                onChange={(e) => handleChange("unit", e.target.value)}
                className={`${OK_INPUT} text-[11px] h-[38px] rounded-lg appearance-none pr-10`}
              >
                {sortFilterOptionsAsc(UNIT_OPTIONS).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div data-field="type">
            <SearchableSelect
              label="Packing Category / Type"
              value={form.type}
              onChange={(id) => handleChange("type", id)}
              fetchService={(params) => categoryService.getViews({
                ...params,
                permission_module: "packing_standard",
                permission_action: "view"
              })}
              getByIdService={(id) => categoryService.getViews({
                id,
                permission_module: "packing_standard",
                permission_action: "view"
              })}
              dataKey="id"
              labelKey="name"
              placeholder="Search category..."
              error={errors.type}
              required
            />
            </div>

            <div className="space-y-1" data-field="sticker_type">
              <FormLabel required>Sticker Type</FormLabel>
              <div className="relative">
                <select
                  value={form.sticker_type}
                  onChange={(e) => handleChange("sticker_type", Number(e.target.value))}
                  className={`${errors.sticker_type ? ERR_INPUT : OK_INPUT} text-[11px] h-[38px] rounded-lg appearance-none pr-10`}
                >
                  {sortFilterOptionsAsc(STICKER_TYPE_OPTIONS).map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              </div>
              {errors.sticker_type && <p className="text-[9px] text-rose-500 font-bold ml-1">{errors.sticker_type}</p>}
            </div>
          </div>

          <SearchableSelect
            label="Customer / Account (Optional)"
            value={form.acc_code}
            onChange={(id) => handleChange("acc_code", id)}
            fetchService={(params) => masterService.getLedgersViews({ 
              ...params, 
              permission_module: "packing_standard", 
              permission_action: "view" 
            })}
            getByIdService={(id) => masterService.getLedgerViewById(id, { 
              permission_module: "packing_standard", 
              permission_action: "view" 
            })}
            dataKey="id"
            labelKey="acc_name"
          />
        </div>

        <div className="h-px bg-slate-100" />

        {/* ── Approval Status (add = toggle; approve = footer buttons only) ── */}
        {showApproval ? (
          isApprove ? (
            <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/80 flex items-start gap-2">
              <Shield size={16} className="text-indigo-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-indigo-900 font-medium leading-normal">
                Edit fields above as needed, then <span className="font-bold">Approve</span> or <span className="font-bold">Keep Pending</span> — the record updates together with that choice.
              </p>
            </div>
          ) : (
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
                <input
                  type="checkbox"
                  checked={form.approved}
                  onChange={(e) => handleChange("approved", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-400" />
              </label>
            </div>
          )
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400" />
            <p className="text-[10px] text-slate-500 italic">Standard will be marked as 'Pending' until authorized.</p>
          </div>
        )}
        <ModuleSopAcknowledgment
          ref={sopAckRef}
          key={`${open}-${sopPermissionType}`}
          moduleSlug="packing_standard"
          permissionType={sopPermissionType}
          isOpen={open}
        />
      </div>
    </Drawer>
  );
}

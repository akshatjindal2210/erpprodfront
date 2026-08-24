"use client";

import { useState, useEffect, useRef } from "react";
import { Check, AlertCircle, Loader2, Shield, MessageSquareQuote } from "lucide-react";
import { toast } from "react-toastify";

// Services & Components
import { stockAdjustmentService } from "@/apps/ims/lib/services/stockAdjustment";
import { masterService } from "@/apps/ims/lib/services/master";
import { fetchItemScopedLedgerById } from "@/apps/ims/lib/helpers/packingEntryCustomerSelect";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import Drawer from "@/ui/primitives/Drawer";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { focusFirstError } from "@/platform/utils/form/formFocus";

const FIELD_ORDER = ["adjustment_type", "item_dcode", "qty"];
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { ERR_INPUT, OK_INPUT } from "@/ui/common/Constants";
import { sortFilterOptionsAsc } from "@/platform/utils/form/sortSelectOptions";

const MODAL_LABEL_CLASS =
  "text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1";
const MODAL_INPUT_CLASS = "text-[11px] h-[38px] rounded-lg";
const MODAL_ERROR_CLASS =
  "text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1";

/** Legacy adjustment types (old rows may have `[Label]` prefix in remarks). */
export const STOCK_ADJUSTMENT_TYPES = [
  { value: "physical_count", label: "Physical stock count" },
  { value: "increase", label: "Increase stock (correction)" },
  { value: "decrease", label: "Decrease stock (correction)" },
  { value: "damage_scrap", label: "Damage / scrap" },
  { value: "other", label: "Other" },
];

function stripLegacyRemarkPrefixes(text) {
  return String(text ?? "")
    .trim()
    .replace(/^\[Packing:\s*[^\]]+\]\s*/i, "")
    .trim();
}

export function parseStoredRemarks(raw) {
  const text = stripLegacyRemarkPrefixes(raw);
  for (const t of STOCK_ADJUSTMENT_TYPES) {
    const prefix = `[${t.label}]`;
    if (text.startsWith(prefix)) {
      const rest = stripLegacyRemarkPrefixes(text.slice(prefix.length));
      return { adjustment_type: t.value, remarks: rest };
    }
  }
  return { adjustment_type: "", remarks: text };
}

/** Save remarks as plain text only (no type/packing prefixes). */
export function buildStoredRemarks(_typeValue, userRemarks) {
  return String(userRemarks ?? "").trim();
}

export function plainRemarksForDisplay(raw) {
  return parseStoredRemarks(raw).remarks;
}

const INITIAL_FORM = {
  adjustment_type: "",
  item_dcode: "",
  qty: "",
  unit: "PCS",
  remarks: "",
  approved: false,
  acc_code: "",
  acc_name: "",
};

export default function StockAdjustmentModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const canAccess = useCanAccess();
  const canApprove = canAccess("stock_adjustment", "authorize").allowed;

  const isView = mode === "view";
  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const readOnly = isView;

  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";

  const showApproval = canApprove && (mode === "add" || mode === "approve") && !readOnly;

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const sopAckRef = useRef(null);
  const formRef = useRef(null);

  /**
   * Effect: Reset or Sync Form Data
   */
  useEffect(() => {
    let timeoutId;
    if (open) {
      if (editData) {
        const parsed = parseStoredRemarks(editData.remarks);
          setForm({
            adjustment_type: parsed.adjustment_type,
            item_dcode: editData.item_dcode || "",
            qty: editData.qty || "",
            unit: editData.unit || "PCS",
            remarks: parsed.remarks,
            approved: isApprove ? (editData.approved ?? false) : false,
            acc_code: editData.acc_code || "",
            acc_name: editData.acc_name || "",
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
  }, [open, editData?.adjustment_id, isApprove]);

  /**
   * Input Change Handler
   */
  const handleInputChange = (k, value) => {
    if (readOnly) return;
    let finalValue = value;
    if (k === "item_dcode") {
      finalValue = value === null || value === undefined || value === "" ? "" : String(value);
      setForm((prev) => ({ ...prev, item_dcode: finalValue, acc_code: "", acc_name: "" }));
      if (errors.item_dcode) setErrors((prev) => ({ ...prev, item_dcode: "" }));
      if (errors.acc_code) setErrors((prev) => ({ ...prev, acc_code: "" }));
      return;
    }
    if (k === "qty" && value !== "") {
      const num = parseFloat(value);
      if (num < 0) finalValue = "0";
    }
    setForm(prev => ({ ...prev, [k]: finalValue }));
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: "" }));
  };

  /**
   * Validation Logic
   */
  const validate = () => {
    const e = {};
    if (!form.adjustment_type) e.adjustment_type = "Select adjustment type";
    if (!form.item_dcode) e.item_dcode = "Please select an item";
    if (!form.qty || isNaN(form.qty) || parseFloat(form.qty) <= 0) {
      e.qty = "Enter a valid quantity (must be greater than 0)";
    }
    
    return e;
  };

  /**
   * Save Handler
   */
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

      const remarksForApi = buildStoredRemarks(form.adjustment_type, form.remarks);
      const payload = {
        item_dcode: parseInt(form.item_dcode),
        qty: parseInt(form.qty),
        unit: form.unit,
        remarks: remarksForApi,
        approved: finalApproved,
        acc_code: form.acc_code || null,
      };

      const isUpdate = isEdit || isApprove;
      if (isUpdate) {
        await stockAdjustmentService.update(editData.adjustment_id, payload);
        toast.success("Stock adjustment updated");
      } else {
        await stockAdjustmentService.create(payload);
        toast.success("Stock adjusted successfully");
      }
      
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  // Drawer Footer
  const footer = readOnly ? (
    <div className="flex items-center justify-end gap-3 w-full">
      <button
        type="button"
        onClick={onClose}
        className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-colors"
      >
        Close
      </button>
    </div>
  ) : (
    <div className="flex items-center justify-end gap-3 w-full">
      <button 
        onClick={onClose} 
        disabled={loading}
        className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 disabled:opacity-50 transition-colors"
      >
        Cancel
      </button>

      {isApprove ? (
        <>
          <button
            onClick={() => handleSave(false)}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          >
            Keep Pending
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={loading}
            className="min-w-[140px] px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Shield size={18} />} Approve
          </button>
        </>
      ) : (
        <button
          onClick={() => handleSave()}
          disabled={loading}
          className="min-w-[160px] px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:bg-indigo-400 active:scale-95"
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Committing...</>
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
      onSubmit={readOnly ? undefined : () => handleSave(isApprove ? true : undefined)}
      title={
        isView
          ? "View Adjustment"
          : isApprove
            ? "Approve Adjustment"
            : isEdit
              ? "Edit Adjustment"
              : "New Adjustment"
      }
      description={
        isView
          ? "Read-only stock details"
          : "Manually update stock levels"
      }
      footer={footer}
      maxWidth="max-w-2xl"
    >
      <div ref={formRef} className="space-y-6 pb-6">
        
        {isEdit && !readOnly && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized adjustment will reset its status to <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require re-approval.
            </p>
          </div>
        )}

        {(editData?.entry_type === "add" || editData?.entry_type === "minus") && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-[11px] text-slate-700">
            <p className={`${MODAL_LABEL_CLASS} !ml-0`}>Packing entry (read-only)</p>
            <p>
              <span className="font-bold text-slate-500">Type:</span>{" "}
              {editData.entry_type === "add"
                ? "Add (+)"
                : editData.entry_type === "minus"
                  ? "Minus (−)"
                  : editData.entry_type === "update"
                    ? "Update"
                    : editData.entry_type}
            </p>
            <p>
              <span className="font-bold text-slate-500">Packing no.:</span> {editData.packing_number || "—"}
            </p>
            {editData.entry_type === "add" && editData.financial_year && (
              <p>
                <span className="font-bold text-slate-500">Financial year:</span> {editData.financial_year}
              </p>
            )}
            {editData.per_box_qty != null && (
              <p>
                <span className="font-bold text-slate-500">Per box qty:</span> {editData.per_box_qty}
              </p>
            )}
            {editData.box_count_impact != null && (
              <p>
                <span className="font-bold text-slate-500">Box impact:</span> {editData.box_count_impact}
              </p>
            )}
            {editData.entry_type === "minus" && editData.removed_box_ids && (
              <p className="text-[10px] text-slate-500 break-all">
                <span className="font-bold text-slate-500">Box UIDs:</span> {editData.removed_box_ids}
              </p>
            )}
          </div>
        )}

        <div className="space-y-1.5" data-field="adjustment_type">
          <label className={MODAL_LABEL_CLASS}>
            Adjustment type <span className="text-rose-500">*</span>
          </label>
          <select
            value={form.adjustment_type}
            onChange={(e) => handleInputChange("adjustment_type", e.target.value)}
            disabled={readOnly}
            className={`${errors.adjustment_type ? ERR_INPUT : OK_INPUT} ${MODAL_INPUT_CLASS}`}
          >
            <option value="">Select type…</option>
            {sortFilterOptionsAsc(STOCK_ADJUSTMENT_TYPES).map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {errors.adjustment_type && (
            <p className={`${MODAL_ERROR_CLASS} px-1`}>
              <AlertCircle size={10} /> {errors.adjustment_type}
            </p>
          )}
        </div>

        {/* Item Selection — helper catalogue (views API), no extra copy / summary UI */}
        <div className="space-y-1" data-field="item_dcode">
          <SearchableSelect
            label="Target Item"
            value={form.item_dcode}
            onChange={(id) => handleInputChange("item_dcode", id ?? "")}
            fetchService={(params) => masterService.getItemsViews({ 
              ...params, 
              permission_module: "stock_adjustment", 
              permission_action: "view" 
            })}
            getByIdService={(id) => masterService.getItemViewById(id, { 
              permission_module: "stock_adjustment", 
              permission_action: "view" 
            })}
            dataKey="id"
            labelKey="item_code"
            subLabelKey="itemdesc"
            placeholder="Search item code or name..."
            error={errors.item_dcode}
            required={!readOnly}
            disabled={readOnly}
            usePortal={false}
          />
        </div>

        {/* Customer Selection */}
        <div className="space-y-1" data-field="acc_code">
          <SearchableSelect
            label="Customer"
            value={form.acc_code}
            onChange={(id, item) => {
              handleInputChange("acc_code", id ?? "");
              setForm((prev) => ({
                ...prev,
                acc_name: item?.acc_name?.trim() ? String(item.acc_name).trim() : "",
              }));
            }}
            fetchService={(params) =>
              masterService.getLedgersViews({
                ...params,
                permission_module: "stock_adjustment",
                permission_action: "view",
                itemdcode: form.item_dcode || undefined,
              })
            }
            getByIdService={(id) =>
              fetchItemScopedLedgerById(
                id,
                {
                  permission_module: "stock_adjustment",
                  permission_action: "view",
                  itemdcode: form.item_dcode || undefined,
                },
                form
              )
            }
            dataKey="id"
            labelKey="acc_name"
            labelOnlyDisplay
            placeholder={form.item_dcode ? "Search customer…" : "Select item first"}
            disabled={readOnly || !form.item_dcode}
            usePortal={false}
          />
        </div>

        {/* Qty & Unit Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5" data-field="qty">
            <label className={MODAL_LABEL_CLASS}>
              Adjustment Qty <span className="text-rose-500">*</span>
            </label>
            <input 
              type="number"
              value={form.qty} 
              onChange={(e) => handleInputChange("qty", e.target.value)} 
              placeholder="e.g. 10 or 25" 
              disabled={readOnly}
              className={`${errors.qty ? ERR_INPUT : OK_INPUT} ${MODAL_INPUT_CLASS}`}
            />
            <div className="flex justify-between items-center px-1">
              {errors.qty && (
                <p className={MODAL_ERROR_CLASS}>
                  <AlertCircle size={10}/> {errors.qty}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={MODAL_LABEL_CLASS}>Unit</label>
            <select 
              value={form.unit} 
              onChange={(e) => handleInputChange("unit", e.target.value)}
              disabled={readOnly}
              className={`${OK_INPUT} ${MODAL_INPUT_CLASS}`}
            >
              <option value="PCS">PCS (Pieces)</option>
              <option value="KG">KG (Kilograms)</option>
            </select>
          </div>
        </div>

        <FormTextarea
          label="Adjustment Reason"
          labelIcon={<MessageSquareQuote size={12} className="text-indigo-500" />}
          labelClassName={MODAL_LABEL_CLASS}
          className="[&_textarea]:!text-[11px] [&_textarea]:!min-h-[4.5rem] [&_textarea]:!py-2"
          value={form.remarks}
          onChange={(e) => handleInputChange("remarks", e.target.value)}
          placeholder="Optional — short note if needed..."
          readOnly={readOnly}
          disabled={readOnly}
          error={errors.remarks}
          rows={4}
        />

        <div className="h-px bg-slate-100" />

        {/* Admin/Approval Section */}
        {showApproval || readOnly ? (
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
            {!readOnly ? (
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={form.approved} onChange={(e) => handleInputChange("approved", e.target.checked)} className="sr-only peer" />
                <div className="w-10 h-5.5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-emerald-400" />
              </label>
            ) : null}
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400" />
            <p className="text-[10px] text-slate-500 italic">This entry will require authorization before becoming active.</p>
          </div>
        )}

        {!readOnly ? (
          <ModuleSopAcknowledgment
            ref={sopAckRef}
            key={`${open}-${sopPermissionType}`}
            moduleSlug="stock_adjustment"
            permissionType={sopPermissionType}
            isOpen={open}
          />
        ) : null}

      </div>
    </Drawer>
  );
}


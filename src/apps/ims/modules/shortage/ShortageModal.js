"use client";

import { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { Check, Loader2, ChevronDown, Shield, AlertCircle, MessageSquareQuote } from "lucide-react";
import { toast } from "react-toastify";

import { shortageService, SHORTAGE_TYPES } from "@/apps/ims/lib/services/shortage";
import { masterService } from "@/apps/ims/lib/services/master";
import { isImsSuperAdmin } from "@/apps/ims/lib/utils/imsSpecialPermissions";
import { selectUser } from "@/platform/store/slices/authSlice";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import FormTextarea from "@/ui/common/forms/FormTextarea";
import Drawer from "@/ui/primitives/Drawer";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { ERR_INPUT, OK_INPUT, FormLabel } from "@/ui/common/Constants";
import { focusFirstError } from "@/platform/utils/form/formFocus";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";

const FIELD_ORDER = ["itemdcode", "type", "qty", "month", "remarks"];

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayYm() {
  return todayYmd().slice(0, 7);
}

/**
 * Calendar month YYYY-MM for <input type="month">.
 * DATE-only strings trusted; ISO datetimes use LOCAL calendar (IST-safe).
 */
function toMonthValue(value) {
  if (value == null || value === "") return todayYm();

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  const raw = String(value).trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 7);

  // ISO with time (e.g. 2026-09-30T18:30:00.000Z from TZ) → local calendar month
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      return `${y}-${m}`;
    }
  }

  const iso = raw.match(/^(\d{4})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  return todayYm();
}

/** Save payload: YYYY-MM or any → YYYY-MM-01 */
function monthToSaveDate(value) {
  const ym = toMonthValue(value);
  return `${ym}-01`;
}

const INITIAL_FORM = {
  itemdcode: "",
  itemcode: "",
  type: "",
  qty: 1,
  month: todayYm(),
  remarks: "",
  approved: false,
};

export default function ShortageModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const user = useSelector(selectUser);
  const canAccess = useCanAccess();
  const canApprove = canAccess("shortage", "authorize").allowed;
  const showMonthField = isImsSuperAdmin(user);

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";
  const showApproval = canApprove && (mode === "add" || mode === "approve");

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(() => ({ ...INITIAL_FORM, month: todayYm() }));
  const [errors, setErrors] = useState({});
  const sopAckRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    let timeoutId;
    if (open) {
      if (editData) {
        setForm({
          itemdcode: editData.itemdcode != null ? String(editData.itemdcode) : "",
          itemcode: editData.itemcode || editData.item_code || "",
          type: editData.type || "",
          qty: Number(editData.qty) > 0 ? Number(editData.qty) : 1,
          month: toMonthValue(editData.month || editData.shortage_month),
          remarks: editData.remarks || "",
          approved: isApprove ? Boolean(editData?.approved) : false,
        });
      } else {
        setForm({ ...INITIAL_FORM, month: todayYm() });
      }
      setErrors({});
    } else {
      timeoutId = setTimeout(() => {
        setForm({ ...INITIAL_FORM, month: todayYm() });
        setErrors({});
      }, 300);
    }
    return () => clearTimeout(timeoutId);
  }, [open, editData?.id, isEdit, isApprove]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.itemdcode) newErrors.itemdcode = "Please select an item";
    if (!form.type) newErrors.type = "Type is required";
    if (!Number.isFinite(Number(form.qty)) || Number(form.qty) < 1) {
      newErrors.qty = "Quantity must be at least 1";
    }
    if (showMonthField && !/^\d{4}-\d{2}$/.test(String(form.month || "").trim())) {
      newErrors.month = "Month is required";
    }
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

    if ((isEdit || isApprove) && !editData?.id) {
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
        itemdcode: parseInt(String(form.itemdcode), 10),
        itemcode: form.itemcode ? String(form.itemcode).trim() : String(form.itemdcode),
        type: form.type,
        qty: parseInt(String(form.qty), 10),
        // Always send calendar YYYY-MM-01 (month picker has no day/TZ)
        month: showMonthField || isEdit || isApprove ? monthToSaveDate(form.month) : todayYmd(),
        remarks: form.remarks ? String(form.remarks).trim() : null,
        approved: finalApproved,
      };

      if (isEdit || isApprove) {
        await shortageService.update(editData.id, payload);
      } else {
        await shortageService.create(payload);
      }

      toast.success("Successfully saved");
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
            <>
              <Loader2 size={18} className="animate-spin" /> Processing
            </>
          ) : (
            <>
              <Check size={18} /> Save
            </>
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
      title={isApprove ? "Approve Shortage" : isEdit ? "Edit Shortage" : "New Shortage"}
      description={
        isApprove
          ? "You can edit details here, then approve or keep pending."
          : "Record item shortage entries"
      }
      footer={footerContent}
      maxWidth="max-w-2xl"
    >
      <form ref={formRef} className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        <ModuleSopAcknowledgment ref={sopAckRef} moduleSlug="shortage" permissionType={sopPermissionType} />

        {isApprove ? (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-[11px] text-emerald-800 font-medium leading-normal">
              Fields are editable. Change anything needed, then click <span className="font-bold uppercase">Approve</span>.
            </p>
          </div>
        ) : null}

        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized record will reset its status to <span className="font-bold uppercase">Pending</span>.
            </p>
          </div>
        )}

        <div data-field="itemdcode">
          <SearchableSelect
            label="Item"
            value={form.itemdcode}
            onChange={(id, item) => {
              setForm((prev) => ({
                ...prev,
                itemdcode: id ?? "",
                itemcode: item?.item_code ? String(item.item_code).trim() : prev.itemcode,
              }));
              if (errors.itemdcode) setErrors((prev) => ({ ...prev, itemdcode: "" }));
            }}
            fetchService={(params) =>
              masterService.getItemsViews({
                ...params,
                permission_module: "shortage",
                permission_action: isApprove ? "authorize" : isEdit ? "edit" : "add",
                filters: "fg",
              })
            }
            getByIdService={(id) =>
              masterService.getItemViewById(id, {
                permission_module: "shortage",
                permission_action: isApprove ? "authorize" : isEdit ? "edit" : "add",
              })
            }
            dataKey="id"
            labelKey="item_code"
            subLabelKey="itemdesc"
            error={errors.itemdcode}
            required
            disabled={loading}
          />
        </div>

        <div data-field="type">
          <FormLabel required>Type</FormLabel>
          <div className="relative">
            <select
              value={form.type}
              onChange={(e) => handleChange("type", e.target.value)}
              disabled={loading}
              className={`w-full appearance-none px-3 py-2.5 text-sm border rounded-lg pr-10 ${errors.type ? ERR_INPUT : OK_INPUT}`}
            >
              <option value="">Select type...</option>
              {SHORTAGE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          {errors.type && <p className="text-xs text-rose-500 mt-1">{errors.type}</p>}
        </div>

        <div className={showMonthField ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : undefined}>
          {showMonthField ? (
            <div data-field="month">
              <FormLabel required>Month</FormLabel>
              <input
                type="month"
                value={toMonthValue(form.month)}
                onChange={(e) => handleChange("month", e.target.value)}
                disabled={loading}
                className={`w-full px-3 py-2.5 text-sm border rounded-lg ${errors.month ? ERR_INPUT : OK_INPUT}`}
              />
              {errors.month ? <p className="text-xs text-rose-500 mt-1">{errors.month}</p> : null}
            </div>
          ) : null}

          <div data-field="qty">
            <FormLabel required>Quantity</FormLabel>
            <input
              type="number"
              min={1}
              value={form.qty}
              onChange={(e) => handleChange("qty", e.target.value)}
              disabled={loading}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg ${errors.qty ? ERR_INPUT : OK_INPUT}`}
            />
            {errors.qty && <p className="text-xs text-rose-500 mt-1">{errors.qty}</p>}
          </div>
        </div>

        <div data-field="remarks">
          <FormTextarea
            label="Remarks"
            labelIcon={<MessageSquareQuote size={12} className="text-indigo-500" />}
            className="[&_textarea]:!text-[11px] [&_textarea]:!min-h-[4.5rem] [&_textarea]:!py-2"
            value={form.remarks}
            onChange={(e) => handleChange("remarks", e.target.value)}
            placeholder="Optional — short note if needed..."
            disabled={loading}
            error={errors.remarks}
            rows={4}
          />
        </div>

        <div className="h-px bg-slate-100" />

        {showApproval ? (
          <div
            className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
              form.approved || isApprove ? "bg-emerald-600 border-emerald-700 shadow-sm" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  form.approved || isApprove ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                <Shield size={16} />
              </div>
              <div>
                <p className={`text-xs font-bold ${form.approved || isApprove ? "text-white" : "text-slate-700"}`}>
                  Approval Status
                </p>
                <p
                  className={`text-[9px] uppercase font-bold tracking-tight ${
                    form.approved || isApprove ? "text-emerald-100" : "text-slate-400"
                  }`}
                >
                  {isApprove
                    ? "Edit fields above, then Approve"
                    : form.approved
                      ? "Final & Locked"
                      : "Draft Mode"}
                </p>
              </div>
            </div>
            {!isApprove ? (
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.approved}
                  onChange={(e) => handleChange("approved", e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-400" />
              </label>
            ) : null}
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400" />
            <p className="text-[10px] text-slate-500 italic">
              This entry will require authorization before becoming active.
            </p>
          </div>
        )}
      </form>
    </Drawer>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { AlertCircle, Loader2, Shield } from "lucide-react";
import { toast } from "react-toastify";

import { productionService, productionErpHelpers } from "@/apps/rmstore/lib/services/production";
import RmStoreDrawerFooter from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import Drawer from "@/ui/primitives/Drawer";
import ModuleSopAcknowledgment from "@/ui/common/system/ModuleSopAcknowledgment";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { focusFirstError } from "@/platform/utils/form/formFocus";

const MODULE = "rm_production_master";
const FIELD_ORDER = ["item_dcode", "rm_item_dcode"];

const INITIAL_FORM = {
  item_dcode: "",
  rm_item_dcode: "",
  approved: false,
};

export default function ProductionModal({ open, onClose, onSuccess, editData, mode = "add" }) {
  const canAccess = useCanAccess();
  const canApprove = canAccess(MODULE, "authorize").allowed;

  const isEdit = mode === "edit";
  const isApprove = mode === "approve";
  const sopPermissionType = isApprove ? "authorize" : isEdit ? "edit" : "add";
  const showApproval = canApprove && (mode === "add" || mode === "approve");

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const sopAckRef = useRef(null);
  const formRef = useRef(null);

  const editId = editData?.production_id ?? null;

  useEffect(() => {
    let timeoutId;
    if (open) {
      if (editData) {
        setForm({
          item_dcode: editData.item_dcode ?? "",
          rm_item_dcode: editData.rm_item_dcode ?? "",
          approved: isApprove ? true : false,
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
  }, [open, editId, isApprove]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: "" }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.item_dcode) newErrors.item_dcode = "Select a production item.";
    if (!form.rm_item_dcode) newErrors.rm_item_dcode = "Select an RM item.";
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

    if ((isEdit || isApprove) && !editData?.production_id) {
      toast.error("The record ID is missing. Close and reopen the row.");
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
        rm_item_dcode: Number(form.rm_item_dcode),
        approved: finalApproved,
      };

      const isUpdate = isEdit || isApprove;
      const response = isUpdate
        ? await productionService.update(editData.production_id, payload)
        : await productionService.create(payload);

      toast.success(response?.message || "Saved successfully.");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Could not save the production mapping. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const footerContent = (
    <RmStoreDrawerFooter
      onClose={onClose}
      loading={loading}
      isApprove={isApprove}
      onSave={handleSave}
    />
  );

  const helperPerms = { permission_module: MODULE, permission_action: "view" };

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={() => handleSave(isApprove ? true : undefined)}
      title={isApprove ? "Approve Production Master" : isEdit ? "Edit Production Master" : "New Production Master"}
      description="Map a production item to a raw material item"
      footer={footerContent}
      maxWidth="max-w-4xl"
    >
      <div ref={formRef} className="space-y-4 pb-4">
        {isEdit && editData?.approved && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-700 font-medium leading-normal">
              Editing this authorized mapping will reset its status to{" "}
              <span className="font-bold text-amber-900 uppercase">Pending</span>. It will require
              re-approval.
            </p>
          </div>
        )}

        <div data-field="item_dcode">
          <SearchableSelect
            label="Production Item"
            value={form.item_dcode}
            onChange={(id) => handleChange("item_dcode", id)}
            fetchService={(params) =>
              productionErpHelpers.getProductionItemsViews({ ...params, ...helperPerms })
            }
            getByIdService={(id) =>
              productionErpHelpers.getProductionItemViewById(id, helperPerms)
            }
            dataKey="id"
            labelKey="item_code"
            subLabelKey="itemdesc"
            showDuplicateSubLabel
            preserveApiOrder
            error={errors.item_dcode}
            required
            helperText={
              isApprove ? "Adjust the details if needed, then set the approval status and save." : ""
            }
          />
        </div>

        <div data-field="rm_item_dcode">
          <SearchableSelect
            label="RM Item (Raw Material)"
            value={form.rm_item_dcode}
            onChange={(id) => handleChange("rm_item_dcode", id)}
            fetchService={(params) =>
              productionErpHelpers.getRmItemsViews({ ...params, ...helperPerms })
            }
            getByIdService={(id) => productionErpHelpers.getRmItemViewById(id, helperPerms)}
            dataKey="id"
            labelKey="item_code"
            subLabelKey="itemdesc"
            showDuplicateSubLabel
            preserveApiOrder
            error={errors.rm_item_dcode}
            required
          />
        </div>

        <div className="h-px bg-slate-100" />

        {showApproval ? (
          <div
            className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
              form.approved
                ? "bg-emerald-600 border-emerald-700 shadow-sm"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  form.approved ? "bg-white/20 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                <Shield size={16} />
              </div>
              <div>
                <p className={`text-xs font-bold ${form.approved ? "text-white" : "text-slate-700"}`}>
                  Approval Status
                </p>
                <p
                  className={`text-[9px] uppercase font-bold tracking-tight ${
                    form.approved ? "text-emerald-100" : "text-slate-400"
                  }`}
                >
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
        ) : (
          <div className="p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200 flex items-center gap-2">
            <AlertCircle size={16} className="text-slate-400" />
            <p className="text-[10px] text-slate-500 italic">
              This entry will require authorization before becoming active.
            </p>
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

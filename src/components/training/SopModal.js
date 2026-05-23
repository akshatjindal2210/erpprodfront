"use client";

import { useState, useEffect, useRef } from "react";
import { focusFirstError } from "@/utils/formFocus";
import { Plus, Edit3, Trash2, Info, Shield } from "lucide-react";
import { toast } from "react-toastify";
import { moduleSopService } from "@/services/training";
import RichTextEditor from "@/components/ui/RichTextEditor";
import Drawer from "@/components/ui/Drawer";

export default function SopModal({ slot, onClose, onSuccess }) {
  const [form, setForm] = useState({ description: "", is_required: false });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const formRef = useRef(null);
  const FIELD_ORDER = ["description"];

  const viewOnly = slot?.viewOnly === true;
  const readOnly = viewOnly || (slot?.isEdit && !slot?.canEdit);
  const ex = slot?.existingData;

  useEffect(() => {
    if (ex) {
      setForm({
        description: ex.description || "",
        is_required: !!ex.is_required,
      });
    } else {
      setForm({ description: "", is_required: false });
    }
    setErrors({});
  }, [slot]);

  const handleSave = async () => {
    if (readOnly) return;
    if (slot.isEdit && !slot.canEdit) {
      toast.error("You do not have permission to edit SOPs.");
      return;
    }
    if (!slot.isEdit && !slot.canAdd) {
      toast.error("You do not have permission to add SOPs.");
      return;
    }

    const e = {};
    if (!String(form.description || "").replace(/<[^>]*>/g, "").trim()) {
      e.description = "SOP description is required";
    }

    if (Object.keys(e).length) {
      setErrors(e);
      toast.warning("Please fill required fields");
      focusFirstError(e, FIELD_ORDER, (key) =>
        formRef.current?.querySelector(`[data-field="${key}"]`)
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        module_id: slot.modId,
        permission_type: slot.perm,
        description: form.description,
        is_required: !!form.is_required,
      };

      if (slot.isEdit) {
        await moduleSopService.update(slot.id, {
          description: form.description,
          is_required: !!form.is_required,
        });
        toast.success("SOP updated successfully");
      } else {
        await moduleSopService.create(payload);
        toast.success("SOP saved successfully");
      }
      onSuccess();
    } catch (err) {
      toast.error(err?.message || "Operation failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!slot.canDelete) {
      toast.error("You do not have permission to remove SOPs.");
      return;
    }
    if (!confirm("Are you sure you want to remove this SOP?")) return;
    setSaving(true);
    try {
      await moduleSopService.delete(slot.id);
      toast.success("SOP removed successfully");
      onSuccess();
    } catch (err) {
      toast.error(err?.message || "Failed to remove SOP");
    } finally {
      setSaving(false);
    }
  };

  const footerActions = (
    <div className="flex items-center justify-between w-full gap-2 flex-wrap">
      {slot.isEdit && slot.canDelete && !viewOnly && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={saving || readOnly}
          className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
        >
          <Trash2 size={16} />
          Remove
        </button>
      )}
      <div className="flex-1 min-w-[8px]" />
      <div className="flex items-center gap-3">
        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700">
          {viewOnly ? "Close" : "Cancel"}
        </button>
        {!viewOnly && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || readOnly || (slot.isEdit ? !slot.canEdit : !slot.canAdd)}
            className="px-8 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-violet-200 hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-60"
          >
            {saving ? "Processing..." : "Save"}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Drawer
      isOpen={!!slot}
      onClose={onClose}
      onSubmit={readOnly ? undefined : handleSave}
      title={
        <div className="flex items-center gap-2">
          {viewOnly ? (
            <Shield size={20} className="text-violet-600" />
          ) : slot.isEdit ? (
            <Edit3 size={20} className="text-violet-600" />
          ) : (
            <Plus size={20} className="text-violet-600" />
          )}
          <span className="font-bold">
            {viewOnly ? "View " : ""}
            {slot.perm.toUpperCase()} — Standard Operating Procedure
          </span>
        </div>
      }
      description={slot.modLabel}
      footer={footerActions}
      maxWidth="max-w-2xl"
    >
      <div ref={formRef} className="space-y-6 pb-24">
        <div className="space-y-1.5" data-field="description">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-1">
            <Info size={12} /> SOP description *
          </label>
          {viewOnly ? (
            <div
              className="prose prose-sm max-w-none text-slate-800 min-h-[120px] max-h-72 overflow-y-auto custom-scrollbar border border-slate-200 rounded-xl bg-slate-50/80 p-4"
              dangerouslySetInnerHTML={{ __html: form.description || "<p class='text-slate-400 italic'>No content.</p>" }}
            />
          ) : (
            <div className={readOnly ? "pointer-events-none opacity-90" : ""}>
              <RichTextEditor value={form.description} onChange={(html) => setForm({ ...form, description: html })} />
            </div>
          )}
          {errors.description && <p className="text-red-500 text-[10px] font-medium ml-1">{errors.description}</p>}
        </div>

        {!viewOnly && (
          <label className="flex items-start gap-3 cursor-pointer select-none rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
            <input
              type="checkbox"
              className="mt-1 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              checked={form.is_required}
              onChange={(e) => setForm({ ...form, is_required: e.target.checked })}
            />
            <span className="text-sm text-slate-700 leading-snug">
              <span className="font-bold text-slate-800">Required acknowledgment</span>
              <span className="block text-xs text-slate-500 mt-1 font-medium">
                When enabled, users must tick that they have read this SOP before they can submit related forms (for example, the training video form on this page).
              </span>
            </span>
          </label>
        )}

        {viewOnly && ex?.is_required && (
          <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
            This SOP is marked as required for acknowledgments on related actions.
          </p>
        )}
      </div>
    </Drawer>
  );
}

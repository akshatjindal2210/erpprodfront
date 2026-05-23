"use client";

import { useEffect, useState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/components/ui/Drawer";
import ModuleSopAcknowledgment from "@/components/common/ModuleSopAcknowledgment";
import { moduleService } from "@/services/module";
import { focusFirstError } from "@/utils/formFocus";
import { FormLabel } from "@/components/common/Constants";

const FIELD_ORDER = ["name", "label"];

const INITIAL_FORM = {
  name: "",
  label: ""
};

export default function ModuleModal({ open, onClose, onSuccess, editData }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const sopAckRef = useRef(null);
  const formRef = useRef(null);

  const isEdit = Boolean(editData);

  useEffect(() => {
    if (open) {
      if (editData) {
        setForm({
          name: editData.name ?? "",
          label: editData.label ?? ""
        });
      } else {
        setForm(INITIAL_FORM);
      }
      setErrors({});
    }
  }, [open, editData]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: "" }));
    }
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Module name is required";
    if (!form.label.trim()) nextErrors.label = "Module label is required";
    return nextErrors;
  };

  const handleSubmit = async () => {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      toast.warning("Please fill required fields");
      focusFirstError(nextErrors, FIELD_ORDER, (key) =>
        formRef.current?.querySelector(`[data-field="${key}"]`)
      );
      return;
    }
    if (!sopAckRef.current?.assertAcknowledged()) return;
    setLoading(true);
    try {
      if (isEdit) {
        await moduleService.update(editData.id, form);
        toast.success("Module updated successfully");
      } else {
        await moduleService.create(form);
        toast.success("Module created successfully");
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      toast.error(err?.message || "Failed to save module");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={isEdit ? "Edit Module" : "Create Module"}
      description="Manage module name and display label."
      maxWidth="max-w-xl"
      footer={(
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white inline-flex items-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Save
          </button>
        </div>
      )}
    >
      <div ref={formRef} className="space-y-4">
        <div>
          <FormLabel required className="text-xs font-semibold text-slate-600">Module Name</FormLabel>
          <input
            data-field="name"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. inventory_inwards"
          />
          {errors.name ? <p className="text-xs text-rose-500 mt-1">{errors.name}</p> : null}
        </div>

        <div>
          <FormLabel required className="text-xs font-semibold text-slate-600">Module Label</FormLabel>
          <input
            data-field="label"
            value={form.label}
            onChange={(e) => handleChange("label", e.target.value)}
            className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
            placeholder="e.g. In Entry"
          />
          {errors.label ? <p className="text-xs text-rose-500 mt-1">{errors.label}</p> : null}
        </div>
        <ModuleSopAcknowledgment
          ref={sopAckRef}
          key={`${open}-${isEdit ? "edit" : "add"}`}
          moduleSlug="modules"
          permissionType={isEdit ? "edit" : "add"}
          isOpen={open}
        />
      </div>
    </Drawer>
  );
}

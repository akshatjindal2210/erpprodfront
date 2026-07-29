"use client";

import { useState, useEffect } from "react";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import Drawer from "@/ui/primitives/Drawer";

const okCls =
  "w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 min-h-[34px]";
const errCls =
  "w-full bg-rose-50/40 border border-rose-300 rounded-md px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-100 min-h-[34px]";

/**
 * Add/Edit form in a side Drawer (Ctrl+S saves via Drawer onSubmit).
 */
export default function AddEditModal({
  open,
  onClose,
  onSuccess,
  editItem,
  service,
  entityLabel,
  icon: Icon,
  iconBg = "bg-indigo-50",
  iconBorder = "border-indigo-200",
  iconText = "text-indigo-600",
  buttonColor = "indigo",
  extraFields = [],
  onBuildPayload,
  maxWidth = "max-w-md",
}) {
  const isEdit = !!editItem;

  const saveBtnCls =
    buttonColor === "rose"
      ? "px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 inline-flex items-center gap-2 disabled:opacity-60"
      : buttonColor === "amber"
        ? "px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 inline-flex items-center gap-2 disabled:opacity-60"
        : buttonColor === "violet"
          ? "px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 inline-flex items-center gap-2 disabled:opacity-60"
          : "px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 inline-flex items-center gap-2 disabled:opacity-60";

  const [name, setName] = useState("");
  const [extraValues, setExtraValues] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editItem?.name ?? "");
    const initial = {};
    extraFields.forEach((f) => {
      const raw = editItem?.[f.key] ?? "";
      initial[f.key] = f.transform ? f.transform(raw) : (raw ?? "");
    });
    setExtraValues(initial);
    setErrors({});
  }, [editItem, open]);

  const setExtra = (key, val) => {
    setExtraValues((p) => ({ ...p, [key]: val }));
    setErrors((p) => ({ ...p, [key]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = "Name is required";
    extraFields.forEach((f) => {
      if (f.required && !extraValues[f.key]?.toString().trim()) {
        e[f.key] = `${f.label} is required`;
      }
    });
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }

    setLoading(true);
    try {
      const payload = onBuildPayload
        ? onBuildPayload(name.trim(), extraValues)
        : { name: name.trim(), ...extraValues };

      if (isEdit) {
        await service.update(editItem.id, payload);
        toast.success(`${entityLabel} updated`);
      } else {
        await service.create(payload);
        toast.success(`${entityLabel} added`);
      }
      onSuccess?.();
      onClose?.();
    } catch (err) {
      const msg = err.response?.data?.message || "";
      if (
        msg.toLowerCase().includes("duplicate") ||
        msg.toLowerCase().includes("unique") ||
        msg.toLowerCase().includes("already")
      ) {
        setErrors((p) => ({ ...p, name: `This ${entityLabel.toLowerCase()} name already exists` }));
      } else {
        toast.error(msg || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      onSubmit={handleSave}
      closeOnOutside={false}
      title={isEdit ? `Edit ${entityLabel}` : `Add ${entityLabel}`}
      description={isEdit ? `Update ${entityLabel.toLowerCase()} details` : `Create a new ${entityLabel.toLowerCase()}`}
      headerVariant="form"
      maxWidth={maxWidth}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className={saveBtnCls}
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Check size={14} /> {isEdit ? "Save Changes" : `Add ${entityLabel}`}
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {Icon && (
          <div className={`w-9 h-9 rounded-md ${iconBg} border ${iconBorder} flex items-center justify-center`}>
            <Icon size={16} className={iconText} />
          </div>
        )}

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
            Name <span className="text-rose-400">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((p) => ({ ...p, name: "" }));
            }}
            onKeyDown={(e) => e.key === "Enter" && extraFields.length === 0 && handleSave()}
            placeholder={`Enter ${entityLabel.toLowerCase()} name`}
            className={errors.name ? errCls : okCls}
            autoFocus
          />
          {errors.name && (
            <p className="flex items-center gap-1 text-xs text-rose-500 mt-1.5">
              <AlertCircle size={11} /> {errors.name}
            </p>
          )}
        </div>

        {extraFields.map((f) => (
          <div key={f.key}>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              {f.label} {f.required && <span className="text-rose-400">*</span>}
            </label>
            <input
              type={f.type ?? "text"}
              value={extraValues[f.key] ?? ""}
              placeholder={f.placeholder ?? ""}
              onChange={(e) => setExtra(f.key, e.target.value)}
              className={errors[f.key] ? errCls : okCls}
            />
            {errors[f.key] && (
              <p className="flex items-center gap-1 text-xs text-rose-500 mt-1.5">
                <AlertCircle size={11} /> {errors[f.key]}
              </p>
            )}
          </div>
        ))}

      </div>
    </Drawer>
  );
}

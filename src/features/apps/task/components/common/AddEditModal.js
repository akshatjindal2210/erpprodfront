import { useState, useEffect } from "react";
import { X, Check, AlertCircle } from "lucide-react";
import { toast } from "react-toastify";

const okCls  = "w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";
const errCls = "w-full bg-rose-50/30 border border-rose-300 rounded-xl px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-rose-400 focus:ring-2 focus:ring-rose-100";

/**
 * Generic Add/Edit modal — name field always present
 *
 * extraFields prop: array of extra field definitions
 * [
 *   {
 *     key:         "date",           // field key in form state + editItem
 *     label:       "Date",           // label text
 *     type:        "date",           // input type (text, date, number, etc.)
 *     required:    true,             // validate empty?
 *     placeholder: "YYYY-MM-DD",     // optional
 *     transform:   (val) => val.split("T")[0],  // optional: transform editItem value on load
 *   }
 * ]
 *
 * onBuildPayload: optional fn(name, extraValues) => payload object
 * If not provided, defaults to { name, ...extraValues }
 */
export default function AddEditModal({open, onClose, onSuccess, editItem, service, entityLabel, icon: Icon, iconBg, iconBorder, iconText,
  focusColor   = "indigo",  // focus ring color
  buttonColor  = "indigo",  // save button color
  extraFields  = [],        // additional fields after name
  onBuildPayload,           // custom payload builder
}) {
  const isEdit = !!editItem;

  const [name,        setName]        = useState("");
  const [extraValues, setExtraValues] = useState({});
  const [errors,      setErrors]      = useState({});
  const [loading,     setLoading]     = useState(false);

  // ── Reset form on open/editItem change ──────────────────────────────────
  useEffect(() => {
    setName(editItem?.name ?? "");

    // Fill extra fields from editItem
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

  // ── Validate ─────────────────────────────────────────────────────────────
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

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

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
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || "";
      if (
        msg.toLowerCase().includes("duplicate") ||
        msg.toLowerCase().includes("unique")    ||
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

  if (!open) return null;

  const focusCls = `focus:border-${focusColor}-400 focus:ring-2 focus:ring-${focusColor}-100`;
  const nameCls  = errors.name
    ? errCls
    : okCls.replace("focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100", focusCls);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg ${iconBg} border ${iconBorder} flex items-center justify-center`}>
              <Icon size={15} className={iconText} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                {isEdit ? `Edit ${entityLabel}` : `Add ${entityLabel}`}
              </h3>
              <p className="text-xs text-slate-400">
                {isEdit ? `Update ${entityLabel.toLowerCase()} details` : `Create a new ${entityLabel.toLowerCase()}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">

          {/* Name — always present */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Name <span className="text-rose-400">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }}
              onKeyDown={(e) => e.key === "Enter" && extraFields.length === 0 && handleSave()}
              placeholder={`Enter ${entityLabel.toLowerCase()} name`}
              className={nameCls}
              autoFocus
            />
            {errors.name && (
              <p className="flex items-center gap-1 text-xs text-rose-500 mt-1.5">
                <AlertCircle size={11} /> {errors.name}
              </p>
            )}
          </div>

          {/* Extra fields */}
          {extraFields.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                {f.label} {f.required && <span className="text-rose-400">*</span>}
              </label>
              <input
                type={f.type ?? "text"}
                value={extraValues[f.key] ?? ""}
                placeholder={f.placeholder ?? ""}
                onChange={(e) => setExtra(f.key, e.target.value)}
                className={errors[f.key] ? errCls : okCls.replace("focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100", focusCls)}
              />
              {errors[f.key] && (
                <p className="flex items-center gap-1 text-xs text-rose-500 mt-1.5">
                  <AlertCircle size={11} /> {errors[f.key]}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading}
            className={`px-4 py-2 text-sm font-medium text-white bg-${buttonColor}-600 hover:bg-${buttonColor}-700 rounded-xl transition-all flex items-center gap-2 shadow-sm disabled:opacity-60`}>
            {loading ? (
              <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>Saving…</>
            ) : (
              <><Check size={14} /> {isEdit ? "Save Changes" : `Add ${entityLabel}`}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
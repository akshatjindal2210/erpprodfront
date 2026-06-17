export const inputBase =
  "w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 min-h-[42px]";

export const inputError =
  "w-full bg-rose-50/40 border border-rose-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 min-h-[42px]";

export function ClFormSection({ title, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white overflow-hidden ${className}`}>
      <div className="px-3 sm:px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-3 sm:p-4 space-y-3">{children}</div>
    </section>
  );
}

export function ClFormLabel({ children, required }) {
  return (
    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
      {children}
      {required && <span className="text-rose-400 ml-0.5">*</span>}
    </label>
  );
}

export function ClFormError({ msg }) {
  if (!msg) return null;
  return <p className="text-xs text-rose-500 mt-1">{msg}</p>;
}

export function ClFormToggle({ label, description, checked, onChange, compact = false }) {
  if (compact) {
    return (
      <label className="inline-flex items-center gap-2 cursor-pointer" title={description}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded border-slate-300 accent-indigo-600 shrink-0"
        />
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </label>
    );
  }
  return (
    <label className="flex items-start gap-3 cursor-pointer py-0.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 rounded border-slate-300 accent-indigo-600 shrink-0"
      />
      <div className="min-w-0">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {description && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{description}</p>}
      </div>
    </label>
  );
}

export function ClDrawerFooter({ onCancel, onSave, saving, saveLabel = "Save", cancelLabel = "Cancel" }) {
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="flex-1 sm:flex-none px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 disabled:opacity-50"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="flex-1 sm:flex-none min-w-[130px] px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-60 shadow-sm"
      >
        {saving ? "Saving…" : saveLabel}
      </button>
    </>
  );
}

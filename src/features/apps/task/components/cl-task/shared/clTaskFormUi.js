import { AlertCircle, Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
  OK_INPUT,
  ERR_INPUT,
  FORM_LABEL_CLASS,
  FORM_ERROR_CLASS,
  FORM_HINT_CLASS,
  FORM_MICRO_LABEL_CLASS,
  FormLabel,
} from "@/core/components/common/Constants";

/** IMS drawer input density */
export const inputBase = OK_INPUT;
export const inputError = ERR_INPUT;
/** Multi-line: drop fixed h-9, add vertical padding so text isn't flush to the border. */
export const textareaBase = `${OK_INPUT} h-auto min-h-[72px] py-2 resize-y`;
export const textareaError = `${ERR_INPUT} h-auto min-h-[72px] py-2 resize-y`;
export const formHintClass = FORM_HINT_CLASS;
export const formMicroLabelClass = FORM_MICRO_LABEL_CLASS;

export function ClFormSection({ title, children, className = "" }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white overflow-hidden ${className}`}>
      <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-100">
        <h3 className={FORM_MICRO_LABEL_CLASS}>{title}</h3>
      </div>
      <div className="p-3 space-y-3">{children}</div>
    </section>
  );
}

export function ClFormLabel({ children, required, className = FORM_LABEL_CLASS }) {
  return (
    <FormLabel required={required} className={`mb-1.5 block ${className}`}>
      {children}
    </FormLabel>
  );
}

export function ClFormError({ msg }) {
  if (!msg) return null;
  return (
    <p className={`${FORM_ERROR_CLASS} mt-1.5`}>
      <AlertCircle size={12} className="shrink-0" />
      {msg}
    </p>
  );
}

export function ClFormHint({ children }) {
  if (!children) return null;
  return <p className={`${FORM_HINT_CLASS} mt-1`}>{children}</p>;
}

export function ClFormToggle({ label, description, checked, onChange, compact = false }) {
  if (compact) {
    return (
      <label className="inline-flex items-center gap-2 cursor-pointer select-none" title={description}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="rounded border-slate-300 accent-indigo-600 shrink-0"
        />
        <span className="text-xs font-medium text-slate-700">{label}</span>
      </label>
    );
  }
  return (
    <label className="flex items-start gap-3 cursor-pointer py-0.5 select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded border-slate-300 accent-indigo-600 shrink-0"
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

/** Multi-step drawer footer — Create shows only on the last step */
export function ClWizardFooter({
  onCancel,
  onBack,
  onNext,
  onSave,
  saving,
  isFirst,
  isLast,
  canSave = false,
  saveLabel = "Create Task",
  nextLabel = "Continue",
}) {
  const showNext = !isLast;
  const showSave = isLast || canSave;

  return (
    <div className="flex w-full items-center justify-between gap-3">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="px-3 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50"
      >
        Cancel
      </button>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!isFirst && (
          <button
            type="button"
            onClick={onBack}
            disabled={saving}
            className="inline-flex items-center gap-1 px-4 py-2.5 text-sm font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl disabled:opacity-50"
          >
            <ChevronLeft size={16} />
            Back
          </button>
        )}
        {showNext && (
          <button
            type="button"
            onClick={onNext}
            disabled={saving}
            className={`inline-flex items-center gap-1 min-w-[120px] justify-center px-4 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-60 ${
              showSave
                ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm font-bold"
            }`}
          >
            {nextLabel}
            <ChevronRight size={16} />
          </button>
        )}
        {showSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="min-w-[140px] px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl disabled:opacity-60 shadow-sm"
          >
            {saving ? "Saving…" : saveLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/** Full-width progress stepper for CL Task wizard */
export function ClWizardSteps({ steps, current, maxReached = current, onStepClick }) {
  const progress = ((current + 1) / steps.length) * 100;

  return (
    <div className="mb-6 space-y-3">
      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ol className={`grid gap-1.5 ${steps.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
        {steps.map((step, idx) => {
          const active = idx === current;
          const done = idx < current;
          const reached = idx <= maxReached;
          const clickable = typeof onStepClick === "function" && reached;
          return (
            <li key={step.id}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick?.(idx)}
                className={`w-full rounded-lg border px-2 py-2 text-left transition-all ${
                  active
                    ? "border-indigo-300 bg-indigo-50 shadow-sm"
                    : reached
                      ? "border-indigo-100 bg-white hover:border-indigo-200 cursor-pointer"
                      : "border-slate-100 bg-slate-50/80 cursor-default"
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      active
                        ? "bg-indigo-600 text-white"
                        : done
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-white text-slate-400 border border-slate-200"
                    }`}
                  >
                    {done ? <Check size={11} strokeWidth={3} /> : idx + 1}
                  </span>
                  <span
                    className={`truncate text-[11px] font-semibold ${
                      active ? "text-indigo-800" : done ? "text-indigo-600" : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div>
        <h2 className="text-sm font-bold text-slate-800 tracking-tight">
          {steps[current]?.label}
        </h2>
        {steps[current]?.hint ? (
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{steps[current].hint}</p>
        ) : null}
      </div>
    </div>
  );
}

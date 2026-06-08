"use client";

import { useId } from "react";
import { AlertCircle } from "lucide-react";

import { OK_INPUT, ERR_INPUT, FORM_LABEL_CLASS, FORM_ERROR_CLASS, FORM_HINT_CLASS } from "./Constants";

/**
 * Remarks field aligned with SearchableSelect / drawer forms: compact label, rounded-lg control, full width + min-w-0 for small screens.
 */
export default function RemarksTextarea({
  label,
  value,
  onChange,
  placeholder,
  error,
  required,
  disabled,
  rows = 3,
  id: idProp,
  name,
  labelIcon,
  hint,
  className = "",
  /** Matches SearchableSelect label by default */
  labelClassName = FORM_LABEL_CLASS,
}) {
  const autoId = useId();
  const id = idProp ?? `remarks-${autoId}`;
  const inputCls = error ? ERR_INPUT : OK_INPUT;

  return (
    <div className={`min-w-0 w-full space-y-1 ${className}`}>
      <label htmlFor={id} className={`flex flex-wrap items-center gap-1.5 ${labelClassName}`}>
        {labelIcon ? <span className="shrink-0 leading-none">{labelIcon}</span> : null}
        <span className="min-w-0">
          {label}
          {required ? <span className="text-rose-500"> *</span> : null}
        </span>
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`${inputCls} w-full min-w-0 !rounded-lg !px-2.5 sm:!px-3 !py-1.5 !h-auto min-h-[3.75rem] sm:min-h-[4rem] !text-[11px] sm:!text-xs font-normal text-slate-800 placeholder:text-slate-400 border-slate-200 resize-y leading-snug disabled:opacity-60 disabled:cursor-not-allowed`}
      />
      {hint && !error ? <p className={FORM_HINT_CLASS}>{hint}</p> : null}
      {error ? (
        <p className={FORM_ERROR_CLASS}>
          <AlertCircle size={12} className="shrink-0" /> {error}
        </p>
      ) : null}
    </div>
  );
}

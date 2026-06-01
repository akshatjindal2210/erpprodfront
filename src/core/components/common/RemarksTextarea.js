"use client";

import { useId } from "react";
import { AlertCircle } from "lucide-react";

import { OK_INPUT, ERR_INPUT } from "./Constants";

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
  labelClassName = "text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1",
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
        className={`${inputCls} w-full min-w-0 !rounded-lg !px-3 !py-2 min-h-[4.75rem] sm:min-h-[5.25rem] text-[11px] font-medium text-slate-800 placeholder:text-slate-400 border-slate-200 resize-y leading-snug disabled:opacity-60 disabled:cursor-not-allowed`}
      />
      {hint && !error ? <p className="text-[9px] text-slate-400 ml-1">{hint}</p> : null}
      {error ? (
        <p className="text-[9px] text-rose-500 flex items-center gap-1 ml-1">
          <AlertCircle size={10} className="shrink-0" /> {error}
        </p>
      ) : null}
    </div>
  );
}

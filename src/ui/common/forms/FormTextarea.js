"use client";

import { useId } from "react";
import { AlertCircle } from "lucide-react";

import { OK_TEXTAREA, ERR_TEXTAREA, FORM_LABEL_CLASS, FORM_ERROR_CLASS, FORM_HINT_CLASS } from "@/ui/common/Constants";

/**
 * Shared multi-line field — same density as drawer inputs (OK_INPUT), vertical resize enabled.
 * Use for remarks, notes, descriptions, or any textarea in IMS / RM Store forms.
 */
export default function FormTextarea({
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
  inputClassName = "",
  labelClassName = FORM_LABEL_CLASS,
  ...rest
}) {
  const autoId = useId();
  const id = idProp ?? `form-textarea-${autoId}`;
  const inputCls = error ? ERR_TEXTAREA : OK_TEXTAREA;

  return (
    <div className={`min-w-0 w-full space-y-1 ${className}`}>
      {label != null && label !== "" ? (
        <label htmlFor={id} className={labelClassName}>
          {labelIcon ? (
            <span className="inline-flex align-middle mr-1.5 shrink-0 leading-none">{labelIcon}</span>
          ) : null}
          {label}
          {required ? <span className="text-rose-500"> *</span> : null}
        </label>
      ) : null}
      <textarea
        id={id}
        name={name}
        rows={rows}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className={`${inputCls} w-full min-w-0 font-normal disabled:opacity-60 disabled:cursor-not-allowed ${inputClassName}`}
        {...rest}
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

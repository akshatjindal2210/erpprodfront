"use client";

import { ERR_INPUT, OK_INPUT } from "@/ui/common/Constants";
import { formatPassDurationLabel, resolveGatePassOutIn, toTimeInput, todayYmd, validatePassDateYmd } from "@/apps/hrms/lib/gatePassUtils";

/** Match IMS packing drawer labels / inputs */
export const GP_LABEL = "block text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1";
export const GP_FIELD = `${OK_INPUT} text-[11px] h-[38px] rounded-lg`;
export const GP_FIELD_ERR = `${ERR_INPUT} text-[11px] h-[38px] rounded-lg ring-1 ring-rose-300`;
export const GP_ERR_HINT = "text-[9px] text-rose-500 font-bold ml-1";
export const GP_DISABLED = "w-full border border-slate-200 rounded-lg px-2.5 sm:px-3 h-[38px] text-[11px] bg-slate-100 text-slate-500 cursor-not-allowed select-none outline-none";
export const GP_ROW2 = "grid grid-cols-1 md:grid-cols-2 gap-4";

export function empLabel(item) {
  if (!item) return "";
  const code = String(item.emp_code ?? "").trim();
  const name = String(item.emp_name ?? "").trim();
  return code && name ? `${code} — ${name}` : name || code;
}

export function empPickerRow(row) {
  return row ? { ...row, display_label: empLabel(row) } : row;
}

export function empResolved(form) {
  if (!form?.emp_dcode) return null;
  return { ...form, display_label: empLabel(form) };
}

export function toGatePassForm(record) {
  if (!record) {
    return {
      emp_dcode: "",
      emp_code: "",
      emp_name: "",
      deptname: "",
      pass_type: "personal",
      pass_date: todayYmd(),
      out_time: "",
      in_time: "",
      reason: "",
    };
  }
  return {
    emp_dcode: record.emp_dcode != null ? Number(record.emp_dcode) : "",
    emp_code: record.emp_code || "",
    emp_name: record.emp_name || "",
    deptname: record.deptname || "",
    pass_type: record.pass_type || "personal",
    pass_date: record.pass_date || todayYmd(),
    out_time: toTimeInput(record.out_time),
    in_time: toTimeInput(record.in_time),
    reason: record.reason || "",
  };
}

export function validateGatePassForm(form) {
  const next = {};
  if (!Number.isFinite(Number(form.emp_dcode)) || Number(form.emp_dcode) <= 0) {
    next.emp_dcode = "Employee is required";
  }
  if (!String(form.pass_date || "").trim()) next.pass_date = "Date is required";
  else if (!validatePassDateYmd(form.pass_date).ok) next.pass_date = validatePassDateYmd(form.pass_date).message;
  if (!form.out_time) next.out_time = "Out time is required";
  if (!form.in_time) next.in_time = "In time is required";
  if (!next.pass_date && !next.out_time && !next.in_time) {
    const r = resolveGatePassOutIn(form.pass_date, form.out_time, form.in_time);
    if (!r.ok) {
      const msg = r.message || "Invalid time";
      if (/pass date|day ahead/i.test(msg)) next.pass_date = msg;
      else {
        next.out_time = msg;
        if (/in time/i.test(msg)) next.in_time = msg;
      }
    }
  }
  if (!String(form.reason || "").trim()) next.reason = "Reason is required";
  return next;
}

export function gatePassPayload(form) {
  const r = resolveGatePassOutIn(form.pass_date, form.out_time, form.in_time);
  if (!r.ok) throw new Error(r.message || "Invalid date or time.");
  return {
    emp_dcode: Number(form.emp_dcode),
    pass_type: form.pass_type,
    pass_date: form.pass_date,
    out_time: r.outIso,
    in_time: r.inIso,
    reason: form.reason,
  };
}

export function durationLabel(form) {
  return formatPassDurationLabel(form.pass_date, form.out_time, form.in_time);
}

export function ReadonlyField({ label, value, tabular }) {
  return (
    <div className="min-w-0 space-y-1">
      <span className={GP_LABEL}>{label}</span>
      <input readOnly disabled tabIndex={-1} className={`${GP_DISABLED}${tabular ? " tabular-nums" : ""}`} value={value ?? ""} />
    </div>
  );
}

export function TextInput({ label, required, error, className = "", ...props }) {
  return (
    <div className="space-y-1">
      <label className={GP_LABEL}>
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </label>
      <input className={`${error ? GP_FIELD_ERR : GP_FIELD} ${className}`} aria-invalid={error ? "true" : undefined} {...props} />
      {error ? <p className={GP_ERR_HINT}>{error}</p> : null}
    </div>
  );
}

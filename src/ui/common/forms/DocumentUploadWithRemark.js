"use client";

/**
 * Per-file `documents.remark` input.
 * Only Invoice Receiving should render this; other modules keep remark in DB but no attachment remark UI.
 */
export function FileRemarkInput({
  value = "",
  onChange,
  disabled = false,
  placeholder = "Remark (optional)",
  className = "w-full h-8 px-2 text-[10px] border border-slate-200 rounded-md bg-white text-slate-700 placeholder:text-slate-400",
}) {
  if (disabled) {
    const s = String(value ?? "").trim();
    if (!s) return null;
    return (
      <p className="text-[10px] text-slate-500 truncate px-0.5" title={s}>
        {s}
      </p>
    );
  }
  return (
    <input
      type="text"
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}

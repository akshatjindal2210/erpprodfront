"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { LIST_PAGE_ACTION_CLASS } from "@/core/components/common/ListPageToolbar";
import { listTableExportFormats } from "@/core/utils/tableExport";

const BUTTON_VARIANTS = {
  default:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  accent:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  solid:
    "!rounded-lg border border-blue-600 bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:border-blue-700",
};

const GROUPED_BTN_CLASS =
  "h-full min-h-0 px-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50 rounded-none shrink-0 bg-white border-0";

export default function ExportMenu({
  disabled = false,
  exporting = false,
  onExport,
  label = "Export",
  className = "",
  variant = "default",
  grouped = false,
  showLabel = "auto",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const formats = listTableExportFormats();
  const buttonVariantClass = BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.default;
  const isSolid = variant === "solid";
  const labelVisible = showLabel === true || showLabel === "always";
  const labelClass = labelVisible
    ? "inline normal-case tracking-normal"
    : "hidden lg:inline normal-case tracking-normal";
  const iconTone = isSolid ? "text-white/90" : "text-slate-500";
  const chevronTone = isSolid ? "text-white/80" : "text-slate-400";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const handlePick = (format) => {
    setOpen(false);
    void onExport?.(format);
  };

  const buttonClass = grouped
    ? `${GROUPED_BTN_CLASS} ${open ? "bg-slate-50 text-slate-800" : ""}`
    : `${LIST_PAGE_ACTION_CLASS} h-9 min-w-[96px] px-3 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors ${buttonVariantClass}`;

  return (
    <div className={`relative shrink-0 self-stretch flex ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || exporting}
        aria-expanded={open}
        aria-haspopup="menu"
        className={buttonClass}
        title="Export table"
      >
        {exporting ? (
          <Loader2 size={15} className={`shrink-0 animate-spin ${iconTone}`} aria-hidden />
        ) : (
          <Download size={15} className={`shrink-0 ${iconTone}`} aria-hidden />
        )}
        <span className={labelClass}>{label}</span>
        <ChevronDown
          size={13}
          className={`shrink-0 ${chevronTone} transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-[120] mt-1 min-w-[128px] rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {formats.map((fmt) => (
            <button
              key={fmt.id}
              type="button"
              role="menuitem"
              onClick={() => handlePick(fmt.id)}
              className="flex w-full items-center px-3 py-2 text-left text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              {fmt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

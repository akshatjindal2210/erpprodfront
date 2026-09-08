"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LIST_PAGE_FILTER_VALUE_CLASS, listPageFilterBoxClass, listPageFilterLabelClass } from "@/ui/common/list/ListPageSearchField";

function summarizeSelection(value, options, allLabel) {
  const included = options.filter((opt) => value?.[opt.value] !== false);
  if (!included.length) return "None selected";
  if (included.length === options.length) return allLabel;
  if (included.length === 1) return included[0].label;
  return `${included.length} zones`;
}

export default function CheckboxDropdownFilter({ label, options = [], value, allLabel = "All zones", variant = "quick", disabled = false, stacked = false, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const allRef = useRef(null);
  const groupValue = value && typeof value === "object" ? value : {};
  const allLabelText = allLabel || "All zones";
  const allChecked = options.length > 0 && options.every((opt) => groupValue[opt.value] !== false);
  const noneChecked = options.length > 0 && options.every((opt) => groupValue[opt.value] === false);
  const summary = summarizeSelection(groupValue, options, allLabelText);
  const boxVariant = variant === "server" ? "server" : "quick";

  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = !allChecked && !noneChecked;
  }, [allChecked, noneChecked]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [open]);

  const setAll = (checked) => {
    onChange?.(Object.fromEntries(options.map((opt) => [opt.value, checked])));
  };

  const setOne = (zoneId, checked) => {
    onChange?.({ ...groupValue, [zoneId]: checked });
  };

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <label className={`${listPageFilterLabelClass(boxVariant)} ${stacked ? "" : "max-md:hidden"}`}>
        {label}
      </label>
      <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)}
        className={`${[listPageFilterBoxClass(boxVariant), LIST_PAGE_FILTER_VALUE_CLASS, "flex h-8 md:h-9 w-full min-w-0 items-center justify-between gap-2 px-2 md:px-3 text-left outline-none"].join(" ")}${disabled ? " opacity-50 cursor-not-allowed" : " cursor-pointer"}`}
        aria-haspopup="listbox" aria-expanded={open}
      >
        <span className={`truncate text-[11px] font-bold uppercase tracking-wide ${allChecked ? "text-slate-600" : "text-indigo-800"}`} >
          {summary}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div
          className="absolute left-0 top-full z-[100] mt-1 min-w-full w-max max-w-[14rem] border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox" onPointerDown={(e) => e.stopPropagation()}
        >
          <label className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-50">
            <input ref={allRef} type="checkbox" checked={allChecked} onChange={(e) => setAll(e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-indigo-600" />
            <span>{allLabelText}</span>
          </label>
          {options.map((opt) => (
            <label
              key={String(opt.value)}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-700 hover:bg-indigo-50"
            >
              <input type="checkbox" checked={groupValue[opt.value] !== false} onChange={(e) => setOne(opt.value, e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-indigo-600" />
              <span className="whitespace-nowrap">{opt.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

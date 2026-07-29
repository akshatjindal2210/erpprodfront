"use client";

import { ShieldAlert } from "lucide-react";
import { isBoxOnQcHold } from "@/apps/ims/lib/utils/boxInventory";

export function finderBoxOnQcHold(box) {
  return isBoxOnQcHold(box);
}

export function finderQcHoldId(box) {
  const id = box?.qc_hold_id;
  return id != null && String(id).trim() !== "" ? String(id).trim() : null;
}

export function getFinderBoxCardShellClass(box) {
  if (finderBoxOnQcHold(box)) {
    return "bg-amber-50 border-amber-400 ring-2 ring-amber-200/80 shadow-sm shadow-amber-100/50";
  }
  return "bg-indigo-50 border-indigo-100";
}

export function getFinderBoxIconShellClass(box) {
  if (finderBoxOnQcHold(box)) {
    return "bg-amber-500 text-white";
  }
  return "bg-indigo-600 text-white";
}

export function getFinderBoxLabelClass(box) {
  if (finderBoxOnQcHold(box)) {
    return "text-amber-700";
  }
  return "text-indigo-600";
}

export function getFinderBoxTitleClass(box) {
  if (finderBoxOnQcHold(box)) {
    return "text-amber-950";
  }
  return "text-indigo-950";
}

export function getFinderBoxMetaClass(box) {
  if (finderBoxOnQcHold(box)) {
    return "text-amber-900/90";
  }
  return "text-indigo-900/90";
}

export function FinderQcHoldBanner({ box }) {
  if (!finderBoxOnQcHold(box)) return null;
  const holdId = finderQcHoldId(box);
  return (
    <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-100 px-2.5 py-1.5">
      <ShieldAlert size={14} className="text-amber-700 shrink-0" strokeWidth={2.25} />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wide leading-none">QC Hold</p>
        <p className="text-[10px] text-amber-800 mt-0.5 leading-snug">
          This box is on QC hold{holdId ? ` · Hold #${holdId}` : ""}
        </p>
      </div>
    </div>
  );
}

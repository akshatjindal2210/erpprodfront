"use client";

import Link from "next/link";
import { Layers } from "lucide-react";
import { IMS_TABLE_CELL_TEXT } from "@/ui/common/list/listPageShellClasses";
import { resolveActivityLogRef, resolveActivityLogEntityHref, formatActivityLogModuleLabel } from "@/platform/utils/core/activityLogDisplay";

function cleanRef(value) {
  const id = String(value ?? "").trim();
  if (!id || id === "—" || id === "N/A") return null;
  return id;
}

function RefLine({ ref, href }) {
  if (!ref) return null;
  if (href) {
    return (
      <Link
        href={href}
        className="text-[9px] text-indigo-600 hover:text-indigo-800 font-mono ml-3 underline underline-offset-2 w-fit"
      >
        REF: {ref}
      </Link>
    );
  }
  return <span className="text-[9px] text-indigo-500 font-mono ml-3">REF: {ref}</span>;
}

export default function ActivityLogModuleEntityCell({ row, appType, moduleKey, moduleLabel, refValue }) {
  const module = moduleKey ?? row?.module ?? row?.entity;
  const label = moduleLabel ?? formatActivityLogModuleLabel(module);
  const ref = cleanRef(refValue ?? resolveActivityLogRef(row));
  const href = resolveActivityLogEntityHref(appType, module);

  return (
    <div className="flex flex-col leading-tight min-w-[140px]">
      <div className="flex items-center gap-1">
        <Layers size={10} className="text-slate-500 shrink-0" />
        <span className={`capitalize ${IMS_TABLE_CELL_TEXT}`}>{label}</span>
      </div>
      <RefLine ref={ref} href={href} />
    </div>
  );
}

export function TransactionLogModuleEntityCell({ row, appType = "rmstore" }) {
  const module = row?.source_module;
  const label = module?.replace(/_/g, " ") ?? "—";
  const ref = cleanRef(row?.source_id);
  const href = resolveActivityLogEntityHref(appType, module);

  return (
    <div className="flex flex-col leading-tight min-w-[140px]">
      <div className="flex items-center gap-1">
        <Layers size={10} className="text-slate-500 shrink-0" />
        <span className={`capitalize ${IMS_TABLE_CELL_TEXT}`}>{label}</span>
      </div>
      <RefLine ref={ref} href={href} />
      {row?.mrn_no ? (
        <span className="text-[9px] text-slate-400 font-mono ml-3">MRN: {row.mrn_no}</span>
      ) : null}
    </div>
  );
}

"use client";

import { ClipboardPen } from "lucide-react";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";

const MODULE = "production_entry";

/** Placeholder — Production Entry UI comes later. */
export default function ProductionEntryPage() {
  const canAccess = useCanAccess();
  const canView = canAccess(MODULE, "view").allowed;

  if (!canView) {
    return <div className="p-8 text-sm text-slate-500">You do not have permission to view Production Entry.</div>;
  }

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-3 rounded-none border border-slate-300 bg-white p-8 shadow-sm">
        <ClipboardPen size={28} className="text-slate-400" />
        <h1 className="text-sm font-bold uppercase tracking-wide text-slate-800">Production Entry</h1>
      </div>
    </div>
  );
}

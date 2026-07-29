"use client";

import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import InProcessRequestPanel from "@/apps/rmstore/modules/in-process-request/InProcessRequestPanel";

export default function InProcessRequestPage() {
  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <InProcessRequestPanel />
      </div>
    </div>
  );
}

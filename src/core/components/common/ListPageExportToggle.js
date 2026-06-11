"use client";

import ViewToggle from "@/core/components/ui/ViewToggle";
import ExportMenu from "@/core/components/common/ExportMenu";

/** List/table toggle + export (laptop only) — top-right toolbar slot. */
export default function ListPageExportToggle({
  viewMode,
  setMode,
  exporting = false,
  disabled = false,
  onExport,
  viewToggleClassName = "h-9",
}) {
  return (
    <div className="flex items-center shrink-0">
      <div className="hidden lg:flex items-stretch h-9 border border-slate-300 bg-white rounded-none overflow-visible relative z-[80] shadow-none">
        <ExportMenu
          grouped
          disabled={disabled}
          exporting={exporting}
          onExport={onExport}
        />
        <div className="w-px bg-slate-300 shrink-0 self-stretch" aria-hidden />
        <ViewToggle embedded mode={viewMode} setMode={setMode} />
      </div>
      <div className="lg:hidden">
        <ViewToggle mode={viewMode} setMode={setMode} className={viewToggleClassName} />
      </div>
    </div>
  );
}

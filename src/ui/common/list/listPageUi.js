"use client";

import { RefreshCcw, Loader2 } from "lucide-react";
import { LIST_PAGE_SHELL, LIST_PAGE_TABLE_AREA_CLASS } from "@/ui/common/list/listPageShellClasses";

export {
  default as AppListFooter,
  ListPageSelectionStrip,
  ListPageFooterScopeDivider,
  ListPageFooterActionStack,
  ListPageFooterBar,
  ListPageFooterContextStrip,
  FOOTER_TEXT_CLASS,
  formatAppListFooterCountText,
  splitAppListFooterCountParts,
  appListFooterFromClientFilter,
} from "@/ui/common/list/listPageFooter";

export function ListPageShell({ children }) {
  return (
    <div className={LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        {children}
      </div>
    </div>
  );
}

export function ListPageTableArea({ children }) {
  return <div className={LIST_PAGE_TABLE_AREA_CLASS}>{children}</div>;
}

export { LIST_PAGE_TABLE_AREA_CLASS };

export function ListPageRefreshButton({ loading, onClick, iconOnly = true }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none shrink-0 disabled:opacity-70"
    >
      {loading ? <Loader2 size={14} className="animate-spin text-indigo-600" /> : <RefreshCcw size={14} />}
      {!iconOnly ? <span>Refresh</span> : null}
    </button>
  );
}

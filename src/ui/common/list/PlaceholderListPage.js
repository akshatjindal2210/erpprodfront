"use client";

import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import DataTable from "@/ui/primitives/DataTable";
import { LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";

export default function PlaceholderListPage({
  title,
  emptyIcon,
  emptyMessage,
  emptySubMessage,
  headers,
}) {
  const [viewMode, handleViewMode] = useViewMode();

  return (
    <div className={LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={<span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{title}</span>}
            viewToggle={<ListPageExportToggle viewMode={viewMode} setMode={handleViewMode} disabled />}
          />
        </ListPageToolbar>
        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={headers}
            data={[]}
            loading={false}
            viewMode={viewMode}
            emptyIcon={emptyIcon}
            emptyMessage={emptyMessage}
            emptySubMessage={emptySubMessage}
            sortKey=""
            sortDir="asc"
            getRowId={(row, i) => row?.id ?? i}
          />
        </div>
      </div>
    </div>
  );
}

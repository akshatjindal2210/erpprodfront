"use client";

import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import {
  ListPageRefreshButton,
  ListPageSelectionBanner,
} from "@/ui/common/list/listPageUi";

/** Toolbar row: custom actions + refresh + optional export toggle + selection banner. */
export function ListPageToolbarBlock({
  actions,
  loading,
  onRefresh,
  viewToggle,
  selected,
  selectedRecord,
  selectionLabel,
  onClearSelection,
}) {
  const hasActions = actions != null && actions !== false;

  return (
    <ListPageToolbar>
      <ListPageToolbarLayout
        actions={
          <>
            {hasActions ? actions : null}
            {hasActions ? <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" /> : null}
            <ListPageRefreshButton loading={loading} onClick={onRefresh} />
          </>
        }
        viewToggle={viewToggle}
      />
      {selected && selectedRecord && selectionLabel ? (
        <ListPageSelectionBanner onClear={onClearSelection}>
          {selectionLabel(selectedRecord)}
        </ListPageSelectionBanner>
      ) : null}
    </ListPageToolbar>
  );
}

export function ListPageExportViewToggle({ viewMode, setMode, exporting, disabled, onExport }) {
  return (
    <ListPageExportToggle
      viewMode={viewMode}
      setMode={setMode}
      exporting={exporting}
      disabled={disabled}
      onExport={onExport}
    />
  );
}

/** Detail modal field grid — reuse for view / read-only forms. */
export function ListPageDetailGrid({ record, fields }) {
  if (!record || !fields?.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {fields.map(([label, key]) => (
        <div key={key} className="border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">{label}</p>
          <p className="text-sm text-slate-800 break-all">{record[key] ?? "—"}</p>
        </div>
      ))}
    </div>
  );
}

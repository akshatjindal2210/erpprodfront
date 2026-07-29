"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, FileText, RefreshCcw, Edit3, Trash2, CheckCircle, X, Eye, Copy } from "lucide-react";
import { toast } from "react-toastify";

import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { specService } from "@/apps/rmstore/lib/services/spec";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import ActionButton from "@/ui/primitives/ActionButton";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import DataTable from "@/ui/primitives/DataTable";
import SpecModal from "./SpecModal";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";

const MODULE = "rm_spec_master";

export default function RmSpecMasterPage() {
  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [params, setParams] = useState({
    pageSize: 1000,
    status: "all",
    sortKey: "created_at",
    sortDir: "desc",
  });
  const [tempSearch, setTempSearch] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const fetchSpecs = useCallback(async () => {
    setLoading(true);
    try {
      const base = {
        sortBy: params.sortKey || "item_code",
        order: params.sortDir.toUpperCase(),
        filters: {
          ...(params.status !== "all" && { approval_status: params.status }),
        },
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await specService.getAll({ ...base, page, limit });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Could not load the RM specifications. Please try again.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.status]);

  useEffect(() => {
    fetchSpecs();
  }, [fetchSpecs]);

  const filteredRows = useMemo(() => {
    let data = allRows;
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(allRows, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;
  const selectedRecord = useMemo(
    () => filteredRows.find((u) => u.item_dcode === selected),
    [filteredRows, selected]
  );

  const openModal = useCallback((mode, row = null) => {
    setEditItem(row);
    setModalMode(mode);
    setModalOpen(true);
  }, []);

  const { openNewModal, openEditModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: modalOpen || !!deleteItem,
    selectedId: selected,
    getSelectedRow: useCallback(
      () => filteredRows.find((u) => u.item_dcode === selected),
      [filteredRows, selected]
    ),
    openAdd: useCallback(() => openModal("add"), [openModal]),
    openEdit: useCallback((row) => openModal("edit", row), [openModal]),
    openApprove: useCallback((row) => openModal("approve", row), [openModal]),
    canApproveSelection: useCallback(() => Boolean(selected && selectedRecord), [selected, selectedRecord]),
    onApproveBlocked: useCallback(() => toast.info("Select a row to approve (Ctrl+A)."), []),
    openDelete: useCallback((row) => setDeleteItem(row), []),
    canDeleteSelection: useCallback(() => !!selected, [selected]),
  });

  const HEADERS = useMemo(
    () => [
      ["Item Code", "item_code", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "—"}</span>, { fixed: true, width: "140px" }],
      ["Description", "item_desc", (v) => <span className="text-[11px] text-slate-600 truncate block">{v || "—"}</span>, { width: "220px" }],
      ["Condition", "condition", (v) => <span className="text-[11px] text-slate-700 truncate block">{v || "—"}</span>, { width: "120px" }],
      ["Grade", "grade", (v) => <span className="text-[11px] text-slate-700 truncate block">{v || "—"}</span>, { width: "120px" }],
      ["Size", "size", (v) => <span className="text-[11px] text-slate-700 truncate block">{v || "—"}</span>, { width: "100px" }],
      ["Spec Count", "spec_count", (v) => (
          <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded bg-indigo-50 text-indigo-700 text-[10px] font-black">
            {v ?? 0}
          </span>
        ), { width: "120px" }],
      ["Spec Name", "spec_names", (v) => <span className="text-[10px] text-slate-500 truncate block">{v || "—"}</span>, { width: "220px" }],
      ["Approval Status", "approval_status", (v) => {
        const status = v || "pending";
        const styles =
          status === "authorized"
            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
            : status === "partial"
              ? "bg-sky-50 text-sky-700 border-sky-100"
              : "bg-amber-50 text-amber-600 border-amber-100";
        const label =
          status === "authorized"
            ? "AUTHORIZED"
            : status === "partial"
              ? "PARTIALLY AUTHORIZED"
              : "PENDING";
        return (
          <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${styles}`}>
            {label}
          </span>
        );
      }, { width: "140px" }],
      ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Created At", "created_at", (v) => (
          <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>
        ),
        { width: "150px" },
      ],
      ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Updated At", "updated_at", (v) => (
          <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>
        ),
        { width: "150px" },
      ],
      ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
      ["Approved At", "approved_at", (v) => (
          <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>
        ),
        { width: "150px" },
      ],
    ],
    []
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "RM Spec Master",
    rows: filteredRows,
    headers: HEADERS,
  });

  const extraFilters = useMemo(
    () => [{
      label: "Status",
      key: "approvedStatus",
      value: params.status,
      options: [
        { label: "All Status", value: "all" },
        { label: "Authorized", value: "authorized" },
        { label: "Pending", value: "pending" },
      ],
    }],
    [params.status]
  );

  return (
    <div className={LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
                <ActionButton module={MODULE} action="add" label="New" icon={Plus} onClick={openNewModal} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0" />
                <ActionButton module={MODULE} action="add" variant="outline" label="Clone" icon={Copy} disabled={!selected} onClick={() => openModal("clone", selectedRecord)} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0" />
                <ActionButton module={MODULE} action="view" variant="outline" label="View" icon={Eye} disabled={!selected} onClick={() => openModal("view", selectedRecord)} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0" />
                <ActionButton module={MODULE} action="edit" variant="outline" label="Edit" icon={Edit3} disabled={!selected} record={selectedRecord} onClick={openEditModal} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0" />
                <ActionButton module={MODULE} action="authorize" variant="outline" label="Approve" icon={CheckCircle} disabled={!selected} onClick={() => openModal("approve", selectedRecord)} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none shrink-0" />
                <ActionButton module={MODULE} action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selected} onClick={() => setDeleteItem(selectedRecord)} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0" />
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />
                <button onClick={() => fetchSpecs()} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase shadow-none shrink-0">
                  <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                </button>
              </>
            }
            viewToggle={
              <ListPageExportToggle viewMode={viewMode} setMode={handleViewMode} exporting={exporting} disabled={loading || exportDisabled} onExport={handleExport} />
            }
          />
          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">
                Selected: {selectedRecord?.item_code} · {selectedRecord?.spec_count ?? 0} line(s)
              </span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            showDate={false}
            extraFilters={extraFilters}
            onApply={(data) => setParams((p) => ({ ...p, status: data.approvedStatus || p.status }))}
            onReset={() => {
              setTempSearch("");
              setParams({ pageSize: 1000, status: "all", sortKey: "item_code", sortDir: "asc" });
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search by item or specification name"
            searchLabel="Search Spec"
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS}
            data={items}
            loading={loading}
            viewMode={viewMode}
            allowCopy
            {...tableHotkeyProps}
            showSelection
            skeletonCount={params.pageSize}
            emptyIcon={FileText}
            sortKey={params.sortKey ?? ""}
            sortDir={params.sortDir}
            onSort={(key) => {
              setDisplayLimit(100);
              setParams((p) => ({
                ...p,
                sortKey: key,
                sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
              }));
            }}
            selectedId={selected}
            onSelect={setSelected}
            getRowId={(item) => item.item_dcode}
            onLoadMore={() => { if (!loading && items.length < totalItems) setDisplayLimit((n) => n + 100); }}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={{ titleKey: "item_code", badgeIndices: [7], detailIndices: [1, 2, 3], footerKey: "created_at" }}
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Items
          </span>
        </div>
      </div>

      {modalOpen && (
        <SpecModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => { fetchSpecs(); setSelected(null); }}
          editData={editItem}
          mode={modalMode}
        />
      )}
      {deleteItem && (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={() => { fetchSpecs(); setSelected(null); }}
          service={specService}
          entityLabel="RM Spec"
          idKey="item_dcode"
          titleKey="item_code"
          moduleSlug={MODULE}
          warningMessage="This will delete every specification line for this RM item."
        />
      )}
    </div>
  );
}

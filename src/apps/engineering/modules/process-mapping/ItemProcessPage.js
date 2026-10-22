"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Factory, RefreshCcw, Edit3, Trash2, Eye, CheckCircle } from "lucide-react";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { toast } from "react-toastify";

import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import ActionButton from "@/ui/primitives/ActionButton";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import AppListFooter from "@/ui/common/list/listPageFooter";
import { auditHeaders } from "@/platform/utils/list/auditListUi";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import DataTable from "@/ui/primitives/DataTable";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";

const DEFAULT_PARAMS = { pageSize: 1000, sortKey: "id", sortDir: "desc" };

/** "S1: FG 0, FG 1  →  S2: TP 5" */
const stageSummary = (plan) =>
  (plan?.stages || [])
    .map((st) => `S${st.stage_no}: ${(st.processes || []).map((p) => p.process_name).join(", ")}`)
    .join("  →  ");

/**
 * Prime / Finish Process Master list — eng_item_process rows of one type (`type` = "prime" | "fg").
 * Rows: { id, type, item_dcode, item_code, item_desc, prime_item_code, process, prime_process, fg_process, audit }.
 */
export default function ItemProcessPage({ type, module: MODULE, service, title, Modal }) {
  const isFg = type === "fg";
  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [tempSearch, setTempSearch] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await service.getAll({ page, limit });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(
        (data ?? []).map((row) => ({
          ...row,
          process_summary: stageSummary(isFg ? row.fg_process : row.prime_process),
          prime_summary: isFg ? stageSummary(row.prime_process) : "",
        }))
      );
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || `Could not load ${title}. Please try again.`);
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [service, isFg, title, params.pageSize]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);
  useEffect(() => {
    setDisplayLimit(100);
  }, [tempSearch]);

  const filteredRows = useMemo(() => {
    let data = allRows;
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(allRows, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;
  const selectedRecord = useMemo(() => filteredRows.find((r) => r.id === selected), [filteredRows, selected]);
  const getSelectedRow = useCallback(() => filteredRows.find((r) => r.id === selected), [filteredRows, selected]);

  const openModal = useCallback((mode, row = null) => {
    setEditItem(row);
    setModalMode(mode);
    setModalOpen(true);
  }, []);

  const openApproveDrawer = useCallback(
    (row) => {
      if (row?.is_approved) return toast.info("Already approved. Edit before approving again.");
      if (row) openModal("approve", row);
    },
    [openModal]
  );

  const { openNewModal, openEditModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: modalOpen || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => openModal("add"), [openModal]),
    openEdit: useCallback((row) => openModal("edit", row), [openModal]),
    openApprove: openApproveDrawer,
    canApproveSelection: useCallback(() => Boolean(selected && selectedRecord && !selectedRecord.is_approved), [selected, selectedRecord]),
    onApproveBlocked: useCallback(() => {
      if (selectedRecord?.is_approved) toast.info("Already approved. Edit before approving again.");
      else toast.info("Select a pending row to open approve (Ctrl+A).");
    }, [selectedRecord]),
    openDelete: useCallback((row) => setDeleteItem(row), []),
    canDeleteSelection: useCallback(() => !!selected, [selected]),
  });

  const HEADERS = useMemo(() => {
    const code = (cls) => (v) => <span className={`font-bold uppercase text-[11px] tracking-tight ${cls}`}>{v || "—"}</span>;
    const text = (v) => (
      <span className="text-[10px] text-slate-700 block leading-tight" title={v || ""}>
        {v || "—"}
      </span>
    );
    return [
      ["ID", "id", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { fixed: true, width: "70px" }],
      [isFg ? "Finish Item" : "Prime Item", "item_code", code("text-slate-800"), { width: "140px" }],
      ["Item Description", "item_desc", (v) => (
        <span className="text-[10px] text-slate-500 truncate block italic" title={v || ""}>{v || "—"}</span>
      ), { width: "220px" }],
      ...(isFg ? [["Prime Item", "prime_item_code", code("text-indigo-700"), { width: "140px" }]] : []),
      [isFg ? "Finish Process" : "Prime Process", "process_summary", text, { width: "420px" }],
      ...(isFg ? [["Prime Process", "prime_summary", text, { width: "320px" }]] : []),
      [
        "Status",
        "is_approved",
        (v) => (
          <span
            className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}
          >
            {v ? "● Approved" : "○ Pending"}
          </span>
        ),
        { width: "110px", copyValue: (row) => (row.is_approved ? "Approved" : "Pending") },
      ],
      ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
      ...auditHeaders(["created", "updated"]),
    ];
  }, [isFg]);

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: title,
    rows: filteredRows,
    headers: HEADERS,
  });

  const btn = "rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0";

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
                <ActionButton module={MODULE} action="add" label="New" icon={Plus} onClick={openNewModal} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0" />
                <ActionButton module={MODULE} action="view" variant="outline" label="View" icon={Eye} disabled={!selected} record={selectedRecord}
                  onClick={() => selectedRecord && openModal("view", selectedRecord)} className={btn} />
                <ActionButton module={MODULE} action="edit" variant="outline" label="Edit" icon={Edit3} disabled={!selected} record={selectedRecord} onClick={openEditModal} className={btn} />
                <ActionButton
                  module={MODULE}
                  action="authorize"
                  variant="outline"
                  label="Approve"
                  icon={CheckCircle}
                  disabled={!selected || selectedRecord?.is_approved}
                  record={selectedRecord}
                  onClick={() => openApproveDrawer(selectedRecord)}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none shrink-0"
                />
                <ActionButton module={MODULE} action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selected} onClick={() => setDeleteItem(selectedRecord)}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0" />
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />
                <button
                  onClick={() => fetchRows()}
                  className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase shadow-none shrink-0"
                >
                  <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                </button>
              </>
            }
            viewToggle={
              <ListPageExportToggle viewMode={viewMode} setMode={handleViewMode} exporting={exporting} disabled={loading || exportDisabled} onExport={handleExport} />
            }
          />
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            showDate={false}
            showSearchButton={false}
            applyOnSearchEnter={false}
            onReset={() => {
              setTempSearch("");
              setParams(DEFAULT_PARAMS);
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder={isFg ? "Search finish item, prime item or process" : "Search prime item or process"}
            searchLabel={`Search ${title}`}
            searchVariant="quick"
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 h-0 relative bg-white flex flex-col overflow-hidden isolate z-0">
          <DataTable
            headers={HEADERS}
            data={items}
            loading={loading}
            viewMode={viewMode}
            allowCopy={true}
            {...tableHotkeyProps}
            showSelection={true}
            emptyIcon={Factory}
            sortKey={params.sortKey ?? ""}
            sortDir={params.sortDir}
            onSort={(key) => {
              setDisplayLimit(100);
              setParams((p) => ({ ...p, sortKey: key, sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc" }));
            }}
            selectedId={selected}
            onSelect={setSelected}
            getRowId={(item) => item.id}
            getRowClassName={(row) => (row.is_approved ? "" : "[&_td]:bg-amber-50/60")}
            onLoadMore={() => {
              if (!loading && items.length < totalItems) setDisplayLimit((n) => n + 100);
            }}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={{
              titleKey: "item_code",
              detailKeys: isFg ? ["item_desc", "prime_item_code", "process_summary"] : ["item_desc", "process_summary"],
              footerKey: "created_at",
            }}
          />
        </div>

        <AppListFooter
          shown={items.length}
          total={totalItems}
          noun={title}
          selected={selected}
          selectedRecord={selectedRecord}
          selectionLabel={(row) => row?.item_code || "—"}
          onClearSelection={() => setSelected(null)}
        />
      </div>

      {modalOpen && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            fetchRows();
            setSelected(null);
          }}
          editData={editItem}
          mode={modalMode}
        />
      )}
      {deleteItem && (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={() => {
            fetchRows();
            setSelected(null);
          }}
          service={service}
          entityLabel={title}
          idKey="id"
          titleKey="item_code"
          moduleSlug={MODULE}
        />
      )}
    </div>
  );
}

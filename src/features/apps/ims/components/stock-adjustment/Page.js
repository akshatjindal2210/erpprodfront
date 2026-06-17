"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Trash2, CheckCircle, X, Printer, Eye, Edit3 } from "lucide-react";
import { toast } from "react-toastify";
import dayjs from "dayjs";
import { useViewDateFilterDefaults } from "@/features/apps/ims/helpers/dateFilterDefaults";

import { stockAdjustmentService } from "@/features/apps/ims/services/stockAdjustment";
import { useViewMode } from "@/core/hooks/useViewMode";
import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";

// Components
import StockAdjustmentModal from "@/features/apps/ims/components/stock-adjustment/StockAdjustmentModal";
import StockAdjustmentStickerCloneDrawer from "@/features/apps/ims/components/stock-adjustment/StockAdjustmentStickerCloneDrawer";
import StockAdjustmentPrintStickersDrawer from "@/features/apps/ims/components/stock-adjustment/StockAdjustmentPrintStickersDrawer";
import { plainRemarksForDisplay } from "@/features/apps/ims/components/stock-adjustment/StockAdjustmentModal";
import DeleteModal from "@/core/components/common/DeleteModal";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import DataTable from "@/core/components/ui/DataTable";
import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import ActionButton from "@/core/components/ui/ActionButton";
import PrintActionButton from "@/core/components/ui/PrintActionButton";

import { useCanAccess } from "@/core/hooks/useCanAccess";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/features/apps/ims/helpers/clientListSearch";
import { formatDateTime } from "@/core/utils/utilHelper";

function stockAdjustmentCustomerCell(v, row) {
  const lines =
    row.entry_type === "minus" && Array.isArray(row.minus_customer_lines)
      ? row.minus_customer_lines
      : null;

  if (lines && lines.length > 1) {
    const title = lines
      .map((l) => {
        const name = l.acc_name || l.acc_code || "—";
        const q = Number(l.qty || 0);
        return q > 0 ? `${name} (−${q.toLocaleString()} PCS)` : name;
      })
      .join(", ");
    const label = lines
      .map((l) => l.acc_name || l.acc_code || "—")
      .join(", ");
    return (
      <span
        className="text-[10px] text-slate-700 font-bold uppercase block max-w-[140px] sm:max-w-[220px] leading-snug whitespace-normal break-words"
        title={title}
      >
        {label}
      </span>
    );
  }

  const label =
    (lines?.length === 1 ? lines[0].acc_name || lines[0].acc_code : null) ||
    (typeof v === "string" ? v.replace(/\s*·\s*/g, ", ") : v) ||
    (typeof row.acc_name === "string" ? row.acc_name.replace(/\s*·\s*/g, ", ") : row.acc_name) ||
    "—";

  return (
    <span
      className="text-[10px] text-slate-700 font-bold uppercase truncate block max-w-[140px] sm:max-w-[220px]"
      title={String(label)}
    >
      {label}
    </span>
  );
}

export default function StockAdjustmentPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("stock_adjustment", "view"), [canAccess]);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 1000,
    status: "all",
    fromDate: dateFilterDefaults.from, toDate: dateFilterDefaults.to, sortKey: "adjustment_id", sortDir: "desc"
  });

  useEffect(() => {
    if (dateFilterDefaults.from || dateFilterDefaults.to) {
      setParams(prev => ({
        ...prev,
        fromDate: dateFilterDefaults.from,
        toDate: dateFilterDefaults.to
      }));
    }
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const [tempSearch, setTempSearch] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null); 
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const handleOpenModal = useCallback((mode, item = null) => {
    setModalMode(mode);
    setEditItem(item);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditItem(null);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const base = {
        sortBy: params.sortKey || undefined,
        order: params.sortDir.toUpperCase(),
        filters: {
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
          ...(params.status !== "all" && { approved: params.status === "approved" }),
        },
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await stockAdjustmentService.getAll({ ...base, page, limit });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Failed to load data");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.fromDate, params.toDate, params.status]);

  const handleModalSuccess = useCallback(() => {
    fetchData();
    setSelected(null);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    if (q) {
      return applyClientSearch(allRows, tempSearch);
    }
    return sortRowsByKey(allRows, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + 100);
    }
  }, [loading, items.length, totalItems]);

  const handleFilterApply = (data) => {
    setParams((prev) => ({
      ...prev,
      fromDate: data.fromDate,
      toDate: data.toDate,
      status: data.approvedStatus || prev.status,
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams({
      pageSize: 1000,
      status: "all",
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "adjustment_id",
      sortDir: "desc",
    });
  };

  const extraFilters = useMemo(() => [
    { 
      label: "Status", key: "approvedStatus", value: params.status, 
      options: [
        { label: "All Status", value: "all" }, 
        { label: "Authorized", value: "approved" }, 
        { label: "Pending", value: "pending" }
      ] 
    },
  ], [params.status]);

  const selectedRecord = useMemo(
    () => filteredRows.find((i) => String(i.adjustment_id) === String(selected)),
    [filteredRows, selected]
  );

  const getSelectedRow = useCallback(
    () => filteredRows.find((i) => String(i.adjustment_id) === String(selected)),
    [filteredRows, selected]
  );

  const handlePrintStickers = useCallback(() => {
    if (!selectedRecord) return;
    if (selectedRecord.entry_type !== "add" || !selectedRecord.approved) {
      toast.info("Print stickers: select an approved add adjustment.");
      return;
    }
    handleOpenModal("print", selectedRecord);
  }, [selectedRecord, handleOpenModal]);

  const { openNewModal, openEditModal, openPrintModal, openDeleteModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "stock_adjustment",
    modalOpen: modalOpen || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => handleOpenModal("add"), [handleOpenModal]),
    openEdit: useCallback(() => {
      if (selectedRecord) handleOpenModal("edit", selectedRecord);
    }, [handleOpenModal, selectedRecord]),
    canEditSelection: useCallback(
      () => Boolean(selected && selectedRecord),
      [selected, selectedRecord]
    ),
    onEditBlocked: useCallback(() => {
      toast.info("Select a stock adjustment row to edit.");
    }, []),
    openApprove: useCallback((row) => {
      handleOpenModal("approve", row);
    }, [handleOpenModal]),
    canApproveSelection: useCallback(
      () => Boolean(selected && selectedRecord),
      [selected, selectedRecord]
    ),
    onApproveBlocked: useCallback(() => {
      toast.info("Select a row to open approve (Ctrl+A).");
    }, []),
    onPrint: useCallback(() => {
      handlePrintStickers();
    }, [handlePrintStickers]),
    canPrintSelection: useCallback(
      () =>
        Boolean(selected) &&
        selectedRecord?.entry_type === "add" &&
        Boolean(selectedRecord?.approved),
      [selected, selectedRecord?.entry_type, selectedRecord?.approved]
    ),
    printBlockedMessage: "Print stickers: select an approved add adjustment (Ctrl+Alt+P).",
    printModule: "stock_adjustment",
    printAction: "view",
    openDelete: useCallback((row) => {
      setDeleteItem(row);
    }, []),
    canDeleteSelection: useCallback(() => !!selected, [selected]),
  });

  const HEADERS = [
    ["ADJ ID", "adjustment_id", (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>, { fixed: true, width: "80px" }],
    ["Type", "entry_type", (v) => (<span className="text-[10px] font-black uppercase text-slate-700">{v === "add" ? "Add (+)" : v === "minus" ? "Minus (-)" : "—"}</span>), { width: "72px", align: "center" }],
    ["Packing no.", "packing_number", (v) => (<span className="font-mono text-[10px] text-slate-700 truncate block max-w-[120px]">{v || "—"}</span>), { width: "120px" }],
    ["Fin. year", "financial_year", (v) => (<span className="text-[10px] text-slate-600">{v || "—"}</span>), { width: "80px", align: "center" }],
    ["Customer", "acc_name", stockAdjustmentCustomerCell, { width: "200px", wrap: true }],

    ["Total qty", "qty", (v, row) => (
      <div className="flex items-baseline gap-1 py-1 justify-center">
        <span className={`font-black text-[12px] ${Number(v) < 0 ? "text-rose-600" : "text-emerald-600"}`}>
          {Number(v) > 0 ? `+${v}` : v}
        </span>
        <span className="text-[9px] text-slate-400 font-bold uppercase italic">{row.unit || "PCS"}</span>
      </div>
    ), { width: "100px", align: "center" }],

    ["Box impact", "box_count_impact", (v) => (<span className="text-[10px] font-bold text-slate-700 tabular-nums">{v != null ? v : "—"}</span>), { width: "80px", align: "center" }],

    ["Item code", "item_code", (v) => (<span className="font-bold text-slate-800 uppercase text-[10px] tracking-tight">{v || "—"}</span>), { width: "120px" }],

    ["Description", "item_desc", (v) => (
      <span className="text-[10px] text-slate-600 truncate block max-w-[200px]" title={v || ""}>
        {v || "—"}
      </span>
    ), { width: "200px" }],

    ["Remarks", "remarks", (v) => (
      <span className="text-[10px] text-slate-500 truncate block max-w-[180px]">
        {plainRemarksForDisplay(v) || "—"}
      </span>
    ), { width: "180px" }],
    ["Status", "approved", (v) => (
      <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
        {v ? "● AUTHORIZED" : "○ PENDING"}
      </span>
    ), { width: "120px" }],
    ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
    ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ];

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Stock Adjustment",
    rows: filteredRows,
    headers: HEADERS,
  });

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
              <ActionButton module="stock_adjustment" action="add" label="New" icon={Plus} onClick={openNewModal}
                className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
              />
              <ActionButton module="stock_adjustment" action="edit" variant="outline" label="Edit" icon={Edit3} disabled={!selected} record={selectedRecord}
                title="Edit allowed after Approve — Save sets Pending; use Approve again to apply"
                onClick={openEditModal}
                className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
              />
              <ActionButton module="stock_adjustment" action="view" variant="outline" label="View" icon={Eye} disabled={!selected} record={selectedRecord}
                onClick={() => handleOpenModal("view", selectedRecord)}
                className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-slate-700 shadow-none shrink-0"
              />
              <ActionButton module="stock_adjustment" action="authorize" variant="outline" label="Approve" icon={CheckCircle} disabled={!selected}
                onClick={() => handleOpenModal("approve", selectedRecord)}
                className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none shrink-0"
              />
              <PrintActionButton module="stock_adjustment" variant="outline" label="Print stickers" icon={Printer}
                disabled={
                  !selected ||
                  selectedRecord?.entry_type !== "add" ||
                  !selectedRecord?.approved
                }
                onClick={openPrintModal}
                title="Open sticker print — single or all (Ctrl+Alt+P / Ctrl+P in app)"
                className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-indigo-600 shadow-none shrink-0"
              />
              <ActionButton module="stock_adjustment" action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selected}
                onClick={() => setDeleteItem(selectedRecord)}
                className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
              />
              
              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />
              
              <button onClick={() => fetchData()} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center shadow-none transition-all shrink-0">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
              </>
            }
            viewToggle={
              <ListPageExportToggle
                viewMode={viewMode}
                setMode={handleViewMode}
                exporting={exporting}
                disabled={loading || exportDisabled}
                onExport={handleExport}
              />
            }
          />

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-600 uppercase truncate max-w-[min(100%,28rem)]">
                Selected: ADJ-#{selected}
                {selectedRecord?.item_code ? ` · ${selectedRecord.item_code}` : ""}
                {selectedRecord?.item_desc ? ` — ${selectedRecord.item_desc}` : ""}
              </span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter 
            key={`${params.fromDate}-${params.toDate}`}
            fromDate={params.fromDate} 
            toDate={params.toDate} 
            extraFilters={extraFilters} 
            onApply={handleFilterApply} 
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search packing, item, remark…"
            searchLabel="Search Adjustment"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
            <DataTable
              headers={HEADERS}
              data={items}
              allowCopy={true}
              loading={loading}
              viewMode={viewMode}
              {...tableHotkeyProps}
              onSort={(key) => {
                setDisplayLimit(100);
                setParams((p) => ({
                  ...p,
                  sortKey: key,
                  sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                }));
              }}
              sortKey={params.sortKey}
              sortDir={params.sortDir}
              selectedId={selected}
              onSelect={setSelected}
              getRowId={(item) => item.adjustment_id}
              onLoadMore={handleLoadMore}
              hasMore={items.length < totalItems}
              totalItems={totalItems}
              cardConfig={{ 
                titleKey: "item_code", 
                badgeIndices: [9], 
                detailIndices: [1, 2, 3, 6], 
                footerKey: "created_at",
                className: "rounded-none border border-slate-200 shadow-none" 
              }}
            />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Adjustments
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {modalOpen && modalMode === "print" && editItem?.entry_type === "add" && (
        <StockAdjustmentPrintStickersDrawer
          open={modalOpen}
          editData={editItem}
          onClose={closeModal}
        />
      )}
      {modalOpen && modalMode === "add" && (
        <StockAdjustmentStickerCloneDrawer
          open={modalOpen}
          onClose={closeModal}
          onSuccess={handleModalSuccess}
        />
      )}
      {modalOpen && modalMode === "view" && (editItem?.entry_type === "add" || editItem?.entry_type === "minus") && (
        <StockAdjustmentStickerCloneDrawer
          open={modalOpen}
          mode="view"
          editData={editItem}
          onClose={closeModal}
        />
      )}
      {modalOpen && modalMode === "view" && editItem?.entry_type !== "add" && editItem?.entry_type !== "minus" && (
        <StockAdjustmentModal
          open={modalOpen}
          mode="view"
          editData={editItem}
          onClose={closeModal}
        />
      )}
      {modalOpen && modalMode === "edit" && (editItem?.entry_type === "add" || editItem?.entry_type === "minus") && (
        <StockAdjustmentStickerCloneDrawer
          open={modalOpen}
          mode="edit"
          editData={editItem}
          onClose={closeModal}
          onSuccess={handleModalSuccess}
        />
      )}
      {modalOpen && modalMode === "edit" && editItem?.entry_type !== "add" && editItem?.entry_type !== "minus" && (
        <StockAdjustmentModal
          open={modalOpen}
          mode="edit"
          editData={editItem}
          onClose={closeModal}
          onSuccess={handleModalSuccess}
        />
      )}
      {modalOpen && modalMode === "approve" && (editItem?.entry_type === "add" || editItem?.entry_type === "minus") && (
        <StockAdjustmentStickerCloneDrawer
          open={modalOpen}
          mode="approve"
          editData={editItem}
          onClose={closeModal}
          onSuccess={handleModalSuccess}
        />
      )}
      {/* Legacy approve modal (non packing add/minus rows only) — edit mode disabled */}
      {modalOpen &&
        modalMode === "approve" &&
        editItem?.entry_type !== "add" &&
        editItem?.entry_type !== "minus" && (
          <StockAdjustmentModal
            open={modalOpen}
            onClose={closeModal}
            onSuccess={handleModalSuccess}
            editData={editItem}
            mode="approve"
          />
        )}
      {deleteItem && (
        <DeleteModal item={deleteItem} onClose={() => setDeleteItem(null)} onSuccess={handleModalSuccess} service={stockAdjustmentService} entityLabel="Adjustment Record" idKey="adjustment_id" moduleSlug="stock_adjustment" />
      )}
    </div>
  );
}


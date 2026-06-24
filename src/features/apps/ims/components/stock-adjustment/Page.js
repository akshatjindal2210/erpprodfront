"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Trash2, CheckCircle, X, Printer, Eye, Edit3 } from "lucide-react";
import { toast } from "react-toastify";
import { useViewDateFilterDefaults } from "@/features/apps/ims/helpers/dateFilterDefaults";

import { stockAdjustmentService } from "@/features/apps/ims/services/stockAdjustment";
import { useViewMode } from "@/core/hooks/useViewMode";
import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";

import StockAdjustmentModal from "@/features/apps/ims/components/stock-adjustment/StockAdjustmentModal";
import StockAdjustmentStickerCloneDrawer from "@/features/apps/ims/components/stock-adjustment/StockAdjustmentStickerCloneDrawer";
import StockAdjustmentPrintStickersDrawer from "@/features/apps/ims/components/stock-adjustment/StockAdjustmentPrintStickersDrawer";
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
import { fetchAllListPages } from "@/features/apps/ims/helpers/clientListSearch";
import { STOCK_ADJUSTMENT_CARD_CONFIG, STOCK_ADJUSTMENT_HEADERS, STOCK_ADJUSTMENT_STATUS_FILTER_OPTIONS, filterStockAdjustmentRows, buildStockAdjustmentApiFilters } from "./stockAdjustmentColumns";

const LIST_PAGE_SIZE = 1000;
const DISPLAY_CHUNK = 100;

export default function StockAdjustmentPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("stock_adjustment", "view"), [canAccess]);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: LIST_PAGE_SIZE,
    status: "all",
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "adjustment_id",
    sortDir: "desc",
  });

  useEffect(() => {
    if (dateFilterDefaults.from || dateFilterDefaults.to) {
      setParams((prev) => ({
        ...prev,
        fromDate: dateFilterDefaults.from,
        toDate: dateFilterDefaults.to,
      }));
    }
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const [searchText, setSearchText] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(DISPLAY_CHUNK);
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
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await stockAdjustmentService.getAll({
          page,
          limit,
          filters: buildStockAdjustmentApiFilters({
            fromDate: params.fromDate,
            toDate: params.toDate,
            status: params.status,
          }),
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(DISPLAY_CHUNK);
    } catch (err) {
      toast.error(err?.message || "Failed to load data");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.fromDate, params.toDate, params.status]);

  const handleModalSuccess = useCallback(() => {
    fetchData();
    setSelected(null);
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRows = useMemo(
    () =>
      filterStockAdjustmentRows(allRows, {
        fromDate: params.fromDate,
        toDate: params.toDate,
        status: params.status,
        search: searchText,
        sortKey: params.sortKey,
        sortDir: params.sortDir,
      }),
    [
      allRows,
      params.fromDate,
      params.toDate,
      params.status,
      searchText,
      params.sortKey,
      params.sortDir,
    ]
  );

  useEffect(() => {
    setDisplayLimit(DISPLAY_CHUNK);
  }, [searchText, params.fromDate, params.toDate, params.status]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + DISPLAY_CHUNK);
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
    setSearchText("");
    setParams({
      pageSize: LIST_PAGE_SIZE,
      status: "all",
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "adjustment_id",
      sortDir: "desc",
    });
  };

  const extraFilters = useMemo(
    () => [
      {
        label: "Status",
        key: "approvedStatus",
        value: params.status,
        options: STOCK_ADJUSTMENT_STATUS_FILTER_OPTIONS,
      },
    ],
    [params.status]
  );

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

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Stock Adjustment",
    rows: filteredRows,
    headers: STOCK_ADJUSTMENT_HEADERS,
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
            searchValue={searchText}
            onSearchChange={setSearchText}
            onSearchEnter={() =>
              handleFilterApply({
                fromDate: params.fromDate,
                toDate: params.toDate,
                approvedStatus: params.status,
              })
            }
            applyOnSearchEnter={false}
            searchPlaceholder="Search packing, item, remark…"
            searchLabel="Search Adjustment"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
            <DataTable
              headers={STOCK_ADJUSTMENT_HEADERS}
              data={items}
              allowCopy={true}
              loading={loading}
              viewMode={viewMode}
              {...tableHotkeyProps}
              onSort={(key) => {
                setDisplayLimit(DISPLAY_CHUNK);
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
              cardConfig={STOCK_ADJUSTMENT_CARD_CONFIG}
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

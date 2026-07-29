"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Trash2, CheckCircle, X, Eye, Edit3, Printer } from "lucide-react";
import { toast } from "react-toastify";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";

import { stockAdjustmentService } from "@/apps/rmstore/lib/services/stockAdjustment";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";

import StockAdjustmentDrawer from "@/apps/rmstore/modules/stock-adjustment/StockAdjustmentDrawer";
import StockAdjustmentPrintStickersDrawer from "@/apps/rmstore/modules/stock-adjustment/StockAdjustmentPrintStickersDrawer";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import DataTable from "@/ui/primitives/DataTable";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ActionButton from "@/ui/primitives/ActionButton";
import PrintActionButton from "@/ui/primitives/PrintActionButton";

import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { fetchAllListPages } from "@/ui/common/list/clientListSearch";
import { STOCK_ADJUSTMENT_CARD_CONFIG, STOCK_ADJUSTMENT_HEADERS, STOCK_ADJUSTMENT_STATUS_FILTER_OPTIONS, filterStockAdjustmentRows, buildStockAdjustmentApiFilters } from "./stockAdjustmentColumns";

const MODULE = "rm_stock_adjustment";
const LIST_PAGE_SIZE = 1000;
const DISPLAY_CHUNK = 100;

export default function StockAdjustmentPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);

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
      toast.error(err?.message || "Could not load the stock adjustments. Please try again.");
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
    [allRows, params.fromDate, params.toDate, params.status, searchText, params.sortKey, params.sortDir]
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

  const { openNewModal, openEditModal, openDeleteModal, openPrintModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: modalOpen || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => handleOpenModal("add"), [handleOpenModal]),
    openEdit: useCallback(() => {
      if (selectedRecord) handleOpenModal("edit", selectedRecord);
    }, [handleOpenModal, selectedRecord]),
    canEditSelection: useCallback(() => Boolean(selected && selectedRecord), [selected, selectedRecord]),
    onEditBlocked: useCallback(() => toast.info("Select a stock adjustment row to edit."), []),
    openApprove: useCallback(
      (row) => handleOpenModal("approve", row),
      [handleOpenModal]
    ),
    canApproveSelection: useCallback(
      () => Boolean(selected && selectedRecord && !selectedRecord.approved),
      [selected, selectedRecord]
    ),
    onApproveBlocked: useCallback(() => {
      if (selectedRecord?.approved) toast.info("This adjustment is already authorized. Edit it first if you need to change the stock.");
      else toast.info("Select a pending row to approve (Ctrl+A).");
    }, [selectedRecord?.approved]),
    onPrint: useCallback(() => {
      if (!selectedRecord) return;
      if (selectedRecord.entry_type !== "add" || !selectedRecord.approved) {
        toast.info("Printing stickers is only available for approved Add (+) adjustments.");
        return;
      }
      handleOpenModal("print", selectedRecord);
    }, [selectedRecord, handleOpenModal]),
    canPrintSelection: useCallback(
      () =>
        Boolean(selected) &&
        selectedRecord?.entry_type === "add" &&
        Boolean(selectedRecord?.approved),
      [selected, selectedRecord?.entry_type, selectedRecord?.approved]
    ),
    printBlockedMessage: "Printing stickers is only available for approved Add (+) adjustments.",
    printModule: MODULE,
    printAction: "view",
    openDelete: useCallback((row) => setDeleteItem(row), []),
    canDeleteSelection: useCallback(() => !!selected, [selected]),
  });

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "RM Stock Adjustment",
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
                <ActionButton
                  module={MODULE}
                  action="add"
                  label="New"
                  icon={Plus}
                  onClick={openNewModal}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />
                <ActionButton
                  module={MODULE}
                  action="edit"
                  variant="outline"
                  label="Edit"
                  icon={Edit3}
                  disabled={!selected}
                  record={selectedRecord}
                  title="Editing an approved adjustment sets it back to Pending. Approve it again to apply the change."
                  onClick={openEditModal}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                />
                <ActionButton
                  module={MODULE}
                  action="view"
                  variant="outline"
                  label="View"
                  icon={Eye}
                  disabled={!selected}
                  record={selectedRecord}
                  onClick={() => handleOpenModal("view", selectedRecord)}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-slate-700 shadow-none shrink-0"
                />
                <ActionButton
                  module={MODULE}
                  action="authorize"
                  variant="outline"
                  label="Approve"
                  icon={CheckCircle}
                  disabled={!selected || Boolean(selectedRecord?.approved)}
                  onClick={() => handleOpenModal("approve", selectedRecord)}
                  title={
                    selectedRecord?.approved
                      ? "Already authorized. Edit it first to make a change, then approve it again."
                      : "Approve this pending adjustment"
                  }
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none shrink-0"
                />
                <PrintActionButton
                  module={MODULE}
                  variant="outline"
                  label="Print Stickers"
                  icon={Printer}
                  disabled={
                    !selected ||
                    selectedRecord?.entry_type !== "add" ||
                    !selectedRecord?.approved
                  }
                  onClick={openPrintModal}
                  title="Print RM coil stickers for an approved Add (+) adjustment"
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-indigo-600 shadow-none shrink-0"
                />
                <ActionButton
                  module={MODULE}
                  action="delete"
                  variant="danger"
                  label="Delete"
                  icon={Trash2}
                  disabled={!selected}
                  onClick={() => setDeleteItem(selectedRecord)}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />
                <button
                  type="button"
                  onClick={() => fetchData()}
                  className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center shadow-none transition-all shrink-0"
                >
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
              </span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase"
              >
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
            searchPlaceholder="Search by heat, item, or remark"
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
        </div>
      </div>

      {modalOpen && modalMode === "print" && (
        <StockAdjustmentPrintStickersDrawer
          open={modalOpen}
          editData={editItem}
          onClose={closeModal}
        />
      )}
      {modalOpen && modalMode !== "print" && (
        <StockAdjustmentDrawer
          open={modalOpen}
          mode={modalMode}
          editData={editItem}
          onClose={closeModal}
          onSuccess={handleModalSuccess}
        />
      )}
      {deleteItem && (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={handleModalSuccess}
          service={stockAdjustmentService}
          entityLabel="Adjustment Record"
          idKey="adjustment_id"
          moduleSlug={MODULE}
        />
      )}
    </div>
  );
}

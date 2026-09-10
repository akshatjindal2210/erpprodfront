"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, RefreshCw, Edit3, Trash2, CheckCircle, ShieldAlert, X, Printer, Activity } from "lucide-react";
import { toast } from "react-toastify";

import { qcHoldMaterialService } from "@/apps/ims/lib/services/qcHoldMaterial";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";

import QcHoldMaterialModal from "./QcHoldMaterialModal";
import QcHoldPrintStickersDrawer from "./QcHoldPrintStickersDrawer";
import QcHoldActivityDrawer from "./QcHoldActivityDrawer";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import DataTable from "@/ui/primitives/DataTable";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import ActionButton from "@/ui/primitives/ActionButton";

import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { QC_HOLD_CARD_CONFIG, QC_HOLD_HEADERS, QC_HOLD_STATUS_TABS, QC_HOLD_TX_ACTION_FILTER_OPTIONS, QC_HOLD_TX_CARD_CONFIG, QC_HOLD_TX_HEADERS, buildQcHoldApiFilters, canEditQcHoldRow, canPrintQcHoldStickersRow, getQcHoldEmptyState, matchesQcHoldPendingFilter, matchesQcHoldTxActionFilter, qcHoldPendingFilterOptions, qcHoldSearchParts, qcHoldTxSearchParts } from "./qcHoldColumns";

const LIST_PAGE_SIZE = 1000;
const DISPLAY_CHUNK = 100;

export default function QcHoldMaterialPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("qc_hold_material", "view"), [canAccess]);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [statusTab, setStatusTab] = useState("pending");
  const [pendingFilter, setPendingFilter] = useState("all");
  const [txActionFilter, setTxActionFilter] = useState("all");

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: LIST_PAGE_SIZE,
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "hold_id",
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

  const { tempSearch, setTempSearch, appliedSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(DISPLAY_CHUNK);
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [isDeleting, setIsDeleting] = useState(false);
  const [printDrawerOpen, setPrintDrawerOpen] = useState(false);
  const [printDrawerData, setPrintDrawerData] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const loadGenRef = useRef(0);

  const isTxTab = statusTab === "transactions";
  const apiDateFrom = isTxTab ? params.fromDate : "";
  const apiDateTo = isTxTab ? params.toDate : "";

  const fetchData = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setLoading(true);
    const dates = {
      ...(apiDateFrom && { from_date: `${apiDateFrom} 00:00:00` }),
      ...(apiDateTo && { to_date: `${apiDateTo} 23:59:59` }),
    };
    try {
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = isTxTab
          ? await qcHoldMaterialService.getTransactionLog({
              page,
              limit,
              ...(appliedSearch && { search: appliedSearch }),
              ...dates,
            })
          : await qcHoldMaterialService.getAll({
              page,
              limit,
              ...(appliedSearch && { search: appliedSearch }),
              filters: { ...dates, ...buildQcHoldApiFilters(pendingFilter) },
            });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      if (gen !== loadGenRef.current) return;
      setAllRows(data);
      setDisplayLimit(DISPLAY_CHUNK);
    } catch (err) {
      if (gen !== loadGenRef.current) return;
      toast.error(err?.message || (isTxTab ? "Failed to load QC hold transactions" : "Failed to load QC hold list"));
      setAllRows([]);
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [params.pageSize, pendingFilter, appliedSearch, apiDateFrom, apiDateTo, isTxTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRows = useMemo(() => {
    const scoped = isTxTab
      ? allRows.filter((row) => matchesQcHoldTxActionFilter(row, txActionFilter))
      : allRows.filter((row) => matchesQcHoldPendingFilter(row, pendingFilter));
    const q = String(tempSearch || "").trim();
    const data = q
      ? applyClientSearch(scoped, tempSearch, {
          getParts: (row) => (isTxTab ? qcHoldTxSearchParts(row) : qcHoldSearchParts(row)),
          skipSort: !!params.sortKey,
        })
      : scoped;
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir, pendingFilter, isTxTab, txActionFilter]);

  useEffect(() => {
    setDisplayLimit(DISPLAY_CHUNK);
  }, [tempSearch, statusTab, pendingFilter, txActionFilter]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + DISPLAY_CHUNK);
    }
  }, [loading, items.length, totalItems]);

  const getRowId = useCallback((row) => (isTxTab ? String(row.id) : String(row.hold_id)), [isTxTab]);

  const selectedRecord = useMemo(
    () => filteredRows.find((row) => getRowId(row) === selectedId) || null,
    [filteredRows, selectedId, getRowId]
  );

  const openModal = useCallback((mode) => {
    setModalMode(mode);
    setModalOpen(true);
  }, []);

  const openPrintStickers = useCallback(() => {
    if (!selectedRecord || !canPrintQcHoldStickersRow(selectedRecord)) return;
    setPrintDrawerData({
      hold: selectedRecord,
      submission: selectedRecord.pending_submission || null,
      stickers: null,
    });
    setPrintDrawerOpen(true);
  }, [selectedRecord]);

  const getSelectedRow = useCallback(() => selectedRecord, [selectedRecord]);

  const { openNewModal, openEditModal, openApproveModal, openDeleteModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "qc_hold_material",
    modalOpen: modalOpen || isDeleting,
    selectedId,
    getSelectedRow,
    openAdd: useCallback(() => openModal("add"), [openModal]),
    openEdit: useCallback(() => openModal("edit"), [openModal]),
    canEditSelection: useCallback(() => canEditQcHoldRow(selectedRecord), [selectedRecord]),
    openApprove: useCallback(() => openModal("approve"), [openModal]),
    canApproveSelection: useCallback(
      () => Boolean(selectedId && selectedRecord?.has_pending_submission),
      [selectedId, selectedRecord]
    ),
    openDelete: useCallback(() => setIsDeleting(true), []),
    canDeleteSelection: useCallback(() => Boolean(selectedId) && !isTxTab, [selectedId, isTxTab]),
  });

  const handleReset = () => {
    resetSearch();
    setPendingFilter("all");
    setTxActionFilter("all");
    setParams({
      pageSize: LIST_PAGE_SIZE,
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: isTxTab ? "created_at" : "hold_id",
      sortDir: "desc",
    });
  };

  const handleFilterApply = useCallback(
    (data) => {
      applySearchFromInput();
      if (isTxTab && data.txActionFilter != null) {
        setTxActionFilter(data.txActionFilter || "all");
        setSelectedId(null);
      } else if (!isTxTab && data.pendingFilter != null) {
        setPendingFilter(data.pendingFilter || "all");
        setSelectedId(null);
      }
      setParams((prev) => ({
        ...prev,
        fromDate: data.fromDate ?? prev.fromDate,
        toDate: data.toDate ?? prev.toDate,
      }));
    },
    [applySearchFromInput, isTxTab]
  );

  const extraFilters = useMemo(() => {
    if (isTxTab) {
      return [
        {
          label: "Action",
          key: "txActionFilter",
          value: txActionFilter,
          preserveOrder: true,
          variant: "quick",
          options: QC_HOLD_TX_ACTION_FILTER_OPTIONS,
        },
      ];
    }
    return [
      {
        label: "Show",
        key: "pendingFilter",
        value: pendingFilter,
        preserveOrder: true,
        options: qcHoldPendingFilterOptions(),
      },
    ];
  }, [isTxTab, pendingFilter, txActionFilter]);

  const emptyState = useMemo(
    () => getQcHoldEmptyState(statusTab, pendingFilter, txActionFilter),
    [statusTab, pendingFilter, txActionFilter]
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isTxTab ? "QC Hold Transaction" : "QC Hold Material",
    rows: filteredRows,
    headers: isTxTab ? QC_HOLD_TX_HEADERS : QC_HOLD_HEADERS,
  });

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <ImsSegmentedTabs
                className="mr-2"
                active={statusTab}
                onChange={(id) => {
                  setStatusTab(id);
                  setSelectedId(null);
                  if (id !== "pending") setPendingFilter("all");
                  if (id !== "transactions") setTxActionFilter("all");
                  setParams((prev) => ({
                    ...prev,
                    sortKey: id === "transactions" ? "created_at" : "hold_id",
                    sortDir: "desc",
                  }));
                }}
                tabs={QC_HOLD_STATUS_TABS}
              />
            }
            actions={
              <>
                {!isTxTab ? (
                  <>
                    <ActionButton
                      module="qc_hold_material"
                      action="add"
                      label="New"
                      icon={Plus}
                      onClick={openNewModal}
                      className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                    />
                    <ActionButton
                      module="qc_hold_material"
                      action="edit"
                      variant="outline"
                      label="Edit"
                      icon={Edit3}
                      disabled={!selectedId || !canEditQcHoldRow(selectedRecord)}
                      record={selectedRecord}
                      onClick={openEditModal}
                      className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                    />
                    <ActionButton
                      module="qc_hold_material"
                      action="authorize"
                      variant="outline"
                      label="Approve"
                      icon={CheckCircle}
                      disabled={!selectedId || !selectedRecord?.has_pending_submission}
                      onClick={openApproveModal}
                      className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none shrink-0"
                    />
                    <ActionButton
                      module="qc_hold_material"
                      action="view"
                      variant="outline"
                      label="History"
                      icon={Activity}
                      disabled={!selectedId}
                      onClick={() => {
                        if (!selectedRecord) {
                          toast.info("Select a QC hold row first.");
                          return;
                        }
                        setHistoryOpen(true);
                      }}
                      className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                    />
                    <ActionButton
                      module="qc_hold_material"
                      action="view"
                      variant="outline"
                      label="Print Stickers"
                      icon={Printer}
                      disabled={!selectedId || !canPrintQcHoldStickersRow(selectedRecord)}
                      onClick={openPrintStickers}
                      className="rounded-none h-9 bg-emerald-50 text-[11px] font-bold uppercase px-4 border-emerald-300 text-emerald-700 shadow-none shrink-0"
                    />
                    <ActionButton
                      module="qc_hold_material"
                      action="delete"
                      variant="danger"
                      label="Delete"
                      icon={Trash2}
                      disabled={!selectedId}
                      onClick={openDeleteModal}
                      className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                    />
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => fetchData()}
                  className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shrink-0"
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

          {selectedId && selectedRecord && !isTxTab ? (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-600 uppercase truncate max-w-[min(100%,36rem)]">
                Selected: #{selectedRecord.hold_id}
                {selectedRecord.packing_number ? ` · ${selectedRecord.packing_number}` : ""}
                {selectedRecord.item_code ? ` · ${selectedRecord.item_code}` : ""}
                {selectedRecord.balance_qty != null
                  ? ` · Bal ${Number(selectedRecord.balance_qty).toLocaleString()} qty`
                  : ""}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {canPrintQcHoldStickersRow(selectedRecord) ? (
                  <button
                    type="button"
                    onClick={openPrintStickers}
                    className="text-emerald-700 hover:text-emerald-900 flex items-center gap-1 font-bold text-[10px] uppercase"
                  >
                    <Printer size={14} /> Print stickers
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase"
                >
                  <X size={14} /> Clear
                </button>
              </div>
            </div>
          ) : null}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            key={statusTab}
            fromDate={params.fromDate}
            toDate={params.toDate}
            showDate={isTxTab}
            extraFilters={extraFilters}
            instantClientExtras
            applyExtrasOnChange
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            onSearchEnter={() =>
              handleFilterApply({
                fromDate: params.fromDate,
                toDate: params.toDate,
                pendingFilter,
                txActionFilter,
              })
            }
            searchPlaceholder={isTxTab ? "Search packing, item, action, hold id..." : "Search packing, item, reason, remark..."}
            searchLabel="Quick Search"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={isTxTab ? QC_HOLD_TX_HEADERS : QC_HOLD_HEADERS}
            data={items}
            allowCopy
            loading={loading}
            viewMode={viewMode}
            {...tableHotkeyProps}
            selectedId={selectedId}
            onSelect={setSelectedId}
            getRowId={getRowId}
            idKey={isTxTab ? "id" : "hold_id"}
            onSort={(key) =>
              setParams((p) => ({
                ...p,
                sortKey: key,
                sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
              }))
            }
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            emptyMessage={emptyState.message}
            emptySubMessage={emptyState.subMessage}
            emptyIcon={ShieldAlert}
            cardConfig={isTxTab ? QC_HOLD_TX_CARD_CONFIG : QC_HOLD_CARD_CONFIG}
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} {isTxTab ? "Transaction" : "QC Holds"}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      <QcHoldMaterialModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchData}
        onApprovedForPrint={(data) => {
          setPrintDrawerData(data);
          setPrintDrawerOpen(true);
        }}
        editData={modalMode === "add" ? null : selectedRecord}
        mode={modalMode}
      />

      <QcHoldPrintStickersDrawer
        open={printDrawerOpen}
        onClose={() => {
          setPrintDrawerOpen(false);
          setPrintDrawerData(null);
        }}
        editData={{
          hold_id: printDrawerData?.hold?.hold_id,
          packing_number: printDrawerData?.hold?.packing_number,
          submission_id: printDrawerData?.submission?.submission_id,
        }}
        initialStickers={printDrawerData?.stickers}
      />

      <QcHoldActivityDrawer
        open={historyOpen}
        hold={selectedRecord}
        onClose={() => setHistoryOpen(false)}
      />

      {isDeleting && (
        <DeleteModal
          item={selectedRecord}
          onClose={() => setIsDeleting(false)}
          onSuccess={() => {
            fetchData();
            setSelectedId(null);
            setIsDeleting(false);
          }}
          service={qcHoldMaterialService}
          entityLabel="QC Hold"
          idKey="hold_id"
          titleKey="packing_number"
          moduleSlug="qc_hold_material"
        />
      )}
    </div>
  );
}

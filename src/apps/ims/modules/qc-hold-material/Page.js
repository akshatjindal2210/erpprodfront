"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, RefreshCw, Edit3, Trash2, CheckCircle, ShieldAlert, X, Printer } from "lucide-react";
import { toast } from "react-toastify";

import { qcHoldMaterialService } from "@/apps/ims/lib/services/qcHoldMaterial";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";

import QcHoldMaterialModal from "./QcHoldMaterialModal";
import QcHoldPrintStickersDrawer from "./QcHoldPrintStickersDrawer";
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
import { QC_HOLD_CARD_CONFIG, QC_HOLD_HEADERS, activeQcHoldStatusTabs, buildQcHoldApiFilters, canEditQcHoldRow, canPrintQcHoldStickersRow, getQcHoldEmptyState, isIncompleteQcHoldRow, qcHoldSearchParts, rowHoldStatus } from "./qcHoldColumns";

const LIST_PAGE_SIZE = 1000;
const DISPLAY_CHUNK = 100;

export default function QcHoldMaterialPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("qc_hold_material", "view"), [canAccess]);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [statusTab, setStatusTab] = useState("pending");
  const [pendingFilter, setPendingFilter] = useState("all");

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
  const loadGenRef = useRef(0);

  const apiDateFrom = statusTab === "pending" ? "" : params.fromDate;
  const apiDateTo = statusTab === "pending" ? "" : params.toDate;

  const fetchData = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setLoading(true);
    try {
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await qcHoldMaterialService.getAll({
          page,
          limit,
          ...(appliedSearch && { search: appliedSearch }),
          filters: {
            ...(apiDateFrom && { from_date: `${apiDateFrom} 00:00:00` }),
            ...(apiDateTo && { to_date: `${apiDateTo} 23:59:59` }),
            ...buildQcHoldApiFilters(statusTab),
          },
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      if (gen !== loadGenRef.current) return;
      setAllRows(data);
      setDisplayLimit(DISPLAY_CHUNK);
    } catch (err) {
      if (gen !== loadGenRef.current) return;
      toast.error(err?.message || "Failed to load QC hold list");
      setAllRows([]);
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [params.pageSize, statusTab, appliedSearch, apiDateFrom, apiDateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRows = useMemo(() => {
    let rows = allRows;

    if (statusTab === "pending") {
      rows = rows.filter(isIncompleteQcHoldRow);
      if (pendingFilter === "partial") {
        rows = rows.filter((row) => rowHoldStatus(row) === "partial");
      } else if (pendingFilter === "awaiting_approval") {
        rows = rows.filter((row) => row.has_pending_submission);
      }
    }

    const q = String(tempSearch || "").trim();
    let data = rows;
    if (q) {
      data = applyClientSearch(rows, tempSearch, {
        getParts: (row) => qcHoldSearchParts(row),
        skipSort: !!params.sortKey,
      });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir, statusTab, pendingFilter]);

  useEffect(() => {
    setDisplayLimit(DISPLAY_CHUNK);
  }, [tempSearch, statusTab, pendingFilter]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + DISPLAY_CHUNK);
    }
  }, [loading, items.length, totalItems]);

  const getRowId = useCallback((row) => String(row.hold_id), []);

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
    canDeleteSelection: useCallback(() => Boolean(selectedId), [selectedId]),
  });

  const handleReset = () => {
    resetSearch();
    setPendingFilter("all");
    setParams({
      pageSize: LIST_PAGE_SIZE,
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "hold_id",
      sortDir: "desc",
    });
  };

  const pendingExtraFilters = useMemo(() => {
    if (statusTab !== "pending") return [];
    return [
      {
        label: "Show",
        key: "pendingFilter",
        value: pendingFilter,
        options: [
          { label: "All open", value: "all" },
          { label: "Awaiting approval", value: "awaiting_approval" },
          { label: "Partial progress", value: "partial" },
        ],
      },
    ];
  }, [statusTab, pendingFilter]);

  const handleFilterApply = useCallback(
    (data) => {
      applySearchFromInput();
      if (statusTab === "pending" && data.pendingFilter != null) {
        setPendingFilter(data.pendingFilter || "all");
        setSelectedId(null);
        return;
      }
      setParams((prev) => ({
        ...prev,
        fromDate: data.fromDate ?? prev.fromDate,
        toDate: data.toDate ?? prev.toDate,
      }));
    },
    [statusTab, applySearchFromInput]
  );

  const emptyState = useMemo(
    () => getQcHoldEmptyState(statusTab, pendingFilter),
    [statusTab, pendingFilter]
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "QC Hold Material",
    rows: filteredRows,
    headers: QC_HOLD_HEADERS,
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
                }}
                tabs={activeQcHoldStatusTabs()}
              />
            }
            actions={
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

                {(statusTab === "complete" || statusTab === "pending") ? (
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
                ) : null}
                
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

          {selectedId && selectedRecord ? (
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
            key={`${statusTab}-${params.fromDate}-${params.toDate}`}
            fromDate={params.fromDate}
            toDate={params.toDate}
            showDate={statusTab !== "pending"}
            extraFilters={pendingExtraFilters}
            instantClientExtras={statusTab === "pending"}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            onSearchEnter={() =>
              handleFilterApply({
                fromDate: params.fromDate,
                toDate: params.toDate,
                pendingFilter,
              })
            }
            searchPlaceholder="Search packing, item, reason, remark..."
            searchLabel="Quick Search"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={QC_HOLD_HEADERS}
            data={items}
            allowCopy
            loading={loading}
            viewMode={viewMode}
            {...tableHotkeyProps}
            selectedId={selectedId}
            onSelect={setSelectedId}
            getRowId={getRowId}
            idKey="hold_id"
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
            emptyMessage={emptyState.message}
            emptySubMessage={emptyState.subMessage}
            emptyIcon={ShieldAlert}
            cardConfig={QC_HOLD_CARD_CONFIG}
          />
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, Download, Edit3, Info, Layers, Plus, Printer, RefreshCcw, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import { MasterListFooter } from "@/apps/ims/lib/helpers/masterListUi";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { fetchAllListPages, applyClientSearch, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import ActionButton from "@/ui/primitives/ActionButton";
import PrintActionButton from "@/ui/primitives/PrintActionButton";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import DataTable from "@/ui/primitives/DataTable";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import TrayModal from "./TrayModal";
import TrayBatchDrawer from "./TrayBatchDrawer";
import TrayBulkQRDrawer from "./TrayBulkQRDrawer";
import { trayService } from "@/apps/ims/lib/services/tray";
import { getBatchNonDeletedCount, getBatchPendingCount, isTrayPrintable, sortTraysAsc } from "@/apps/ims/lib/helpers/trayHelper";
import { runTrayLabelBulkExport } from "@/apps/ims/lib/helpers/trayQrLabel";

const batchStatusBadge = (row) => {
  const approved = row?.approved === true || row?.approved === 1 || String(row?.approved).toLowerCase() === "true";
  if (approved) {
    return <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-emerald-50 text-emerald-600 border-emerald-100">● AUTHORIZED</span>;
  }
  return <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-amber-50 text-amber-600 border-amber-100">○ PENDING</span>;
};

const batchDeleteService = { delete: (batch_id) => trayService.deleteBatch(batch_id) };
const IMS_BTN = "rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none";
const IMS_OUT = `${IMS_BTN} bg-white border border-slate-300`;

function buildBatchRowFromCreate(created) {
  const batch = created?.batch;
  if (!batch?.batch_id) return null;
  const qty = Number(batch.quantity || 0);
  return {
    batch_id: batch.batch_id,
    type: batch.type,
    start_code: batch.start_code,
    end_code: batch.end_code,
    start_serial_number: batch.start_serial_number,
    end_serial_number: batch.end_serial_number,
    tray_count: qty,
    active_count: qty,
    pending_count: qty,
    approved_count: 0,
    remark: batch.remark || "",
  };
}

export default function TrayPage() {
  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [batchRows, setBatchRows] = useState([]);
  const [batchTrays, setBatchTrays] = useState([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [tempSearch, setTempSearch] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [drawerBatch, setDrawerBatch] = useState(null);
  const [batchDetailOpen, setBatchDetailOpen] = useState(false);
  const [selectedTrayId, setSelectedTrayId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editBatch, setEditBatch] = useState(null);
  const [deleteBatchItem, setDeleteBatchItem] = useState(null);
  const [bulkQrOpen, setBulkQrOpen] = useState(false);
  const [bulkQrTrays, setBulkQrTrays] = useState([]);
  const [bulkQrLoading, setBulkQrLoading] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [batchTraysLoading, setBatchTraysLoading] = useState(false);
  const trayCacheRef = useRef(new Map());
  const trayLoadRef = useRef({ batchId: null, promise: null });
  const prefetchTimerRef = useRef(null);

  const [params, setParams] = useState({
    pageSize: 1000,
    sortKey: "created_at",
    sortDir: "desc",
    type: "all",
    status: "all",
  });

  const fetchTypes = useCallback(async () => {
    try {
      const body = await trayService.getTypes();
      const list = body?.data?.data ?? body?.data ?? [];
      setTypeOptions(Array.isArray(list) ? list : []);
    } catch {
      setTypeOptions([]);
    }
  }, []);

  const fetchTrays = useCallback(async () => {
    setLoading(true);
    try {
      const filters = {
        status: "all",
        ...(params.type !== "all" && { type: params.type }),
      };
      const base = {
        sortBy: params.sortKey,
        order: params.sortDir.toUpperCase(),
        filters,
        view: "batch",
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await trayService.getAll({ ...base, page, limit });
        const list = body?.data?.data ?? body?.data ?? [];
        return {
          data: Array.isArray(list) ? list : [],
          total: body?.data?.total ?? body?.total ?? 0,
        };
      }, params.pageSize);

      setBatchRows(data || []);
      setSelectedBatchId((prev) => {
        const exists = prev && (data || []).some((row) => row.batch_id === prev);
        if (!exists) {
          setBatchDetailOpen(false);
          setBatchTrays([]);
          setSelectedTrayId(null);
          return null;
        }
        return prev;
      });
    } catch (err) {
      toast.error(err?.message || "Failed to load tray batches");
      setBatchRows([]);
      setBatchTrays([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortDir, params.sortKey, params.type]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  useEffect(() => {
    fetchTrays();
  }, [fetchTrays]);

  useEffect(() => {
    setDisplayLimit(100);
  }, [tempSearch, params.type, params.status]);

  const filteredBatchRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    let data = batchRows;
    if (params.status === "approved") {
      data = data.filter((row) => Number(row.pending_count || 0) === 0);
    } else if (params.status === "pending") {
      data = data.filter((row) => Number(row.pending_count || 0) > 0);
    }
    if (q) data = applyClientSearch(data, tempSearch, { skipSort: !!params.sortKey });
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [batchRows, tempSearch, params.sortDir, params.sortKey, params.status]);

  const batchItems = useMemo(() => filteredBatchRows.slice(0, displayLimit), [filteredBatchRows, displayLimit]);
  const totalItems = filteredBatchRows.length;
  const selectedBatch = useMemo(() => {
    if (!selectedBatchId) return null;
    return (
      batchRows.find((row) => row.batch_id === selectedBatchId) ??
      filteredBatchRows.find((row) => row.batch_id === selectedBatchId) ??
      null
    );
  }, [batchRows, filteredBatchRows, selectedBatchId]);

  const activeDrawerBatch = drawerBatch || selectedBatch;
  const handleLoadMore = useCallback(() => {
    if (!loading && batchItems.length < totalItems) setDisplayLimit((n) => n + 100);
  }, [loading, batchItems.length, totalItems]);

  const resolveBatchTrays = useCallback(async (batchId, { force = false } = {}) => {
    if (!batchId) return [];
    if (!force && trayCacheRef.current.has(batchId)) return trayCacheRef.current.get(batchId);
    const body = await trayService.getAll({
      view: "tray",
      page: 1,
      limit: 5000,
      sortBy: "serial_number",
      order: "ASC",
          filters: { batch_id: batchId, status: "all" },
    });
    const rows = body?.data?.data ?? body?.data ?? [];
    const list = sortTraysAsc(Array.isArray(rows) ? rows : []);
    trayCacheRef.current.set(batchId, list);
    return list;
  }, []);

  const loadBatchTrays = useCallback(async (batchId, { force = false } = {}) => {
    if (!batchId) return;

    if (!force && trayCacheRef.current.has(batchId)) {
      setBatchTrays(trayCacheRef.current.get(batchId));
      setBatchTraysLoading(false);
      return;
    }

    if (!force && trayLoadRef.current.batchId === batchId && trayLoadRef.current.promise) {
      setBatchTraysLoading(true);
      try {
        await trayLoadRef.current.promise;
      } catch {
        /* handled in source request */
      }
      return;
    }

    setBatchTraysLoading(true);
    const request = resolveBatchTrays(batchId, { force });

    trayLoadRef.current = { batchId, promise: request };

    try {
      const rows = await request;
      if (trayLoadRef.current.batchId === batchId) {
        setBatchTrays(rows);
        setSelectedTrayId(null);
      }
    } catch (err) {
      if (trayLoadRef.current.batchId === batchId) {
        toast.error(err?.message || "Failed to load trays for batch");
        setBatchTrays([]);
        setSelectedTrayId(null);
      }
    } finally {
      if (trayLoadRef.current.batchId === batchId) {
        trayLoadRef.current = { batchId: null, promise: null };
        setBatchTraysLoading(false);
      }
    }
  }, [resolveBatchTrays]);

  const closeBatchDetail = useCallback(() => {
    setBatchDetailOpen(false);
    setDrawerBatch(null);
    setSelectedTrayId(null);
  }, []);

  const clearSelection = useCallback(() => {
    clearTimeout(prefetchTimerRef.current);
    setSelectedBatchId(null);
    setDrawerBatch(null);
    setSelectedTrayId(null);
    setBatchDetailOpen(false);
    setBatchTrays([]);
    setBatchTraysLoading(false);
  }, []);

  const handleBatchSelect = useCallback(
    (batchId) => {
      if (!batchId) {
        clearSelection();
        return;
      }
      setSelectedBatchId(batchId);
      const cached = trayCacheRef.current.get(batchId);
      if (cached) {
        setBatchTrays(cached);
        return;
      }
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = setTimeout(() => {
        void loadBatchTrays(batchId);
      }, 320);
    },
    [clearSelection, loadBatchTrays]
  );

  const handleBatchOpen = useCallback(
    (row) => {
      const batchId = row?.batch_id;
      if (!batchId) return;
      clearTimeout(prefetchTimerRef.current);
      setSelectedBatchId(batchId);
      setDrawerBatch(row);
      setBatchDetailOpen(true);
      const cached = trayCacheRef.current.get(batchId);
      if (cached) {
        setBatchTrays(cached);
        setBatchTraysLoading(false);
      }
      void loadBatchTrays(batchId);
    },
    [loadBatchTrays]
  );

  useEffect(() => {
    if (!batchDetailOpen || !selectedBatchId) return;
    const next = batchRows.find((row) => row.batch_id === selectedBatchId);
    if (next) setDrawerBatch(next);
  }, [batchRows, selectedBatchId, batchDetailOpen]);

  const refreshBatchDetail = useCallback(async () => {
    if (selectedBatchId) {
      trayCacheRef.current.delete(selectedBatchId);
      await loadBatchTrays(selectedBatchId, { force: true });
    }
    await fetchTrays();
  }, [selectedBatchId, loadBatchTrays, fetchTrays]);

  const handleBatchDeleted = useCallback(async () => {
    clearSelection();
    await fetchTrays();
  }, [clearSelection, fetchTrays]);

  const getSelectedBatchRow = useCallback(
    () => batchRows.find((row) => row.batch_id === selectedBatchId) ?? selectedBatch,
    [batchRows, selectedBatchId, selectedBatch]
  );

  const openBatchEdit = useCallback(
    (row) => {
      const batch = row || getSelectedBatchRow();
      if (!batch?.batch_id) return;
      setEditBatch(batch);
      setModalMode("edit");
      setModalOpen(true);
    },
    [getSelectedBatchRow]
  );

  const handleModalSuccess = useCallback(
    async (result) => {
      await fetchTrays();

      if (modalMode === "add") {
        const batchRow = buildBatchRowFromCreate(result);
        if (!batchRow?.batch_id) {
          clearSelection();
          return;
        }
        clearTimeout(prefetchTimerRef.current);
        setSelectedBatchId(batchRow.batch_id);
        setDrawerBatch(batchRow);
        setBatchDetailOpen(true);
        setSelectedTrayId(null);
        trayCacheRef.current.delete(batchRow.batch_id);
        await loadBatchTrays(batchRow.batch_id, { force: true });
        return;
      }

      const nextBatchId = result?.batch_id || editBatch?.batch_id || selectedBatchId;
      if (nextBatchId) {
        if (nextBatchId !== selectedBatchId) {
          setSelectedBatchId(nextBatchId);
        }
        trayCacheRef.current.delete(editBatch?.batch_id);
        trayCacheRef.current.delete(nextBatchId);
        if (batchDetailOpen) {
          await loadBatchTrays(nextBatchId, { force: true });
        }
      }
      setEditBatch(null);
    },
    [modalMode, fetchTrays, loadBatchTrays, clearSelection, editBatch?.batch_id, selectedBatchId, batchDetailOpen]
  );

  const typeLabelMap = useMemo(() => {
    const map = new Map();
    (typeOptions || []).forEach((row) => map.set(row.code, row.label));
    return map;
  }, [typeOptions]);

  const formatTypeLabel = useCallback(
    (code) => {
      const type = String(code || "").trim().toUpperCase();
      if (!type) return "—";
      const label = typeLabelMap.get(type);
      return label ? `${type} · ${label}` : type;
    },
    [typeLabelMap]
  );

  const trayBatchSelectionLabel = useCallback(
    (r) =>
      `Selected: ${r?.batch_id ?? "—"} | ${formatTypeLabel(r?.type)} · Double-click to open trays`,
    [formatTypeLabel]
  );

  const openBatchApprove = useCallback(
    (row) => {
      const batch = row || getSelectedBatchRow();
      if (!batch?.batch_id) return;
      if (getBatchPendingCount(batch) <= 0) {
        toast.info("This batch is already authorized. Edit it before approving again.");
        return;
      }
      setEditBatch(batch);
      setModalMode("approve");
      setModalOpen(true);
    },
    [getSelectedBatchRow]
  );

  const batchFullyAuthorized = useMemo(() => {
    if (!selectedBatch) return false;
    return Number(selectedBatch.pending_count || 0) === 0 && Number(selectedBatch.active_count || 0) > 0;
  }, [selectedBatch]);

  const fetchAllPrintableTrays = useCallback(async () => {
    const filters = {
      status: "active",
      approved: true,
      ...(params.type !== "all" && { type: params.type }),
    };
    const { data } = await fetchAllListPages(async (page, limit) => {
      const body = await trayService.getAll({
        view: "tray",
        page,
        limit,
        sortBy: "serial_number",
        order: "ASC",
        filters,
      });
      const list = body?.data?.data ?? body?.data ?? [];
      return {
        data: Array.isArray(list) ? list : [],
        total: body?.data?.total ?? body?.total ?? 0,
      };
    }, params.pageSize);
    return sortTraysAsc(data.filter(isTrayPrintable));
  }, [params.pageSize, params.type]);

  const handleBatchPrintQr = useCallback(async () => {
    if (!selectedBatchId || !batchFullyAuthorized) {
      toast.info("Select an authorized batch to print QR.");
      return;
    }
    setPrintBusy(true);
    try {
      const rows = await resolveBatchTrays(selectedBatchId);
      const printable = sortTraysAsc(rows.filter(isTrayPrintable));
      if (!printable.length) {
        toast.info("No printable trays in this batch.");
        return;
      }
      const result = await runTrayLabelBulkExport("print", printable);
      if (result.ok) toast.success(`Printing ${result.count} label(s)...`);
      else if (result.reason === "popup") toast.error("Allow pop-ups for this site.");
    } catch (err) {
      toast.error(err?.message || "Print failed");
    } finally {
      setPrintBusy(false);
    }
  }, [batchFullyAuthorized, resolveBatchTrays, selectedBatchId]);

  const openBulkQr = useCallback(async () => {
    setBulkQrOpen(true);
    setBulkQrLoading(true);
    try {
      const rows = await fetchAllPrintableTrays();
      setBulkQrTrays(rows);
    } catch (err) {
      toast.error(err?.message || "Failed to load trays");
      setBulkQrTrays([]);
    } finally {
      setBulkQrLoading(false);
    }
  }, [fetchAllPrintableTrays]);

  const { openNewModal, openEditModal, openApproveModal, openPrintModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "tray_master",
    modalOpen: modalOpen || batchDetailOpen || !!deleteBatchItem || bulkQrOpen,
    selectedId: selectedBatchId,
    getSelectedRow: getSelectedBatchRow,
    openAdd: useCallback(() => {
      setEditBatch(null);
      setModalMode("add");
      setModalOpen(true);
    }, []),
    openEdit: openBatchEdit,
    openApprove: openBatchApprove,
    canApproveSelection: useCallback(
      () => Boolean(selectedBatchId && selectedBatch && Number(selectedBatch.pending_count || 0) > 0),
      [selectedBatchId, selectedBatch]
    ),
    onApproveBlocked: useCallback(() => {
      if (batchFullyAuthorized) {
        toast.info("This batch is already authorized. Edit it before approving again.");
        return;
      }
      toast.info("Select a pending batch to open approve (Ctrl+A).");
    }, [batchFullyAuthorized]),
    openDelete: useCallback((row) => setDeleteBatchItem(row || getSelectedBatchRow()), [getSelectedBatchRow]),
    canDeleteSelection: useCallback(() => Boolean(selectedBatchId), [selectedBatchId]),
    onPrint: useCallback(() => void handleBatchPrintQr(), [handleBatchPrintQr]),
    canPrintSelection: useCallback(
      () => Boolean(selectedBatchId && batchFullyAuthorized),
      [batchFullyAuthorized, selectedBatchId]
    ),
    printBlockedMessage: "Select an authorized batch to print QR (Ctrl+Alt+P).",
    printModule: "tray_master",
  });

  const BATCH_HEADERS = [
    ["Batch", "batch_id", (v) => <span className="font-mono font-black text-indigo-600 text-[11px]">{v || "—"}</span>, { fixed: true, width: "200px" }],
    ["Type", "type", (v) => <span className="font-bold text-slate-800 text-[11px]">{formatTypeLabel(v)}</span>, { width: "150px" }],
    ["Qty", "tray_count", (v) => <span className="font-bold text-slate-800 text-[11px]">{v ?? 0}</span>, { width: "70px", align: "center" }],
    ["Status", "status", (_v, row) => batchStatusBadge(row), { width: "110px" }],
    ["Remark", "remark", (v) => <span className="text-[10px] text-slate-600 line-clamp-2">{v || "—"}</span>, { width: "180px" }],
    ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400">{formatDateTime(v)}</span>, { width: "140px" }],
    ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Updated At", "updated_at", (v, row) => <span className="text-[10px] text-slate-400">{row?.updated_by_name ? formatDateTime(v) : "—"}</span>, { width: "140px" }],
    ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400">{formatDateTime(v)}</span>, { width: "140px" }],
  ];

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Tray Master Batches",
    rows: filteredBatchRows,
    headers: BATCH_HEADERS,
  });

  const typeFilterOptions = useMemo(
    () => [{ label: "All Types", value: "all" }, ...(typeOptions || []).map((row) => ({ label: `${row.code} - ${row.label}`, value: row.code }))],
    [typeOptions]
  );

  const handleFilterApply = (data) => {
    setParams((prev) => ({
      ...prev,
      type: data.trayType || prev.type,
      status: data.approvedStatus || prev.status,
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams({ pageSize: 1000, sortKey: "created_at", sortDir: "desc", type: "all", status: "all" });
  };

  const extraFilters = [
    { label: "Type", key: "trayType", value: params.type, options: typeFilterOptions },
    {
      label: "Status",
      key: "approvedStatus",
      value: params.status,
      options: [
        { label: "All Status", value: "all" },
        { label: "Authorized", value: "approved" },
        { label: "Pending", value: "pending" },
      ],
    },
  ];

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
                <ActionButton module="tray_master" action="add" label="New" icon={Plus} onClick={openNewModal} title="Ctrl+Alt+N" className={IMS_BTN} />
                <ActionButton module="tray_master" action="edit" variant="outline" label="Edit" icon={Edit3} disabled={!selectedBatch} record={selectedBatch} onClick={() => openEditModal()} className={IMS_OUT} />
                <ActionButton module="tray_master" action="authorize" variant="outline" label="Approve" icon={CheckCircle} disabled={!selectedBatch || batchFullyAuthorized} onClick={() => openApproveModal()} className={`${IMS_OUT} text-emerald-600`} />
                <ActionButton module="tray_master" action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selectedBatch || !getBatchNonDeletedCount(selectedBatch) || Number(selectedBatch.in_use_count) > 0}
                title={Number(selectedBatch?.in_use_count) > 0 ? "Cannot delete. A tray in this batch is already in use." : undefined} onClick={() => setDeleteBatchItem(selectedBatch)} className={IMS_BTN} />
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
                <PrintActionButton module="tray_master" variant="outline" label="Print QR" icon={Printer} disabled={!selectedBatch || !batchFullyAuthorized || printBusy} onClick={() => void handleBatchPrintQr()} title="Print all QR labels in selected batch (Ctrl+Alt+P)" className={IMS_OUT} />
                <ActionButton module="tray_master" action="view" variant="outline" label="Bulk QR" icon={Layers} onClick={() => void openBulkQr()} title="Select multiple trays — print or download QR labels" className={IMS_OUT} />
                <button type="button" onClick={() => fetchTrays()} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none">
                  <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                  <span className="hidden xs:inline">Refresh</span>
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

        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            showDate={false}
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search code, type, batch..."
            searchLabel="Search Database"
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={BATCH_HEADERS}
            data={batchItems}
            loading={loading}
            viewMode={viewMode}
            allowCopy={true}
            {...tableHotkeyProps}
            hotkeysDisabled={modalOpen || batchDetailOpen || !!deleteBatchItem || bulkQrOpen}
            showSelection={true}
            emptyIcon={Download}
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
            selectedId={selectedBatchId}
            onSelect={handleBatchSelect}
            onRowDoubleClick={handleBatchOpen}
            getRowId={(item) => item.batch_id}
            onLoadMore={handleLoadMore}
            hasMore={batchItems.length < totalItems}
            totalItems={totalItems}
            cardConfig={{
              titleKey: "batch_id",
              badgeIndices: [3],
              detailIndices: [1, 2, 5, 7, 9],
              footerKey: "created_at",
              className: "rounded-none border border-slate-200 shadow-none",
            }}
          />
        </div>

        <MasterListFooter
          shown={batchItems.length}
          total={totalItems}
          noun="Batches"
          selected={selectedBatchId}
          selectedRecord={selectedBatch}
          selectionLabel={trayBatchSelectionLabel}
          onClearSelection={clearSelection}
        />
      </div>

      <TrayBatchDrawer
        isOpen={batchDetailOpen}
        onClose={closeBatchDetail}
        batch={activeDrawerBatch}
        formatTypeLabel={formatTypeLabel}
        trays={batchTrays}
        loading={batchTraysLoading}
        viewMode={viewMode}
        selectedTrayId={selectedTrayId}
        onSelectTray={setSelectedTrayId}
        onUpdated={refreshBatchDetail}
        hotkeysDisabled={modalOpen || !!deleteBatchItem}
      />

      {modalOpen ? (
        <TrayModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditBatch(null);
            setModalMode("add");
          }}
          onSuccess={handleModalSuccess}
          editData={editBatch}
          mode={modalMode}
          typeOptions={typeOptions}
          stackLevel={batchDetailOpen ? 1 : 0}
        />
      ) : null}

      {deleteBatchItem ? (
        <DeleteModal
          item={deleteBatchItem}
          onClose={() => setDeleteBatchItem(null)}
          onSuccess={handleBatchDeleted}
          service={batchDeleteService}
          entityLabel="Tray Batch"
          idKey="batch_id"
          titleKey="batch_id"
          warningMessage={`This will delete all ${getBatchNonDeletedCount(deleteBatchItem)} tray(s) in batch ${deleteBatchItem.batch_id}.`}
          moduleSlug="tray_master"
        />
      ) : null}

      <TrayBulkQRDrawer
        isOpen={bulkQrOpen}
        onClose={() => setBulkQrOpen(false)}
        trays={bulkQrTrays}
        loading={bulkQrLoading}
        stackLevel={batchDetailOpen ? 1 : 0}
      />
    </div>
  );
}

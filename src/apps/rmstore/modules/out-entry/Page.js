"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Trash2, X, LogOut, ClipboardList, CheckCircle, Edit3 } from "lucide-react";
import { toast } from "react-toastify";

import { outEntryService } from "@/apps/rmstore/lib/services/outEntry";
import { getOutEntryTypeLabel } from "@/apps/rmstore/lib/constants/outEntryTypes";
import {
  RM_OUT_ENTRY_STATUS_FILTER_OPTIONS,
  buildRmOutEntryListFilters,
  isRmOutEntryScanDraft,
  rmOutEntryStatusLabel,
} from "@/apps/rmstore/lib/utils/outEntryScanStatus";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import CoilScanEntryModal from "@/apps/rmstore/modules/shared/CoilScanEntryModal";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import DataTable from "@/ui/primitives/DataTable";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import ActionButton from "@/ui/primitives/ActionButton";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { formatDateTime } from "@/platform/utils/core/utilHelper";

const MODULE = "rm_out_entry";

/** Left = Store Out register. Right = Pending (stored coils ready to out). */
const PAGE_TABS = {
  STORE_OUT: "store_out",
  PENDING: "pending",
};

export default function StoreOutPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);

  const [pageTab, setPageTab] = useState(PAGE_TABS.PENDING);
  const isStoreOut = pageTab === PAGE_TABS.STORE_OUT;

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 500,
    status: "all",
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "out_uid",
    sortDir: "desc",
  });
  const [coilParams, setCoilParams] = useState({
    pageSize: 500,
    sortKey: "coil_uid",
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
  const [coilRows, setCoilRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [seedFromCoil, setSeedFromCoil] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [approving, setApproving] = useState(false);

  const fetchOuts = useCallback(async () => {
    setLoading(true);
    try {
      const statusFilters = buildRmOutEntryListFilters(params.status);
      const base = {
        filters: {
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
          ...statusFilters,
        },
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await outEntryService.getAll({
          ...base,
          page,
          limit,
          ...(appliedSearch && { search: appliedSearch }),
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Could not load the store-out entries. Please try again.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.fromDate, params.toDate, params.status, appliedSearch]);

  const fetchStored = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await outEntryService.getStoredCoils({
          page,
          limit,
          sortBy: coilParams.sortKey,
          order: String(coilParams.sortDir || "desc").toUpperCase(),
          ...(appliedSearch && { search: appliedSearch }),
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, coilParams.pageSize);
      setCoilRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Could not load the pending coils. Please try again.");
      setCoilRows([]);
    } finally {
      setLoading(false);
    }
  }, [coilParams.pageSize, coilParams.sortKey, coilParams.sortDir, appliedSearch]);

  useEffect(() => {
    if (isStoreOut) fetchOuts();
    else fetchStored();
  }, [isStoreOut, fetchOuts, fetchStored]);

  const activeSourceRows = isStoreOut ? allRows : coilRows;
  const activeSortKey = isStoreOut ? params.sortKey : coilParams.sortKey;
  const activeSortDir = isStoreOut ? params.sortDir : coilParams.sortDir;

  const filteredRows = useMemo(() => {
    let data = activeSourceRows;
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(activeSourceRows, tempSearch, { skipSort: !!activeSortKey });
    }
    return sortRowsByKey(data, activeSortKey, activeSortDir);
  }, [activeSourceRows, tempSearch, activeSortKey, activeSortDir]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const getRowId = useCallback(
    (row) => {
      if (isStoreOut) return row.out_uid;
      if (row?.is_batch_pending && row?.mrn_uid) return `batch-${row.mrn_uid}`;
      return row.coil_uid ?? row.coil_no_uid;
    },
    [isStoreOut]
  );

  const selectedRecord = useMemo(
    () => filteredRows.find((r) => getRowId(r) === selected) || null,
    [filteredRows, selected, getRowId]
  );

  const isRowApproved = (row) =>
    row?.approved === true || row?.approved === "t" || row?.approved === 1;

  const canEditDraft =
    isStoreOut &&
    selectedRecord?.out_uid != null &&
    !isRowApproved(selectedRecord) &&
    String(selectedRecord.entry_type || "").toLowerCase() !== "rm_rejection";

  const canApprove =
    isStoreOut &&
    selectedRecord?.out_uid != null &&
    !isRowApproved(selectedRecord) &&
    !isRmOutEntryScanDraft(selectedRecord);

  const openNew = (coilRow = null) => {
    const seed =
      coilRow?.mrn_uid != null
        ? coilRow
        : !isStoreOut && selectedRecord?.mrn_uid != null
          ? selectedRecord
          : null;
    setEditItem(null);
    setSeedFromCoil(seed);
    setModalOpen(true);
  };

  const openEdit = useCallback((row) => {
    if (!row?.out_uid || isRowApproved(row)) return;
    if (String(row.entry_type || "").toLowerCase() === "rm_rejection") return;
    setSeedFromCoil(null);
    setEditItem(row);
    setModalOpen(true);
  }, []);

  const openFromPending = useCallback((row) => {
    if (!row?.mrn_uid) return;
    setEditItem(null);
    setSeedFromCoil(row);
    setModalOpen(true);
  }, []);

  const handleApprove = useCallback(async () => {
    if (!canApprove || !selectedRecord?.out_uid) return;
    setApproving(true);
    try {
      const res = await outEntryService.approve(selectedRecord.out_uid);
      toast.success(res?.message || "Store Out authorized.");
      setSelected(null);
      await fetchOuts();
      await fetchStored();
    } catch (err) {
      toast.error(err?.message || "Could not authorize the store-out entry. Please try again.");
    } finally {
      setApproving(false);
    }
  }, [canApprove, selectedRecord, fetchOuts, fetchStored]);

  const STORE_OUT_HEADERS = useMemo(
    () => [
      ["Out UID", "out_uid", (v) => <span className="font-bold text-indigo-600 text-[10px]">{v}</span>, { fixed: true, width: "90px" }],
      [
        "Type",
        "entry_type",
        (v) => {
          const label = getOutEntryTypeLabel(v);
          const isRejection = String(v || "").toLowerCase() === "rm_rejection";
          return (
            <span
              className={`px-2 py-0.5 text-[9px] font-black uppercase border ${
                isRejection
                  ? "bg-rose-50 text-rose-700 border-rose-100"
                  : "bg-indigo-50 text-indigo-700 border-indigo-100"
              }`}
            >
              {label}
            </span>
          );
        },
        { width: "120px" },
      ],
      ["MRN Refs", "mrn_refs", (v) => <span className="font-bold text-slate-800 text-[10px]">{v || "—"}</span>, { width: "120px" }],
      ["Heat Nos", "heat_nos", (v) => <span className="font-mono text-[10px] font-bold text-amber-700">{v || "—"}</span>, { width: "140px" }],
      ["Item Codes", "item_codes", (v) => <span className="text-slate-700 text-[10px] uppercase">{v || "—"}</span>, { width: "160px" }],
      ["Locations", "location_refs", (v) => <span className="text-[10px] font-bold text-emerald-800">{v || "—"}</span>, { width: "120px" }],
      ["Total Qty", "total_qty", (v) => (
        <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px] tabular-nums">
          {v != null ? Number(v).toLocaleString() : "0"}
        </span>
      ), { width: "100px" }],
      ["Coils", "coil_count", (v) => <span className="font-bold tabular-nums text-[11px]">{v ?? 0}</span>, { width: "70px" }],
      ["Remarks", "remarks", (v) => <span className="text-slate-500 text-[10px] truncate block">{v || "—"}</span>, { width: "160px" }],
      [
        "Status",
        "approved",
        (_v, row) => {
          const { text, className } = rmOutEntryStatusLabel(row);
          return (
            <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${className}`}>
              ● {text}
            </span>
          );
        },
        { width: "120px" },
      ],
      ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400">{formatDateTime(v)}</span>, { width: "150px" }],
    ],
    []
  );

  const PENDING_HEADERS = useMemo(
    () => [
      [
        "Coil UID",
        "coil_no_uid",
        (v, row) => (
          <span
            className="font-mono font-bold text-indigo-600 text-[10px] truncate block"
            title={v || ""}
          >
            {row?.is_batch_pending ? `Batch · ${row.mrn_no ?? row.mrn_uid ?? "—"}` : v || "—"}
          </span>
        ),
        { fixed: true, width: "200px" },
      ],
      [
        "Mode",
        "sticker_mode",
        (v) => {
          const batch = String(v || "coil").toLowerCase() === "batch";
          return (
            <span
              className={`px-2 py-0.5 text-[9px] font-black uppercase border ${
                batch
                  ? "bg-violet-50 text-violet-700 border-violet-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              {batch ? "Batch" : "Coil"}
            </span>
          );
        },
        { width: "90px" },
      ],
      [
        "Coil Count",
        "coil_count",
        (v, row) => (
          <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded bg-indigo-50 text-indigo-700 text-[10px] font-black tabular-nums border border-indigo-100">
            {v != null && v !== "" ? Number(v) : row?.is_batch_pending ? 0 : 1}
          </span>
        ),
        { width: "100px" },
      ],
      ["MRN", "mrn_no", (v) => <span className="font-bold text-[11px]">{v ?? "—"}</span>, { width: "80px" }],
      ["Heat", "heat_no", (v) => <span className="font-mono text-[10px] font-bold text-amber-700">{v || "—"}</span>, { width: "110px" }],
      ["Item", "item_code", (v) => <span className="font-bold text-[11px] uppercase">{v || "—"}</span>, { width: "120px" }],
      ["Location", "location_no", (v) => <span className="text-[10px] font-bold text-emerald-800">{v || "—"}</span>, { width: "110px" }],
      ["Qty", "qty", (v) => <span className="font-black text-emerald-700 text-[11px] tabular-nums">{v != null ? Number(v).toLocaleString() : "—"}</span>, { width: "80px" }],
      ["Created", "created_at", (v) => <span className="text-[10px] text-slate-400">{formatDateTime(v)}</span>, { width: "150px" }],
    ],
    []
  );

  const headers = isStoreOut ? STORE_OUT_HEADERS : PENDING_HEADERS;

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isStoreOut ? "RM Store Out" : "RM Pending Store Out",
    rows: filteredRows,
    headers,
  });

  const handleTabChange = (tab) => {
    setPageTab(tab);
    setSelected(null);
    resetSearch();
    setDisplayLimit(100);
  };

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <ImsSegmentedTabs
                className="mr-2"
                active={pageTab}
                onChange={handleTabChange}
                tabs={[
                  { id: PAGE_TABS.STORE_OUT, label: "Store Out", icon: LogOut },
                  { id: PAGE_TABS.PENDING, label: "Pending", icon: ClipboardList },
                ]}
              />
            }
            actions={
              <>
                <ActionButton
                  module={MODULE}
                  action="add"
                  label="New"
                  icon={Plus}
                  onClick={() => openNew()}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />
                {isStoreOut && (
                  <>
                    <ActionButton
                      module={MODULE}
                      action="edit"
                      variant="outline"
                      label="Edit"
                      icon={Edit3}
                      disabled={!canEditDraft}
                      onClick={() => openEdit(selectedRecord)}
                      className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                    />
                    <ActionButton
                      module={MODULE}
                      action="authorize"
                      variant="outline"
                      label="Approve"
                      icon={CheckCircle}
                      disabled={!canApprove || approving}
                      record={selectedRecord}
                      onClick={() => void handleApprove()}
                      className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                    />
                    <ActionButton
                      module={MODULE}
                      action="delete"
                      variant="danger"
                      label="Delete"
                      icon={Trash2}
                      disabled={!selectedRecord}
                      onClick={() => setDeleteItem(selectedRecord)}
                      className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                    />
                  </>
                )}
                <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1 shrink-0" />
                <button
                  type="button"
                  onClick={() => (isStoreOut ? fetchOuts() : fetchStored())}
                  className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center transition-all shrink-0"
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
          {selectedRecord && isStoreOut && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase truncate">
                Selected: OUT-{selectedRecord.out_uid}
                {isRmOutEntryScanDraft(selectedRecord) ? " · DRAFT" : ""}
              </span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          )}
          {selectedRecord && !isStoreOut && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase truncate">
                Selected:{" "}
                {selectedRecord.is_batch_pending
                  ? `Batch MRN ${selectedRecord.mrn_no ?? selectedRecord.mrn_uid} · ${selectedRecord.coil_count ?? 0} coils`
                  : selectedRecord.coil_no_uid}
                {selectedRecord.mrn_uid && !selectedRecord.is_batch_pending
                  ? ` · MRN ${selectedRecord.mrn_uid}`
                  : ""}
                {" · New will load full MRN"}
              </span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            showDate={isStoreOut}
            fromDate={params.fromDate}
            toDate={params.toDate}
            extraFilters={
              isStoreOut
                ? [{
                    label: "Status",
                    key: "approvedStatus",
                    value: params.status,
                    options: RM_OUT_ENTRY_STATUS_FILTER_OPTIONS,
                  }]
                : []
            }
            onApply={(data) => {
              applySearchFromInput();
              if (isStoreOut) {
                setParams((prev) => ({
                  ...prev,
                  fromDate: data.fromDate,
                  toDate: data.toDate,
                  status: data.approvedStatus || prev.status,
                }));
              }
            }}
            onReset={() => {
              resetSearch();
              if (isStoreOut) {
                setParams({
                  pageSize: 500,
                  status: "all",
                  fromDate: dateFilterDefaults.from,
                  toDate: dateFilterDefaults.to,
                  sortKey: "out_uid",
                  sortDir: "desc",
                });
              } else {
                setCoilParams({ pageSize: 500, sortKey: "coil_uid", sortDir: "desc" });
              }
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder={isStoreOut ? "Search by MRN, heat, or item" : "Search by coil UID, heat, or item"}
            searchLabel={isStoreOut ? "Search Store Out" : "Search Pending"}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={headers}
            data={items}
            loading={loading}
            viewMode={viewMode}
            allowCopy
            showSelection
            emptyIcon={isStoreOut ? LogOut : ClipboardList}
            sortKey={activeSortKey ?? ""}
            sortDir={activeSortDir}
            onSort={(key) => {
              setDisplayLimit(100);
              if (isStoreOut) {
                setParams((p) => ({
                  ...p,
                  sortKey: key,
                  sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                }));
              } else {
                setCoilParams((p) => ({
                  ...p,
                  sortKey: key,
                  sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                }));
              }
            }}
            selectedId={selected}
            onSelect={setSelected}
            getRowId={getRowId}
            onRowDoubleClick={isStoreOut ? (row) => openEdit(row) : (row) => openFromPending(row)}
            onLoadMore={() => {
              if (!loading && items.length < totalItems) setDisplayLimit((n) => n + 100);
            }}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} — {isStoreOut ? "Store Out" : "Pending"}
          </span>
        </div>
      </div>

      <CoilScanEntryModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditItem(null);
          setSeedFromCoil(null);
        }}
        onSuccess={() => {
          fetchOuts();
          fetchStored();
        }}
        mode="out"
        editItem={editItem}
        seedFromCoil={seedFromCoil}
        scannerElementId="rm-store-out-scanner"
      />

      {deleteItem && (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={() => {
            fetchOuts();
            fetchStored();
            setSelected(null);
          }}
          service={outEntryService}
          entityLabel="Store Out"
          idKey="out_uid"
          moduleSlug={MODULE}
        />
      )}
    </div>
  );
}

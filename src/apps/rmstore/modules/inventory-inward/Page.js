"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Trash2, X, Warehouse, PackageOpen, Locate, List, Boxes, Edit3 } from "lucide-react";
import { toast } from "react-toastify";

import { inventoryInwardService } from "@/apps/rmstore/lib/services/inventoryInward";
import { inProcessRequestService } from "@/apps/rmstore/lib/services/inProcessRequest";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import InwardModal from "./InwardModal";
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
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { pipeMetaRenderers } from "@/apps/ims/lib/helpers/pipeMetaDisplay";
import LocationFinderDrawer from "@/apps/rmstore/modules/store-location/LocationFinderDrawer";

const MODULE = "rm_inventory_inwards";

const PAGE_TABS = {
  STORE_IN: "store_in",
  PACKING_AREA: "coil_area",
};

const PACKING_VIEWS = {
  SUMMARY: "summary",
  COILS: "coils",
};

export default function StoreInPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);

  const [pageTab, setPageTab] = useState(PAGE_TABS.PACKING_AREA);
  const isStoreIn = pageTab === PAGE_TABS.STORE_IN;

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 500,
    status: "all",
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "in_uid",
    sortDir: "desc",
  });
  const [packingView, setPackingView] = useState(PACKING_VIEWS.SUMMARY);
  const [packingFilterMrn, setPackingFilterMrn] = useState("");
  const [mrnParams, setMrnParams] = useState({
    pageSize: 500,
    sortKey: "mrn_no",
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
  const [mrnRows, setMrnRows] = useState([]);
  const [coilRows, setCoilRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [finderOpen, setFinderOpen] = useState(false);
  const [pendingStoreInReturns, setPendingStoreInReturns] = useState([]);

  const isPackingCoilView = !isStoreIn && packingView === PACKING_VIEWS.COILS;

  const fetchPendingStoreInReturns = useCallback(async () => {
    try {
      const res = await inProcessRequestService.getPendingStoreIn();
      setPendingStoreInReturns(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setPendingStoreInReturns([]);
    }
  }, []);

  useEffect(() => {
    if (isStoreIn) fetchPendingStoreInReturns();
  }, [isStoreIn, fetchPendingStoreInReturns]);

  const fetchInwards = useCallback(async () => {
    setLoading(true);
    try {
      const base = {
        filters: {
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
          ...(params.status !== "all" && { approved: params.status === "approved" }),
        },
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await inventoryInwardService.getAll({
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
      toast.error(err?.message || "Could not load the store-in entries. Please try again.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.fromDate, params.toDate, params.status, appliedSearch]);

  const fetchPackingByMrn = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await inventoryInwardService.getPackingAreaList({
          page,
          limit,
          sortBy: mrnParams.sortKey,
          order: String(mrnParams.sortDir || "desc").toUpperCase(),
          ...(appliedSearch && { search: appliedSearch }),
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, mrnParams.pageSize);
      setMrnRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Could not load the unassigned coils. Please try again.");
      setMrnRows([]);
    } finally {
      setLoading(false);
    }
  }, [mrnParams.pageSize, mrnParams.sortKey, mrnParams.sortDir, appliedSearch]);

  const fetchPackingCoils = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await inventoryInwardService.getCoilArea({
          page,
          limit,
          sortBy: coilParams.sortKey,
          order: String(coilParams.sortDir || "desc").toUpperCase(),
          ...(packingFilterMrn ? { mrn_uid: packingFilterMrn } : {}),
          ...(appliedSearch && { search: appliedSearch }),
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, coilParams.pageSize);
      setCoilRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Could not load the unassigned coils. Please try again.");
      setCoilRows([]);
    } finally {
      setLoading(false);
    }
  }, [coilParams.pageSize, coilParams.sortKey, coilParams.sortDir, packingFilterMrn, appliedSearch]);

  useEffect(() => {
    if (isStoreIn) fetchInwards();
    else if (isPackingCoilView) fetchPackingCoils();
    else fetchPackingByMrn();
  }, [isStoreIn, isPackingCoilView, fetchInwards, fetchPackingByMrn, fetchPackingCoils]);

  const activeSourceRows = isStoreIn ? allRows : isPackingCoilView ? coilRows : mrnRows;
  const activeSortKey = isStoreIn
    ? params.sortKey
    : isPackingCoilView
      ? coilParams.sortKey
      : mrnParams.sortKey;
  const activeSortDir = isStoreIn
    ? params.sortDir
    : isPackingCoilView
      ? coilParams.sortDir
      : mrnParams.sortDir;

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
      if (isStoreIn) return row.in_uid;
      if (isPackingCoilView) return row.coil_uid;
      return row.mrn_uid;
    },
    [isStoreIn, isPackingCoilView]
  );

  const selectedRecord = useMemo(
    () => filteredRows.find((r) => String(getRowId(r)) === String(selected)) || null,
    [filteredRows, selected, getRowId]
  );

  const getSelectedRow = useCallback(
    () => (isStoreIn ? filteredRows.find((r) => String(r.in_uid) === String(selected)) || null : null),
    [filteredRows, selected, isStoreIn]
  );

  const { openNewModal, openEditModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: modalOpen || finderOpen || !!deleteItem,
    selectedId: isStoreIn ? selected : null,
    getSelectedRow,
    openAdd: useCallback(() => {
      setEditItem(null);
      setModalMode("add");
      setModalOpen(true);
    }, []),
    openEdit: useCallback((row) => {
      if (!isStoreIn || !row) return;
      setEditItem(row);
      setModalMode("edit");
      setModalOpen(true);
    }, [isStoreIn]),
    openDelete: useCallback((row) => {
      if (!isStoreIn || !row) return;
      setDeleteItem(row);
    }, [isStoreIn]),
    canDeleteSelection: useCallback(() => Boolean(isStoreIn && selected), [isStoreIn, selected]),
  });

  const handleTabChange = (tab) => {
    setPageTab(tab);
    setPackingView(PACKING_VIEWS.SUMMARY);
    setPackingFilterMrn("");
    setSelected(null);
    resetSearch();
    setDisplayLimit(100);
  };

  const handlePackingViewChange = (view) => {
    setPackingView(view);
    setPackingFilterMrn("");
    setSelected(null);
    setDisplayLimit(100);
  };

  const openCoilsForSelectedMrn = () => {
    const row = selectedRecord;
    if (!row?.mrn_uid) return;
    setPackingFilterMrn(String(row.mrn_uid).trim());
    setPackingView(PACKING_VIEWS.COILS);
    setSelected(null);
    setDisplayLimit(100);
  };

  const handleRefresh = () => {
    if (isStoreIn) fetchInwards();
    else if (isPackingCoilView) fetchPackingCoils();
    else fetchPackingByMrn();
  };

  const inMrnMeta = pipeMetaRenderers("font-bold text-slate-800 text-[10px] leading-tight");
  const inItemMeta = pipeMetaRenderers("text-slate-600 text-[10px] font-medium leading-tight");
  const inQtyMeta = pipeMetaRenderers("text-emerald-700 text-[10px] font-bold tabular-nums leading-tight");

  const STORE_IN_HEADERS = [
      ["Store In UID", "in_uid", (v) => <span className="font-bold text-indigo-600 text-[10px]">{v}</span>, { fixed: true, width: "100px" }],
      [
        "MRN Refs",
        "mrn_refs",
        inMrnMeta.table,
        { fixed: true, width: "140px", cardRender: inMrnMeta.card, copyValue: inMrnMeta.copyValue },
      ],
      [
        "Heat Nos",
        "heat_nos",
        (v) => <span className="font-mono text-[10px] font-bold text-amber-700">{v || "—"}</span>,
        { width: "140px" },
      ],
      [
        "Item Code",
        "item_codes",
        inItemMeta.table,
        { width: "160px", cardRender: inItemMeta.card, copyValue: inItemMeta.copyValue },
      ],
      [
        "Qty",
        "qtys",
        inQtyMeta.table,
        { width: "100px", cardRender: inQtyMeta.card, copyValue: inQtyMeta.copyValue },
      ],
      [
        "Total Qty",
        "total_qty",
        (v) => (
          <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px] tabular-nums">
            {v != null ? Number(v).toLocaleString() : "0"}
          </span>
        ),
        { width: "100px" },
      ],
      ["Coils", "coil_count", (v) => <span className="font-bold tabular-nums text-[11px]">{v ?? 0}</span>, { width: "70px" }],
      ["Remarks", "remarks", (v) => <span className="text-slate-500 text-[10px] truncate block">{v || "—"}</span>, { width: "180px" }],
      [
        "Status",
        "approved",
        (v) => (
          <span
            className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}
          >
            {v ? "● AUTHORIZED" : "○ PENDING"}
          </span>
        ),
        { width: "120px" },
      ],
      ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
      ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
      ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
      ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ];

  const PACKING_BY_MRN_HEADERS = [
      [
        "MRN",
        "mrn_no",
        (v) => <span className="font-mono font-bold text-slate-800 text-[10px] tracking-tight">{v ?? "—"}</span>,
        { fixed: true, width: "90px" },
      ],
      [
        "MRN UID",
        "mrn_uid",
        (v) => <span className="font-mono font-bold text-slate-700 text-[10px] tracking-tight">{v || "—"}</span>,
        { width: "160px" },
      ],
      [
        "Heat",
        "heat_nos",
        (v) => <span className="font-mono text-[10px] font-bold text-amber-700">{v || "—"}</span>,
        { width: "140px" },
      ],
      [
        "Item Details",
        "item_code",
        (v) => (
          <span className="text-slate-700 font-medium text-[10px] uppercase truncate" title={v || ""}>
            {v || "—"}
          </span>
        ),
      ],
      [
        "Quantity",
        "stock_qty",
        (v) => (
          <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px] tabular-nums">
            {v != null ? Number(v).toLocaleString() : "0"}
          </span>
        ),
        { width: "100px" },
      ],
      [
        "Unassigned Coils",
        "coil_count",
        (v, row) => {
          const count = Number(v) || 0;
          const total = Number(row?.total_coils) || 0;
          if (count === 0) return <span className="text-slate-300 text-[11px] font-medium">0</span>;
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase border bg-amber-50 text-amber-700 border-amber-200 tabular-nums">
              <Boxes size={10} />
              {total > 0 ? `${count}/${total}` : count}
            </span>
          );
        },
        { width: "130px" },
      ],
      ["Created By", "created_by", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ];

  const PACKING_BY_COIL_HEADERS = [
      [
        "Coil UID",
        "coil_no_uid",
        (v) => <span className="font-mono font-bold text-indigo-600 text-[10px] tracking-tight">{v || "—"}</span>,
        { fixed: true, width: "200px" },
      ],
      ["MRN", "mrn_no", (v) => <span className="font-bold text-slate-800 text-[11px]">{v ?? "—"}</span>, { width: "80px" }],
      [
        "Heat",
        "heat_no",
        (v) => <span className="font-mono text-[10px] font-bold text-amber-700">{v || "—"}</span>,
        { width: "110px" },
      ],
      [
        "Item",
        "item_code",
        (v) => (
          <span className="text-slate-500 text-[10px] uppercase truncate" title={v || ""}>
            {v || "—"}
          </span>
        ),
        { width: "140px" },
      ],
      [
        "Qty",
        "qty",
        (v) => (
          <span className="font-black text-emerald-700 text-[11px] tabular-nums">
            {v != null ? Number(v).toLocaleString() : "—"}
          </span>
        ),
        { width: "80px" },
      ],
      [
        "Index",
        "coil_index",
        (v, row) => (
          <span className="text-[10px] font-bold text-slate-600 tabular-nums">
            {v ?? "—"}/{row?.total_coils ?? "—"}
          </span>
        ),
        { width: "90px" },
      ],
      [
        "Created At",
        "created_at",
        (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>,
        { width: "150px" },
      ],
  ];

  const headers = isStoreIn
    ? STORE_IN_HEADERS
    : isPackingCoilView
      ? PACKING_BY_COIL_HEADERS
      : PACKING_BY_MRN_HEADERS;

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isStoreIn
      ? "RM Store In"
      : isPackingCoilView
        ? "RM Unassigned Coils"
        : "RM Unassigned",
    rows: filteredRows,
    headers,
  });

  const extraFilters = useMemo(
    () =>
      isStoreIn
        ? [{
            label: "Status",
            key: "approvedStatus",
            value: params.status,
            options: [
              { label: "All Status", value: "all" },
              { label: "Approved", value: "approved" },
              { label: "Pending", value: "pending" },
            ],
          }]
        : [],
    [isStoreIn, params.status]
  );

  const handleSort = (key) => {
    setDisplayLimit(100);
    if (isStoreIn) {
      setParams((p) => ({
        ...p,
        sortKey: key,
        sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
      }));
    } else if (isPackingCoilView) {
      setCoilParams((p) => ({
        ...p,
        sortKey: key,
        sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
      }));
    } else {
      setMrnParams((p) => ({
        ...p,
        sortKey: key,
        sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
      }));
    }
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
                  { id: PAGE_TABS.STORE_IN, label: "Store In", icon: Warehouse },
                  { id: PAGE_TABS.PACKING_AREA, label: "Unassigned", icon: PackageOpen },
                ]}
              />
            }
            subTabs={
              !isStoreIn ? (
                <ImsSegmentedTabs
                  className="mr-2"
                  active={packingView}
                  onChange={handlePackingViewChange}
                  tabs={[
                    { id: PACKING_VIEWS.SUMMARY, label: "By MRN", icon: List },
                    { id: PACKING_VIEWS.COILS, label: "By Coil", icon: Boxes },
                  ]}
                />
              ) : null
            }
            actions={
              <>
                <button
                  type="button"
                  onClick={() => setFinderOpen(true)}
                  className="h-9 px-4 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none shrink-0"
                >
                  <Locate size={14} className="text-indigo-600" />
                  <span>Finder</span>
                </button>

                {!isStoreIn && packingView === PACKING_VIEWS.SUMMARY && selectedRecord?.mrn_uid && (
                  <button
                    type="button"
                    onClick={openCoilsForSelectedMrn}
                    className="h-9 px-4 border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none shrink-0"
                  >
                    <Boxes size={14} />
                    View Coils
                  </button>
                )}

                <ActionButton
                  module={MODULE}
                  action="add"
                  label="New"
                  icon={Plus}
                  onClick={openNewModal}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />

                {isStoreIn && (
                  <>
                    <ActionButton
                      module={MODULE}
                      action="edit"
                      variant="outline"
                      label="Edit"
                      icon={Edit3}
                      disabled={!selectedRecord}
                      record={selectedRecord}
                      onClick={openEditModal}
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
                  onClick={handleRefresh}
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

          {selectedRecord && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase truncate">
                Selected:{" "}
                {isStoreIn
                  ? selectedRecord.mrn_refs || `IN-${selectedRecord.in_uid}`
                  : isPackingCoilView
                    ? `${selectedRecord.coil_no_uid}${
                        selectedRecord.qty != null ? ` · Qty ${Number(selectedRecord.qty).toLocaleString()}` : ""
                      }`
                    : `MRN ${selectedRecord.mrn_no ?? selectedRecord.mrn_uid}${
                        selectedRecord.coil_count != null
                          ? ` · ${selectedRecord.coil_count} coil(s) · ${Number(selectedRecord.stock_qty || 0).toLocaleString()} qty`
                          : ""
                      }`}
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

          {!isStoreIn && packingFilterMrn && isPackingCoilView && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-amber-50 border border-amber-200">
              <span className="text-[10px] font-bold text-amber-800 uppercase truncate">
                MRN {packingFilterMrn} — {totalItems} coil{totalItems === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPackingFilterMrn("");
                  setDisplayLimit(100);
                }}
                className="text-amber-600 hover:text-amber-900 flex items-center gap-1 font-bold text-[10px] uppercase shrink-0"
              >
                <X size={14} /> Show all coils
              </button>
            </div>
          )}

          {isStoreIn && pendingStoreInReturns.length > 0 && (
            <div className="px-3 py-2 bg-teal-50 border border-teal-100 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase text-teal-800">
                  Pending Store In Requests ({pendingStoreInReturns.length})
                </span>
                <button
                  type="button"
                  onClick={fetchPendingStoreInReturns}
                  className="text-[9px] font-bold uppercase text-teal-600 hover:text-teal-900"
                >
                  Refresh
                </button>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 custom-scrollbar">
                {pendingStoreInReturns.map((r) => (
                  <div
                    key={r.ipr_uid}
                    className="flex items-center justify-between gap-2 bg-white border border-teal-100 rounded px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold text-teal-900 truncate">
                        IPR #{r.ipr_uid} · {r.item_code || "—"} · MRN {r.mrn_no ?? "—"}
                      </div>
                      <div className="text-[9px] text-slate-500 tabular-nums">
                        Issued {Number(r.previous_qty || 0).toLocaleString()} · Used{" "}
                        {Number(r.consumed_qty || 0).toLocaleString()} · Return{" "}
                        {Number(r.total_qty || 0).toLocaleString()}
                        <span className="ml-1 text-slate-400">(original quantity unchanged)</span>
                      </div>
                    </div>
                    <span className="shrink-0 px-2 py-0.5 text-[8px] font-black uppercase border bg-teal-50 text-teal-700 border-teal-100">
                      Process
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            showDate={isStoreIn}
            fromDate={params.fromDate}
            toDate={params.toDate}
            extraFilters={extraFilters}
            onApply={(data) => {
              applySearchFromInput();
              if (isStoreIn) {
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
              if (isStoreIn) {
                setParams({
                  pageSize: 500,
                  status: "all",
                  fromDate: dateFilterDefaults.from,
                  toDate: dateFilterDefaults.to,
                  sortKey: "in_uid",
                  sortDir: "desc",
                });
              } else if (isPackingCoilView) {
                setPackingFilterMrn("");
                setCoilParams({ pageSize: 500, sortKey: "coil_uid", sortDir: "desc" });
              } else {
                setPackingFilterMrn("");
                setMrnParams({ pageSize: 500, sortKey: "mrn_no", sortDir: "desc" });
              }
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            onSearchEnter={() => {
              if (isStoreIn) {
                applySearchFromInput();
                setParams((prev) => ({ ...prev }));
              } else {
                applySearchFromInput();
              }
            }}
            searchPlaceholder={
              isStoreIn
                ? "Search by MRN, heat, or item"
                : isPackingCoilView
                  ? "Search by coil UID or MRN"
                  : "Search by MRN, heat, or item"
            }
            searchLabel={
              isStoreIn
                ? "Search MRN refs"
                : isPackingCoilView
                  ? "Search coil UID or MRN"
                  : "Search MRN"
            }
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col">
            <DataTable
              key={`${pageTab}-${packingView}-${viewMode}`}
              headers={headers}
              data={items}
              loading={loading}
              viewMode={viewMode}
              allowCopy
              showSelection
              emptyIcon={isStoreIn ? Warehouse : isPackingCoilView ? Boxes : PackageOpen}
              sortKey={activeSortKey ?? ""}
              sortDir={activeSortDir}
              onSort={handleSort}
              selectedId={selected}
              onSelect={setSelected}
              getRowId={getRowId}
              onLoadMore={() => {
                if (!loading && items.length < totalItems) setDisplayLimit((n) => n + 100);
              }}
              hasMore={items.length < totalItems}
              totalItems={totalItems}
              {...(isStoreIn ? tableHotkeyProps : {})}
              cardConfig={
                isStoreIn
                  ? { titleKey: "mrn_refs", badgeIndices: [8], detailKeys: ["item_codes", "qtys", "total_qty"], footerKey: "created_at" }
                  : isPackingCoilView
                    ? {
                        titleKey: "coil_no_uid",
                        badgeIndices: [4],
                        detailKeys: ["mrn_no", "heat_no", "item_code", "qty"],
                        footerKey: "created_at",
                      }
                    : {
                        titleKey: "mrn_no",
                        badgeIndices: [5],
                        detailKeys: ["mrn_uid", "heat_nos", "item_code", "stock_qty", "coil_count"],
                        footerKey: "created_at",
                      }
              }
            />
          </div>
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {isStoreIn
              ? `Showing ${items.length} of ${totalItems} store-in entries`
              : isPackingCoilView
                ? `Showing ${items.length} of ${totalItems} unassigned coils`
                : `Showing ${items.length} of ${totalItems} unassigned MRNs`}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      <InwardModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditItem(null);
          setModalMode("add");
        }}
        onSuccess={() => {
          handleRefresh();
          setSelected(null);
        }}
        mode={modalMode}
        editData={editItem}
      />

      {finderOpen && <LocationFinderDrawer open={finderOpen} onClose={() => setFinderOpen(false)} />}

      {deleteItem && (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={() => {
            handleRefresh();
            setSelected(null);
          }}
          service={inventoryInwardService}
          entityLabel="Store In Entry"
          idKey="in_uid"
          moduleSlug={MODULE}
        />
      )}
    </div>
  );
}

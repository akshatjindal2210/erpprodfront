"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Trash2, X, Warehouse, PackageOpen, Locate, List, Boxes, Edit3, CheckCircle } from "lucide-react";
import { toast } from "react-toastify";

import { inventoryInwardService } from "@/apps/rmstore/lib/services/inventoryInward";
import { inProcessRequestService } from "@/apps/rmstore/lib/services/inProcessRequest";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import InwardModal from "./InwardModal";
import ReceivePendingStoreInModal from "./ReceivePendingStoreInModal";
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
import RmStoreListFooter, { rmStoreFooterFromClientFilter } from "@/apps/rmstore/lib/helpers/RmStoreListFooter";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import LocationFinderDrawer from "@/apps/rmstore/modules/store-location/LocationFinderDrawer";
import { renderCoilLocationCell } from "@/apps/rmstore/modules/coil/coilTableVisuals";
// import { renderCoilQcIdStatusCell } from "@/apps/rmstore/modules/coil/coilTableVisuals";

const MODULE = "rm_inventory_inwards";
const IPR_MODULE = "rm_in_process_request";

const PAGE_TABS = {
  STORE_IN: "store_in",
  PACKING_AREA: "coil_area",
};

const PACKING_VIEWS = {
  SUMMARY: "summary",
  COILS: "coils",
};

const PENDING_STORE_IN_ROW = "pending_store_in";

/** SOURCE label for IPR pending store-in (consume balance or manual return). */
function iprPendingSourceLabel(ipr) {
  if (ipr?.request_type === "consume") {
    return `IPR #${ipr.ipr_uid}`;
  }
  const reason = String(ipr?.reason || "").trim();
  const fromReason = reason.match(/IPR\s*#(\d+)/i);
  if (fromReason) return `IPR #${fromReason[1]}`;
  const remarks = String(ipr?.remarks || "");
  if (remarks.startsWith("AUTO_FROM_CONSUME:")) {
    const id = remarks.split(":")[1]?.trim();
    return id ? `IPR #${id}` : "IPR CONSUME";
  }
  return "PRODUCTION RETURN";
}

function mapPendingStoreInToCoilRows(pendingRows = []) {
  return pendingRows.map((ipr) => {
    const first = ipr.coils?.[0] || {};
    return {
      row_kind: PENDING_STORE_IN_ROW,
      ipr_uid: ipr.ipr_uid,
      coil_uid: `pending-ipr-${ipr.ipr_uid}`,
      coil_no_uid: ipr.coil_label || first.coil_no_uid || `IPR-${ipr.ipr_uid}`,
      mrn_no: ipr.mrn_no ?? first.mrn_no ?? null,
      mrn_uid: ipr.mrn_uid ?? first.mrn_uid ?? null,
      heat_no: ipr.heat_no ?? first.heat_no ?? null,
      item_code: ipr.item_code ?? first.item_code ?? null,
      item_desc: ipr.item_desc ?? first.item_desc ?? null,
      qty: Number(ipr.balance_qty ?? ipr.total_qty ?? 0) || 0,
      coil_index: null,
      total_coils: ipr.coil_count ?? ipr.coils?.length ?? 0,
      reason: ipr.reason ?? null,
      remarks: ipr.remarks ?? null,
      created_at: ipr.approved_at || ipr.created_at || null,
      source: iprPendingSourceLabel(ipr),
    };
  });
}

function mapPendingStoreInToMrnRows(pendingRows = []) {
  return pendingRows.map((ipr) => {
    const first = ipr.coils?.[0] || {};
    return {
      row_kind: PENDING_STORE_IN_ROW,
      ipr_uid: ipr.ipr_uid,
      mrn_no: ipr.mrn_no ?? first.mrn_no ?? null,
      mrn_uid: ipr.mrn_uid ?? first.mrn_uid ?? null,
      heat_nos: ipr.heat_no ?? first.heat_no ?? null,
      item_code: ipr.item_code ?? first.item_code ?? null,
      item_desc: ipr.item_desc ?? first.item_desc ?? null,
      stock_qty: Number(ipr.balance_qty ?? ipr.total_qty ?? 0) || 0,
      coil_count: ipr.coil_count ?? ipr.coils?.length ?? 0,
      total_coils: ipr.coil_count ?? ipr.coils?.length ?? 0,
      reason: ipr.reason ?? null,
      remarks: ipr.remarks ?? null,
      created_by: ipr.created_by_name || ipr.created_by || null,
      created_at: ipr.approved_at || ipr.created_at || null,
      source: iprPendingSourceLabel(ipr),
    };
  });
}

function isPendingStoreInRow(row) {
  return row?.row_kind === PENDING_STORE_IN_ROW;
}

export default function StoreInPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);
  const canReceiveStoreIn = useMemo(
    () => canAccess(IPR_MODULE, "authorize").allowed || canAccess(MODULE, "authorize").allowed,
    [canAccess]
  );

  const [pageTab, setPageTab] = useState(PAGE_TABS.PACKING_AREA);
  const isStoreIn = pageTab === PAGE_TABS.STORE_IN;
  const isUnassigned = pageTab === PAGE_TABS.PACKING_AREA;
  const [packingView, setPackingView] = useState(PACKING_VIEWS.SUMMARY);
  const isPackingCoilView = isUnassigned && packingView === PACKING_VIEWS.COILS;

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
  const [packingFilterMrn, setPackingFilterMrn] = useState("");
  const [packingFilterSource, setPackingFilterSource] = useState("");
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
  const [pendingStoreInRows, setPendingStoreInRows] = useState([]);
  const [mrnRows, setMrnRows] = useState([]);
  const [coilRows, setCoilRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [finderOpen, setFinderOpen] = useState(false);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveIprUid, setReceiveIprUid] = useState(null);

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
      toast.error(err?.message || "Failed to load Store-In");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.fromDate, params.toDate, params.status, appliedSearch]);

  const fetchPendingStoreIn = useCallback(async () => {
    try {
      const res = await inProcessRequestService.getPendingStoreIn();
      const rows = Array.isArray(res?.data) ? res.data : [];
      setPendingStoreInRows(rows);
      return rows;
    } catch (err) {
      toast.error(err?.message || "Could not load pending store-in returns. Please try again.");
      setPendingStoreInRows([]);
      return [];
    }
  }, []);

  const fetchUnassignedBundle = useCallback(async () => {
    setLoading(true);
    try {
      const pendingPromise = fetchPendingStoreIn();
      if (isPackingCoilView) {
        const [, { data }] = await Promise.all([
          pendingPromise,
          fetchAllListPages(async (page, limit) => {
            const body = await inventoryInwardService.getCoilArea({
              page,
              limit,
              sortBy: coilParams.sortKey,
              order: String(coilParams.sortDir || "desc").toUpperCase(),
              ...(packingFilterMrn ? { mrn_uid: packingFilterMrn } : {}),
              ...(packingFilterSource ? { source: packingFilterSource } : {}),
              ...(appliedSearch && { search: appliedSearch }),
            });
            return { data: body.data ?? [], total: body.total ?? 0 };
          }, coilParams.pageSize),
        ]);
        setCoilRows(data);
      } else {
        const [, { data }] = await Promise.all([
          pendingPromise,
          fetchAllListPages(async (page, limit) => {
            const body = await inventoryInwardService.getPackingAreaList({
              page,
              limit,
              sortBy: mrnParams.sortKey,
              order: String(mrnParams.sortDir || "desc").toUpperCase(),
              ...(appliedSearch && { search: appliedSearch }),
            });
            return { data: body.data ?? [], total: body.total ?? 0 };
          }, mrnParams.pageSize),
        ]);
        setMrnRows(data);
      }
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Could not load unassigned inventory.");
      if (isPackingCoilView) setCoilRows([]);
      else setMrnRows([]);
    } finally {
      setLoading(false);
    }
  }, [
    isPackingCoilView,
    fetchPendingStoreIn,
    coilParams.pageSize,
    coilParams.sortKey,
    coilParams.sortDir,
    mrnParams.pageSize,
    mrnParams.sortKey,
    mrnParams.sortDir,
    packingFilterMrn,
    packingFilterSource,
    appliedSearch,
  ]);

  useEffect(() => {
    if (isStoreIn) fetchInwards();
    else if (isUnassigned) fetchUnassignedBundle();
  }, [isStoreIn, isUnassigned, isPackingCoilView, fetchInwards, fetchUnassignedBundle]);

  const pendingCoilRows = useMemo(() => {
    let rows = mapPendingStoreInToCoilRows(pendingStoreInRows);
    if (packingFilterMrn) {
      rows = rows.filter((r) => String(r.mrn_uid || "") === String(packingFilterMrn));
    }
    if (packingFilterSource) {
      rows = rows.filter(
        (r) => String(r.source || "").toUpperCase() === String(packingFilterSource).toUpperCase()
      );
    }
    return rows;
  }, [pendingStoreInRows, packingFilterMrn, packingFilterSource]);

  const pendingMrnRows = useMemo(() => {
    let rows = mapPendingStoreInToMrnRows(pendingStoreInRows);
    if (packingFilterMrn) {
      rows = rows.filter((r) => String(r.mrn_uid || "") === String(packingFilterMrn));
    }
    if (packingFilterSource) {
      rows = rows.filter(
        (r) => String(r.source || "").toUpperCase() === String(packingFilterSource).toUpperCase()
      );
    }
    return rows;
  }, [pendingStoreInRows, packingFilterMrn, packingFilterSource]);


  const activeSourceRows = isStoreIn
    ? allRows
    : isPackingCoilView
      ? [...pendingCoilRows, ...coilRows]
      : [...pendingMrnRows, ...mrnRows];
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
  const inwardFooterLabel = isStoreIn
    ? "Store-In Entries"
    : isPackingCoilView
      ? "Unassigned Coils"
      : "Unassigned MRNs";
  const footerFilter = useMemo(
    () =>
      rmStoreFooterFromClientFilter({
        tempSearch,
        sourceRows: activeSourceRows,
        filteredRows,
        serverFiltered: isStoreIn && (params.status !== "all" || Boolean(appliedSearch)),
      }),
    [tempSearch, activeSourceRows, filteredRows, isStoreIn, params.status, appliedSearch]
  );

  const getRowId = useCallback(
    (row) => {
      if (isStoreIn) return row.in_uid;
      if (isPackingCoilView) return row.coil_uid ?? row.coil_no_uid;
      const mrn = row.mrn_uid || "";
      const src = String(row.source || "MRN PORTAL").toUpperCase();
      return `${mrn}::${src}`;
    },
    [isStoreIn, isPackingCoilView]
  );

  const selectedRecord = useMemo(
    () => filteredRows.find((r) => getRowId(r) === selected) || null,
    [filteredRows, selected, getRowId]
  );

  const handleTabChange = (tab) => {
    setPageTab(tab);
    setPackingView(PACKING_VIEWS.SUMMARY);
    setPackingFilterMrn("");
    setPackingFilterSource("");
    setSelected(null);
    resetSearch();
    setDisplayLimit(100);
  };

  const handleReceivePendingStoreIn = useCallback(() => {
    if (!selectedRecord?.ipr_uid) return;
    setReceiveIprUid(selectedRecord.ipr_uid);
    setReceiveModalOpen(true);
  }, [selectedRecord]);

  // const canReceivePendingStoreIn = Boolean(
  //   isUnassigned && isPackingCoilView && isPendingStoreInRow(selectedRecord) && selectedRecord?.ipr_uid
  // );

  const canReceivePendingStoreIn = Boolean(
    isUnassigned && isPendingStoreInRow(selectedRecord) && selectedRecord?.ipr_uid
  );
  
  const handlePrimaryAction = useCallback(() => {
    if (canReceivePendingStoreIn) {
      if (!canReceiveStoreIn) {
        toast.error("You do not have permission to receive pending store-in.");
        return;
      }
      handleReceivePendingStoreIn();
      return;
    }
    setEditItem(null);
    setModalMode("add");
    setModalOpen(true);
  }, [canReceivePendingStoreIn, canReceiveStoreIn, handleReceivePendingStoreIn]);

  const { openEditModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: modalOpen || finderOpen || receiveModalOpen || !!deleteItem,
    selectedId: isStoreIn ? selected : null,
    getSelectedRow: useCallback(
      () => (isStoreIn ? filteredRows.find((r) => String(r.in_uid) === String(selected)) || null : null),
      [filteredRows, selected, isStoreIn]
    ),
    openAdd: handlePrimaryAction,
    bypassModulePermission: canReceivePendingStoreIn,
    canOpenNew: useCallback(() => {
      if (canReceivePendingStoreIn) return canReceiveStoreIn;
      return true;
    }, [canReceivePendingStoreIn, canReceiveStoreIn]),
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

  const handlePackingViewChange = (view) => {
    setPackingView(view);
    setPackingFilterMrn("");
    setPackingFilterSource("");
    setSelected(null);
    resetSearch();
    setDisplayLimit(100);
  };

  const openCoilsForSelectedMrn = () => {
    const row = selectedRecord;
    if (!row?.mrn_uid || isPendingStoreInRow(row)) return;
    setPackingFilterMrn(String(row.mrn_uid).trim());
    setPackingFilterSource(String(row.source || "").trim());
    setPackingView(PACKING_VIEWS.COILS);
    setSelected(null);
    setDisplayLimit(100);
  };

  const handleRefresh = () => {
    if (isStoreIn) fetchInwards();
    else if (isUnassigned) fetchUnassignedBundle();
  };

  const unassignedStatusCell = (_v, row) =>
    isPendingStoreInRow(row) ? (
      <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-teal-50 text-teal-700 border-teal-200">
        ● PENDING RECEIVE
      </span>
    ) : (
      renderCoilLocationCell(_v, row)
    );

  const sourceCell = (v) => {
    const s = String(v || "").toUpperCase();
    if (s.startsWith("IPR #") || s.startsWith("IPR CONSUME")) {
      return (
        <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-violet-50 text-violet-700 border-violet-200">
          ● {s}
        </span>
      );
    }
    if (s === "PRODUCTION RETURN") {
      return (
        <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-indigo-50 text-indigo-700 border-indigo-200">
          ● PRODUCTION RETURN
        </span>
      );
    }
    if (s.startsWith("STOCK ADJ")) {
      return (
        <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-amber-50 text-amber-700 border-amber-200">
          ● {s}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-slate-50 text-slate-700 border-slate-200">
        ● MRN PORTAL
      </span>
    );
  };

  const STORE_IN_HEADERS = useMemo(
    () => [
      ["Inward UID", "in_uid", (v) => <span className="font-bold text-indigo-600 text-[10px]">{v}</span>, { fixed: true, width: "100px" }],
      ["MRN UID", "mrn_uids", (v) => <span className="font-mono font-bold text-slate-800 text-[10px] tracking-tight">{v || "—"}</span>, { width: "140px" }],
      ["Heat Nos", "heat_nos", (v) => <span className="font-mono text-[10px] font-bold text-amber-700">{v || "—"}</span>, { width: "140px" }],
      ["Item Codes", "item_codes", (v) => <span className="text-slate-700 text-[10px] uppercase">{v || "—"}</span>, { width: "160px" }],
      ["Qtys", "qtys", (v) => <span className="text-emerald-700 text-[10px] font-bold tabular-nums">{v || "—"}</span>, { width: "100px" }],
      ["Total Qty", "total_qty", (v) => (
        <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px] tabular-nums">
          {v != null ? Number(v).toLocaleString() : "0"}
        </span>
      ), { width: "100px" }],
      ["Coils", "coil_count", (v) => <span className="font-bold tabular-nums text-[11px]">{v ?? 0}</span>, { width: "70px" }],
      ["Remarks", "remarks", (v) => <span className="text-slate-500 text-[10px] truncate block">{v || "—"}</span>, { width: "160px" }],
      ["Status", "approved", (v) => (
        <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
          {v ? "● AUTHORIZED" : "○ PENDING"}
        </span>
      ), { width: "120px" }],
      ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400">{formatDateTime(v)}</span>, { width: "150px" }],
    ],
    []
  );

  const PACKING_BY_MRN_HEADERS = useMemo(
    () => [
      [ "MRN UID", "mrn_uid", (v, row) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!row?.mrn_uid) return;
              setPackingFilterMrn(String(row.mrn_uid).trim());
              setPackingFilterSource(String(row.source || "").trim());
              setPackingView(PACKING_VIEWS.COILS);
              setSelected(null);
              setDisplayLimit(100);
            }}
            className="font-mono font-bold text-indigo-600 text-[11px] tracking-tight hover:underline"
            title={row?.mrn_uid || ""}
          >
            {v || "—"}
          </button>
        ),
        { fixed: true, width: "140px" },
      ],
      ["Source", "source", sourceCell, { width: "180px" }],
      ["Heat", "heat_nos", (v) => <span className="font-mono text-[10px] font-bold text-amber-700">{v || "—"}</span>, { width: "140px" }],
      [
        "Item",
        "item_code",
        (v) => (
          <span className="text-slate-700 font-medium text-[10px] uppercase truncate" title={v || ""}>
            {v || "—"}
          </span>
        ),
        { width: "180px" },
      ],
      [
        "Desc",
        "item_desc",
        (v) => (
          <span className="text-[10px] text-slate-500 truncate block" title={v || ""}>
            {v || "—"}
          </span>
        ),
        { width: "200px" },
      ],
      [
        "Quantity",
        "stock_qty",
        (v, row) => (
          <span
            className={`font-black px-2 py-0.5 border text-[11px] tabular-nums ${
              isPendingStoreInRow(row)
                ? "text-teal-700 bg-teal-50 border-teal-100"
                : "text-emerald-600 bg-emerald-50 border-emerald-100"
            }`}
          >
            {v != null ? Number(v).toLocaleString() : "0"}
          </span>
        ),
        { width: "100px" },
      ],
      [
        "Coils",
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
        { width: "100px" },
      ],
      ["Status", "row_kind", unassignedStatusCell, { width: "140px" }],
      [
        "Created By",
        "created_by",
        (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>,
        { width: "110px" },
      ],
      [
        "Created At",
        "created_at",
        (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>,
        { width: "150px" },
      ],
    ],
    []
  );

  const PACKING_BY_COIL_HEADERS = useMemo(
    () => [
      ["Coil UID", "coil_no_uid", (v, row) => (
          <span
            className={`font-mono font-bold text-[10px] tracking-tight ${
              isPendingStoreInRow(row) ? "text-teal-700" : "text-indigo-600"
            }`}
          >
            {v || "—"}
          </span>
        ),
        { fixed: true, width: "200px" },
      ],
      ["Source", "source", sourceCell, { width: "180px" }],
      ["MRN UID", "mrn_uid", (v) => <span className="font-bold text-slate-800 text-[11px]">{v || "—"}</span>, { width: "100px" }],
      ["Heat", "heat_no", (v) => <span className="font-mono text-[10px] font-bold text-amber-700">{v || "—"}</span>, { width: "110px" }],
      ["Item", "item_code", (v) => (
          <span className="text-slate-700 font-medium text-[10px] uppercase truncate" title={v || ""}>
            {v || "—"}
          </span>
        ),
        { width: "180px" },
      ],
      ["Desc", "item_desc", (v) => (
          <span className="text-[10px] text-slate-500 truncate block" title={v || ""}>
            {v || "—"}
          </span>
        ),
        { width: "180px" },
      ],
      [
        "Qty",
        "qty",
        (v, row) => (
          <span
            className={`font-black text-[11px] tabular-nums ${
              isPendingStoreInRow(row) ? "text-teal-700" : "text-emerald-700"
            }`}
          >
            {v != null ? Number(v).toLocaleString() : "—"}
          </span>
        ),
        { width: "90px" },
      ],
      [
        "Index",
        "coil_index",
        (v, row) => (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase border bg-amber-50 text-amber-700 border-amber-200 tabular-nums">
            {v ?? "—"}/{row?.total_coils ?? "—"}
          </span>
        ),
        { width: "90px" },
      ],
      ["Status", "row_kind", unassignedStatusCell, { width: "140px" }],
      // ["QC", "qc_uid", (v, row) => (isPendingStoreInRow(row) ? "—" : renderCoilQcIdStatusCell(v, row)), { width: "130px" }],
      [
        "Created",
        "created_at",
        (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>,
        { width: "150px" },
      ],
    ],
    []
  );

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
              isUnassigned ? (
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

                {!isStoreIn && packingView === PACKING_VIEWS.SUMMARY && selectedRecord?.mrn_uid && !isPendingStoreInRow(selectedRecord) && (
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
                  onClick={handlePrimaryAction}
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

                {canReceivePendingStoreIn && (
                  <button
                    type="button"
                    disabled={!canReceiveStoreIn}
                    onClick={handleReceivePendingStoreIn}
                    className="h-9 px-4 border border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none shrink-0 disabled:opacity-50"
                  >
                    <CheckCircle size={14} />
                    Receive to Unassigned
                  </button>
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

          {!isStoreIn && packingFilterMrn && isPackingCoilView && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-amber-50 border border-amber-200">
              <span className="text-[10px] font-bold text-amber-800 uppercase truncate">
                MRN {packingFilterMrn}
                {packingFilterSource ? ` · ${packingFilterSource}` : ""} — {totalItems} coil
                {totalItems === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPackingFilterMrn("");
                  setPackingFilterSource("");
                  setDisplayLimit(100);
                }}
                className="text-amber-600 hover:text-amber-900 flex items-center gap-1 font-bold text-[10px] uppercase shrink-0"
              >
                <X size={14} /> Show all coils
              </button>
            </div>
          )}

          {selectedRecord && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase truncate">
                Selected:{" "}
                {isPendingStoreInRow(selectedRecord)
                  ? `IPR #${selectedRecord.ipr_uid} · Return ${Number(selectedRecord.qty ?? selectedRecord.stock_qty ?? 0).toLocaleString()} · ${selectedRecord.coil_count ?? selectedRecord.total_coils ?? 0} coil(s) · PENDING RECEIVE`
                  : isStoreIn
                  ? selectedRecord.mrn_uids || `IN-${selectedRecord.in_uid}`
                  : isPackingCoilView
                    ? `${selectedRecord.coil_no_uid}${
                        selectedRecord.qty != null ? ` · Qty ${Number(selectedRecord.qty).toLocaleString()}` : ""
                      }`
                    : `MRN UID ${selectedRecord.mrn_uid || "—"}${
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
            searchPlaceholder={
              isStoreIn
                ? "Search by MRN, heat, or item"
                : isPackingCoilView
                  ? "Search by coil UID, MRN, or IPR"
                  : "Search by MRN, heat, item, or IPR"
            }
            searchLabel={
              isStoreIn
                ? "Search MRN refs"
                : isPackingCoilView
                  ? "Search unassigned coils"
                  : "Search unassigned MRN"
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
              {...tableHotkeyProps}
              onLoadMore={() => {
                if (!loading && items.length < totalItems) setDisplayLimit((n) => n + 100);
              }}
              hasMore={items.length < totalItems}
              totalItems={totalItems}
              cardConfig={
                isStoreIn
                  ? { titleKey: "mrn_uids", badgeIndices: [8], detailIndices: [1, 2, 3], footerKey: "created_at" }
                  : isPackingCoilView
                    ? {
                        titleKey: "coil_no_uid",
                        badgeIndices: [1, 7],
                        detailKeys: ["mrn_uid", "heat_no", "item_code", "item_desc", "qty"],
                        footerKey: "created_at",
                      }
                    : {
                        titleKey: "mrn_uid",
                        badgeIndices: [1, 7],
                        detailKeys: ["heat_nos", "item_code", "item_desc", "stock_qty", "coil_count"],
                        footerKey: "created_at",
                      }
              }
            />
          </div>
        </div>

        <RmStoreListFooter
          label={inwardFooterLabel}
          showing={items.length}
          total={totalItems}
          filter={footerFilter}
        />
      </div>

      <InwardModal
        open={modalOpen}
        mode={modalMode}
        editData={editItem}
        onClose={() => {
          setModalOpen(false);
          setEditItem(null);
          setModalMode("add");
        }}
        onSuccess={() => {
          handleRefresh();
        }}
      />

      {finderOpen && <LocationFinderDrawer open={finderOpen} onClose={() => setFinderOpen(false)} />}

      {deleteItem && (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={() => {
            fetchInwards();
            setSelected(null);
          }}
          service={inventoryInwardService}
          entityLabel="Store In Entry"
          idKey="in_uid"
          moduleSlug={MODULE}
        />
      )}

      <ReceivePendingStoreInModal
        open={receiveModalOpen}
        iprUid={receiveIprUid}
        onClose={() => {
          setReceiveModalOpen(false);
          setReceiveIprUid(null);
        }}
        onSuccess={() => {
          setSelected(null);
          void fetchUnassignedBundle();
        }}
      />
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Locate, Box, Edit3, Trash2, X, Warehouse, PackageOpen, List, Boxes } from "lucide-react";
import { toast } from "react-toastify";
import { inventoryInwardService } from "@/apps/ims/lib/services/inventoryInward";
import { boxService } from "@/apps/ims/lib/services/box";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";

// Components
import InwardModal from "@/apps/ims/modules/inventory-inward/InwardModal";
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
import LocationFinderDrawer from "@/apps/ims/modules/location/LocationFinderDrawer";

import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { formatDateTime, formatDocDate } from "@/platform/utils/core/utilHelper";
import { pipeMetaRenderers } from "@/apps/ims/lib/helpers/pipeMetaDisplay";

const PAGE_TABS = {
  STORE_IN: "store_in",
  PACKING_AREA: "packing_area",
};

/** Packing Area tab: summary by packing vs individual boxes */
const PACKING_VIEWS = {
  SUMMARY: "summary",
  BOXES: "boxes",
};

export default function InwardPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("inventory_inwards", "view"), [canAccess]);

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
  const [packingFilterPn, setPackingFilterPn] = useState("");
  const [packingFilterItem, setPackingFilterItem] = useState(null); // { dcode, code }
  const [packingFilterCust, setPackingFilterCust] = useState(null); // { code, name }
  const [packingParams, setPackingParams] = useState({
    pageSize: 500,
    sortKey: "packing_number",
    sortDir: "desc",
  });
  const [packingBoxParams, setPackingBoxParams] = useState({
    pageSize: 500,
    sortKey: "box_no_uid",
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
  const [packingRows, setPackingRows] = useState([]);
  const [packingBoxRows, setPackingBoxRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [finderOpen, setFinderOpen] = useState(false);

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
      toast.error(err?.message || "Failed to load inwards");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.fromDate, params.toDate, params.status, appliedSearch]);

  const fetchPackingArea = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await inventoryInwardService.getPackingAreaList({
          page,
          limit,
          sortBy: packingParams.sortKey,
          order: String(packingParams.sortDir || "desc").toUpperCase(),
          filters: {},
          ...(appliedSearch && { search: appliedSearch }),
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, packingParams.pageSize);
      setPackingRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Failed to load packing area");
      setPackingRows([]);
    } finally {
      setLoading(false);
    }
  }, [packingParams.pageSize, packingParams.sortKey, packingParams.sortDir, appliedSearch]);

  const fetchPackingAreaBoxes = useCallback(async () => {
    setLoading(true);
    try {
      const base = {
        filters: {},
        sortBy: packingBoxParams.sortKey,
        order: String(packingBoxParams.sortDir || "desc").toUpperCase(),
        ...(packingFilterPn ? { packing_number: packingFilterPn } : {}),
        ...(packingFilterItem?.dcode ? { item_dcode: packingFilterItem.dcode } : {}),
        ...(packingFilterCust?.code ? { acc_code: packingFilterCust.code } : {}),
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await inventoryInwardService.getPackingAreaBoxes({
          ...base,
          page,
          limit,
          ...(appliedSearch && { search: appliedSearch }),
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, packingBoxParams.pageSize);
      setPackingBoxRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Failed to load packing area boxes");
      setPackingBoxRows([]);
    } finally {
      setLoading(false);
    }
  }, [
    packingBoxParams.pageSize,
    packingBoxParams.sortKey,
    packingBoxParams.sortDir,
    packingFilterPn,
    packingFilterItem,
    packingFilterCust,
    appliedSearch,
  ]);

  const isPackingBoxView = !isStoreIn && packingView === PACKING_VIEWS.BOXES;

  useEffect(() => {
    if (isStoreIn) fetchInwards();
    else if (isPackingBoxView) fetchPackingAreaBoxes();
    else fetchPackingArea();
  }, [isStoreIn, isPackingBoxView, fetchInwards, fetchPackingArea, fetchPackingAreaBoxes]);

  const activeSourceRows = isStoreIn
    ? allRows
    : isPackingBoxView
      ? packingBoxRows
      : packingRows;
  const activeSortKey = isStoreIn
    ? params.sortKey
    : isPackingBoxView
      ? packingBoxParams.sortKey
      : packingParams.sortKey;
  const activeSortDir = isStoreIn
    ? params.sortDir
    : isPackingBoxView
      ? packingBoxParams.sortDir
      : packingParams.sortDir;

  const filteredRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    let data = activeSourceRows;
    if (q) {
      data = applyClientSearch(activeSourceRows, tempSearch, { skipSort: !!activeSortKey });
    }
    return sortRowsByKey(data, activeSortKey, activeSortDir);
  }, [activeSourceRows, tempSearch, activeSortKey, activeSortDir]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + 100);
    }
  }, [loading, items.length, totalItems]);

  const handleFilterApply = (data) => {
    applySearchFromInput();
    if (isStoreIn) {
      setParams((prev) => ({
        ...prev,
        fromDate: data.fromDate,
        toDate: data.toDate,
        status: data.approvedStatus || prev.status,
      }));
      return;
    }
    // No date filters for packing area
  };

  const handleReset = () => {
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
    } else if (isPackingBoxView) {
      setPackingFilterPn("");
      setPackingFilterItem(null);
      setPackingFilterCust(null);
      setPackingBoxParams({
        pageSize: 500,
        sortKey: "box_no_uid",
        sortDir: "desc",
      });
    } else {
      setPackingFilterPn("");
      setPackingFilterItem(null);
      setPackingFilterCust(null);
      setPackingParams({
        pageSize: 500,
        sortKey: "packing_number",
        sortDir: "desc",
      });
    }
  };

  const handleTabChange = (tab) => {
    setPageTab(tab);
    setPackingView(PACKING_VIEWS.SUMMARY);
    setPackingFilterPn("");
    setPackingFilterItem(null);
    setSelected(null);
    setTempSearch("");
    setDisplayLimit(100);
  };

  const handlePackingViewChange = (view) => {
    setPackingView(view);
    setPackingFilterPn("");
    setPackingFilterItem(null);
    setPackingFilterCust(null);
    setSelected(null);
    setDisplayLimit(100);
  };

  const handleRefresh = () => {
    if (isStoreIn) fetchInwards();
    else if (isPackingBoxView) fetchPackingAreaBoxes();
    else fetchPackingArea();
  };

  const extraFilters = useMemo(
    () =>
      isStoreIn
        ? [
            {
              label: "Status",
              key: "approvedStatus",
              value: params.status,
              options: [
                { label: "All Status", value: "all" },
                { label: "Approved", value: "approved" },
                { label: "Pending", value: "pending" },
              ],
            },
          ]
        : [],
    [isStoreIn, params.status]
  );

  const getRowIdForList = useCallback(
    (item) => {
      if (isStoreIn) return item.in_uid;
      if (isPackingBoxView) return item.box_uid;
      const cust = item.acc_code != null ? String(item.acc_code).trim() : "";
      const jc = item.job_card_no != null ? String(item.job_card_no).trim() : "";
      return `${item.packing_number}:${item.item_dcode}:${cust}:${jc}`;
    },
    [isStoreIn, isPackingBoxView]
  );

  const getSelectedRow = useCallback(
    () => filteredRows.find((i) => getRowIdForList(i) === selected),
    [filteredRows, selected, getRowIdForList]
  );

  const selectedRecord = useMemo(() => getSelectedRow(), [getSelectedRow]);

  const openBoxesForSelectedPacking = () => {
    const row = getSelectedRow();
    if (!row?.packing_number) return;
    setPackingFilterPn(String(row.packing_number).trim());
    setPackingFilterItem(null);
    setPackingFilterCust(null);
    setPackingView(PACKING_VIEWS.BOXES);
    setSelected(null);
    setDisplayLimit(100);
  };

  const { openNewModal, openEditModal, tableHotkeyProps, openDeleteModal } = useListDrawerHotkeys({
    module: "inventory_inwards",
    modalOpen: modalOpen || finderOpen || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => {
      setEditItem(null);
      setModalMode("add");
      setModalOpen(true);
    }, []),
    openEdit: useCallback((row) => {
      if (!isStoreIn) return;
      setEditItem(row);
      setModalMode("edit");
      setModalOpen(true);
    }, [isStoreIn]),
    openDelete: useCallback((row) => {
      setDeleteItem(row);
    }, []),
    canDeleteSelection: useCallback(() => (isStoreIn || isPackingBoxView) && !!selected, [isStoreIn, isPackingBoxView, selected]),
  });

  const inPackingMeta = pipeMetaRenderers("font-bold text-slate-800 text-[10px] leading-tight");
  const inItemMeta = pipeMetaRenderers("text-slate-600 text-[10px] font-medium leading-tight");
  const inQtyMeta = pipeMetaRenderers("text-emerald-700 text-[10px] font-bold tabular-nums leading-tight");

  const STORE_IN_HEADERS = [
    ["Inward UID", "in_uid", (v) => <span className="font-bold text-indigo-600 text-[10px]">{v}</span>, { fixed: true, width: "100px" }],
    [
      "Packing No",
      "packing_number",
      inPackingMeta.table,
      { fixed: true, width: "140px", cardRender: inPackingMeta.card, copyValue: inPackingMeta.copyValue },
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
      {
        width: "100px",
        cardRender: (v) => (
          <span className="font-black text-emerald-600 text-[11px] tabular-nums">
            {v != null ? Number(v).toLocaleString() : "0"}
          </span>
        ),
      },
    ],
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

  const PACKING_AREA_BOX_HEADERS = [
    [
      "Box UID",
      "box_no_uid",
      (v) => <span className="font-bold text-indigo-600 text-[10px]">{v || "—"}</span>,
      { fixed: true, width: "160px" },
    ],
    ["Date", "doc_dt", (v) => <span className="text-slate-600 font-bold text-[10px] uppercase">{formatDocDate(v) || "—"}</span>, { width: "100px" }],
    [
      "Job Card",
      "job_card_no",
      (v) => <span className="font-bold text-slate-700 text-[11px] uppercase tracking-tighter">{v || "—"}</span>,
      { width: "120px" },
    ],
    [
      "Packing No",
      "packing_number",
      (v) => <span className="font-bold text-slate-800 text-[10px]">{v || "—"}</span>,
      { width: "140px" },
    ],
    [
      "Item",
      "item_code",
      (v) => <span className="text-slate-500 text-[10px] uppercase">{v || "—"}</span>,
      { width: "120px" },
    ],
    [
      "Qty",
      "qty",
      (v) => <span className="font-black text-emerald-700 text-[11px] tabular-nums">{Number(v) || 0}</span>,
      { width: "80px" },
    ],
    [
      "Loose",
      "is_loose",
      (v) => (
        <span
          className={`px-2 py-0.5 text-[9px] font-black uppercase border ${
            v ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-white text-slate-400 border-slate-100"
          }`}
        >
          {v ? "YES" : "NO"}
        </span>
      ),
      { width: "80px" },
    ],
    [
      "Created At",
      "created_at",
      (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>,
      { width: "150px" },
    ],
  ];

  const packingDetailCell = (v) => (
    <span className="text-slate-500 text-[10px]">{v != null && String(v).trim() !== "" ? v : "—"}</span>
  );

  const PACKING_AREA_HEADERS = [
    [ "Packing No", "packing_number", (v) => (<span className="font-mono font-bold text-slate-800 text-[10px] tracking-tight">{v || "—"}</span>), { fixed: true, width: "100px" } ],
    ["Date", "doc_dt", (v) => <span className="text-slate-600 font-bold text-[10px] uppercase">{formatDocDate(v) || "—"}</span>, { width: "100px" }],
    [
      "Job Card",
      "job_card_no",
      (v) => (
        <span className="font-bold text-slate-700 text-[11px] uppercase tracking-tighter">{v || "—"}</span>
      ),
      { width: "120px" },
    ],
    [
      "Quantity",
      "stock_qty",
      (v) => (
        <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px] tabular-nums">
          {parseFloat(v || 0).toLocaleString()}
        </span>
      ),
      { width: "100px" },
    ],
    [
      "Full Boxes",
      "full_box_count",
      (v, row) => {
        const count = Number(v) || 0;
        const perBox = Number(row?.full_box_qty) || 0;
        if (count === 0) return <span className="text-slate-300 text-[11px] font-medium">0</span>;
        return (
          <span className="font-bold text-[11px] tabular-nums text-blue-600">
            {perBox > 0 ? `${count} × ${perBox.toLocaleString()}` : count}
          </span>
        );
      },
      { width: "100px" },
    ],
    [
      "Loose Box",
      "loose_box_count",
      (v, row) => {
        const count = Number(v) || 0;
        const looseQty = Number(row?.loose_total_qty) || 0;
        if (count === 0) return <span className="text-slate-300 text-[11px] font-medium">0</span>;
        return (
          <span className="font-bold text-[11px] tabular-nums text-amber-600">
            {looseQty > 0 ? `${count} × ${looseQty.toLocaleString()}` : count}
          </span>
        );
      },
      { width: "88px" },
    ],
    /*
    ["Customer", "acc_name", (v, row) => (
      <div className="flex flex-col leading-tight min-w-0">
      <span className="text-slate-800 font-bold text-[10px] uppercase whitespace-normal break-words leading-snug hyphens-auto" title={v}>{v || "Unknown"}</span>
      </div>
    ), { width: "250px", wrap: true }],
    */ 
    ["Item Details", "item_code", (v, row) => (
      <div className="flex flex-col leading-tight">
        <span className="text-slate-700 font-medium text-[10px] uppercase truncate" title={v}>{v}</span>
      </div>
    )],
    /*
    ["Item Description", "item_desc", (v, row) => (
      <div className="flex flex-col leading-tight">
        <span className="text-slate-700 font-medium text-[10px] uppercase truncate" title={v}>{v}</span>
      </div>
    ), { width: "220px" }],
    */
    [
      "Unassigned boxes",
      "box_count",
      (v) => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black uppercase border bg-amber-50 text-amber-700 border-amber-200">
          <Box size={10} />
          {Number(v) || 0}
        </span>
      ),
      { width: "130px" },
    ],
    ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ];

  const headers = isStoreIn
    ? STORE_IN_HEADERS
    : isPackingBoxView
      ? PACKING_AREA_BOX_HEADERS
      : PACKING_AREA_HEADERS;

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "Inventory Inward",
    rows: filteredRows,
    headers,
  });

  const handleSort = (key) => {
    setDisplayLimit(100);
    if (isStoreIn) {
      setParams((p) => ({
        ...p,
        sortKey: key,
        sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
      }));
    } else if (isPackingBoxView) {
      setPackingBoxParams((p) => ({
        ...p,
        sortKey: key,
        sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
      }));
    } else {
      setPackingParams((p) => ({
        ...p,
        sortKey: key,
        sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
      }));
    }
  };

  const cardConfig = isStoreIn
    ? {
        titleKey: "packing_number",
        badgeIndices: [6],
        detailKeys: ["item_codes", "qtys", "total_qty"],
        footerKey: "created_at",
      }
    : isPackingBoxView
      ? {
          titleKey: "box_no_uid",
          badgeIndices: [2],
          detailKeys: ["doc_dt", "job_card_no", "packing_number", "item_code", "qty", "is_loose"],
          footerKey: "created_at",
        }
      : {
          titleKey: "packing_number",
          badgeIndices: [8],
          detailKeys: ["job_card_no", "acc_name", "item_code", "stock_qty", "created_by_name"],
          footerKey: "created_at",
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
                  { id: PAGE_TABS.PACKING_AREA, label: "Packing Area", icon: PackageOpen },
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
                    { id: PACKING_VIEWS.SUMMARY, label: "By Packing", icon: List },
                    { id: PACKING_VIEWS.BOXES, label: "By Box", icon: Boxes },
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

                {!isStoreIn && packingView === PACKING_VIEWS.SUMMARY && selectedRecord?.packing_number && (
                  <button
                    type="button"
                    onClick={openBoxesForSelectedPacking}
                    className="h-9 px-4 border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none shrink-0"
                  >
                    <Boxes size={14} />
                    View Boxes
                  </button>
                )}

                <ActionButton
                  module="inventory_inwards"
                  action="add"
                  label="New"
                  icon={Plus}
                  onClick={openNewModal}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />

                {isStoreIn && (
                  <ActionButton
                    module="inventory_inwards"
                    action="edit"
                    variant="outline"
                    label="Edit"
                    icon={Edit3}
                    disabled={!selected}
                    record={selectedRecord}
                    onClick={openEditModal}
                    className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                  />
                )}

                {(isStoreIn || isPackingBoxView) && (
                  <ActionButton
                    module={isStoreIn ? "inventory_inwards" : "boxes"}
                    action="delete"
                    variant="danger"
                    label="Delete"
                    icon={Trash2}
                    disabled={!selected}
                    onClick={() => setDeleteItem(selectedRecord)}
                    className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                  />
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

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">
                Selected:{" "}
                {isStoreIn
                  ? selectedRecord?.packing_number
                  : isPackingBoxView
                    ? selectedRecord?.box_no_uid
                    : selectedRecord?.packing_number}
                {!isStoreIn && !isPackingBoxView && selectedRecord?.box_count != null
                  ? ` · ${selectedRecord.box_count} box(es) · ${selectedRecord.stock_qty ?? 0} total qty`
                  : ""}
                {isPackingBoxView && selectedRecord
                  ? ` · Packing ${selectedRecord.packing_number} · Qty ${selectedRecord.qty ?? 0}`
                  : ""}
              </span>
              <button
                onClick={() => setSelected(null)}
                className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase"
              >
                <X size={14} /> Clear
              </button>
            </div>
          )}

          {!isStoreIn && packingFilterPn && isPackingBoxView && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-amber-50 border border-amber-200">
              <span className="text-[10px] font-bold text-amber-800 uppercase">
                Packing {packingFilterPn} — {totalItems} box{totalItems === 1 ? "" : "es"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPackingFilterPn("");
                  setPackingFilterItem(null);
                  setPackingFilterCust(null);
                  setDisplayLimit(100);
                }}
                className="text-amber-600 hover:text-amber-900 flex items-center gap-1 font-bold text-[10px] uppercase"
              >
                <X size={14} /> Show all boxes
              </button>
            </div>
          )}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            key={`${pageTab}-${isStoreIn ? params.fromDate : packingParams.fromDate}-${isStoreIn ? params.toDate : packingParams.toDate}`}
            fromDate={isStoreIn ? params.fromDate : packingParams.fromDate}
            toDate={isStoreIn ? params.toDate : packingParams.toDate}
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            onSearchEnter={() => {
              if (isStoreIn) {
                handleFilterApply({
                  fromDate: params.fromDate,
                  toDate: params.toDate,
                  approvedStatus: params.status,
                });
              } else {
                applySearchFromInput();
              }
            }}
            searchPlaceholder={
              isStoreIn
                ? "Search packing no..."
                : isPackingBoxView
                  ? "Search box UID or packing no..."
                  : "Search packing, item or customer..."
            }
            searchLabel={
              isStoreIn
                ? "Search packing no."
                : isPackingBoxView
                  ? "Search box UID or packing no."
                  : "Search packing no."
            }
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
            showDate={isStoreIn}
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
              {...tableHotkeyProps}
              onSort={handleSort}
              sortKey={activeSortKey}
              sortDir={activeSortDir}
              selectedId={selected}
              onSelect={setSelected}
              allowCopy={true}
              getRowId={getRowIdForList}
              onLoadMore={handleLoadMore}
              hasMore={items.length < totalItems}
              totalItems={totalItems}
              cardConfig={cardConfig}
            />
          </div>
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {isStoreIn
              ? `Showing ${items.length} of ${totalItems} store-in entries`
              : isPackingBoxView
                ? `Showing ${items.length} of ${totalItems} boxes in packing area`
                : `Showing ${items.length} of ${totalItems} packings in packing area`}
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
        }}
        onSuccess={() => {
          handleRefresh();
          setSelected(null);
        }}
        editData={editItem}
        mode={modalMode}
      />
      <DeleteModal
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onSuccess={() => {
          handleRefresh();
          setSelected(null);
        }}
        service={isStoreIn ? inventoryInwardService : boxService}
        entityLabel={isStoreIn ? "Inward Entry" : "Box Record"}
        idKey={isStoreIn ? "in_uid" : "box_uid"}
        moduleSlug={isStoreIn ? "inventory_inwards" : "boxes"}
      />
      {finderOpen && <LocationFinderDrawer open={finderOpen} onClose={() => setFinderOpen(false)} />}
    </div>
  );
}


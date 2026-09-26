"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Edit3, Trash2, CheckCircle, Eye, Database, ClipboardList } from "lucide-react";
import { toast } from "react-toastify";

import { inProcessRequestService, IPR_DOWNSTREAM, IPR_REQUEST_TYPE, IPR_REQUEST_TYPE_FILTER_OPTIONS } from "@/apps/rmstore/lib/services/inProcessRequest";
import { IprRequestTypeCell } from "@/apps/rmstore/modules/in-process-request/iprTypeVisuals";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import InProcessRequestModal from "@/apps/rmstore/modules/in-process-request/InProcessRequestModal";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import DataTable from "@/ui/primitives/DataTable";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ActionButton from "@/ui/primitives/ActionButton";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { rmStoreInProcessSelectionLabel } from "@/apps/rmstore/lib/rmStoreSelectionLabel";
import AppListFooter, { appListFooterFromClientFilter } from "@/ui/common/list/listPageFooter";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { auditHeaders } from "@/platform/utils/list/auditListUi";
import { isRowApproved } from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { renderCoilCompactCell, renderCoilMrnCell, renderCoilOutUidCell, renderCoilQtyCell, formatPjobcardnoDisplay, resolveCoilJobCardLabel, resolveCoilMachineLabel } from "@/apps/rmstore/modules/coil/coilTableVisuals";

const MODULE = "rm_in_process_request";

/** Left = Register (IPR DB). Right = Pending (shop-floor + unapproved IPRs). */
const PAGE_TABS = {
  REGISTER: "register",
  PENDING: "pending",
};

const PENDING_KIND = {
  SHOP_FLOOR: "shop_floor",
  IPR: "ipr",
};

/** Pending only — current (latest) JC + machine; coils list keeps reassign split. */
function resolvePendingCurrentJobCard(row) {
  const assignments = Array.isArray(row?.job_card_assignments) ? row.job_card_assignments : [];
  const balance = assignments.find((a) => a?.kind === "balance");
  const last = balance || assignments[assignments.length - 1] || null;
  const target = String(row?.reassign_target_pjobcardno || last?.pjobcardno || "").trim();
  if (target) return formatPjobcardnoDisplay(target) || target;
  return resolveCoilJobCardLabel(row);
}

function resolvePendingCurrentMachine(row) {
  const assignments = Array.isArray(row?.job_card_assignments) ? row.job_card_assignments : [];
  const balance = assignments.find((a) => a?.kind === "balance");
  const last = balance || assignments[assignments.length - 1] || null;
  const targetMac = String(
    row?.reassign_target_macname || last?.macname || ""
  ).trim();
  if (targetMac) return targetMac;
  return resolveCoilMachineLabel(row);
}

/** Pending list — shop-floor + unapproved IPR; Job Card / Machine from coil when present. */
const PENDING_SHOP_FLOOR_HEADERS = [
  [
    "Job Card",
    "pjobcardno",
    (_v, row) => renderCoilCompactCell(resolvePendingCurrentJobCard(row), "font-mono font-bold text-indigo-700"),
    { width: "130px", align: "center", copyValue: resolvePendingCurrentJobCard },
  ],
  [
    "Machine",
    "macname",
    (_v, row) => renderCoilCompactCell(resolvePendingCurrentMachine(row), "font-bold text-slate-800 uppercase"),
    { width: "120px", align: "center", copyValue: resolvePendingCurrentMachine },
  ],
  [
    "Shop Floor",
    "shop_floor_at",
    (v, row) =>
      isShopFloorPendingRow(row) ? (
        <span className="text-[10px] font-bold text-slate-600 tabular-nums whitespace-nowrap">
          {v ? formatDateTime(v) : "—"}
        </span>
      ) : (
        <IprRequestTypeCell row={row} />
      ),
    { width: "150px", align: "center" },
  ],
  [
    "Coil No",
    "coil_no_uid",
    (v, row) =>
      isShopFloorPendingRow(row) ? (
        renderCoilCompactCell(v, "font-bold text-slate-800")
      ) : (
        renderCoilCompactCell(v, "font-bold text-slate-800", v)
      ),
    { fixed: true, width: "140px" },
  ],
  ["MRN", "mrn_uid", renderCoilMrnCell, { width: "80px" }],
  ["Item Code", "item_code", (v) => renderCoilCompactCell(v, "font-mono font-bold"), { width: "110px" }],
  ["Description", "item_desc", (v) => renderCoilCompactCell(v, "font-bold text-slate-700 truncate max-w-[160px] block", v), { width: "160px" }],
  ["Qty", "qty", renderCoilQtyCell, { width: "70px", align: "center" }],
  ["Heat No", "heat_no", (v) => renderCoilCompactCell(v, "font-mono text-slate-700"), { width: "130px" }],
  ["Out UID", "out_uid", renderCoilOutUidCell, { width: "80px", copyValue: (row) => (row.out_uid != null ? String(row.out_uid) : "—") }],
];

const PENDING_CARD_CONFIG = {
  titleKey: "coil_no_uid",
  badgeIndices: [4],
  detailKeys: ["item_code", "item_desc", "pjobcardno", "macname", "shop_floor_at", "heat_no", "qty", "mrn_uid", "out_uid"],
  footerKey: "macname",
};

const DOWNSTREAM_LABEL = {
  [IPR_DOWNSTREAM.PENDING_STORE_OUT]: "Rejection Pending",
  [IPR_DOWNSTREAM.STORE_OUT_DONE]: "Store Out Done",
  [IPR_DOWNSTREAM.PENDING_STORE_IN]: "Store In Pending",
  [IPR_DOWNSTREAM.STORE_IN_DONE]: "Store In Done",
  [IPR_DOWNSTREAM.CONSUMED]: "Consumed",
  [IPR_DOWNSTREAM.TRANSFER_PENDING]: "Transfer Pending",
};

function qtyCell(v) {
  return (
    <span className="font-bold tabular-nums text-[11px] text-slate-800">
      {v != null ? Number(v).toLocaleString() : "0"}
    </span>
  );
}

function isShopFloorPendingRow(row) {
  return row?._pendingKind === PENDING_KIND.SHOP_FLOOR || (!row?.ipr_uid && row?.coil_no_uid);
}

/** Pending IPR only — Register stays plain (no row tint). */
function getIprListRowClassName(row, isPendingTab) {
  if (!isPendingTab) return "";
  if (isShopFloorPendingRow(row)) return "";
  if (row?.request_type === IPR_REQUEST_TYPE.REJECTION) {
    return "bg-rose-50 group-hover:bg-rose-100/90 [&_td]:!bg-rose-50";
  }
  return "bg-amber-50 group-hover:bg-amber-100/90 [&_td]:!bg-amber-50";
}

function buildCoilUidLabel(coilUids = [], fallback = "—") {
  const uniqueUids = [...new Set(coilUids.map((uid) => String(uid || "").trim()).filter(Boolean))];
  return uniqueUids.length ? uniqueUids.join(", ") : fallback;
}

function pendingRowId(row) {
  if (isShopFloorPendingRow(row)) {
    return `sf:${row?.coil_uid ?? row?.coil_no_uid ?? `${row?.out_uid ?? ""}-${row?.mrn_uid ?? ""}`}`;
  }
  return `ipr:${row?.ipr_uid ?? ""}`;
}

/** Map unapproved IPR into shop-floor columns; Coil No shows real coil UID(s). */
function mapPendingIprToShopFloorColumns(row) {
  const coils = Array.isArray(row.coils) ? row.coils : [];
  const coilUids = coils
    .map((c) => String(c?.coil_no_uid || "").trim())
    .filter(Boolean);
  const coilNo = buildCoilUidLabel(coilUids, row.coil_label || row.seed_coil_uid || "—");
  const jcNos = [
    ...new Set(
      coils
        .map((c) => String(c?.pjobcardno_label || c?.pjobcardno || "").trim())
        .filter(Boolean)
    ),
  ];
  const macNames = [
    ...new Set(
      coils
        .map((c) => String(c?.macname_label || c?.macname || "").trim())
        .filter(Boolean)
    ),
  ];
  const shopFloorAt =
    row.shop_floor_at ||
    coils.map((c) => c?.shop_floor_at).find((d) => d) ||
    null;

  return {
    ...row,
    _pendingKind: PENDING_KIND.IPR,
    pjobcardno: jcNos.join(" | ") || row.pjobcardno || null,
    pjobcardno_label: jcNos.join(" | ") || row.pjobcardno_label || row.pjobcardno || null,
    macname: macNames.join(" | ") || row.macname || null,
    macname_label: macNames.join(" | ") || row.macname_label || row.macname || null,
    shop_floor_at: shopFloorAt,
    coil_no_uid: coilNo,
    mrn_uid: row.mrn_uid || row.mrn_no || null,
    item_code: row.item_code || "—",
    item_desc: row.item_desc || row.reason || "—",
    qty: row.total_qty ?? row.qty ?? 0,
    coil_count: row.coil_count ?? coilUids.length,
    heat_no: row.heat_label || row.heat_no || "—",
    out_uid: row.ipr_uid ?? null,
  };
}

const DEFAULT_PARAMS = {
  pageSize: 500,
  status: "all",
  requestType: "all",
  sortKey: "ipr_uid",
  sortDir: "desc",
};

export default function InProcessRequestPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);
  const addAccess = useMemo(() => canAccess(MODULE, "add"), [canAccess]);

  const [pageTab, setPageTab] = useState(PAGE_TABS.PENDING);
  const isPendingTab = pageTab === PAGE_TABS.PENDING;

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    ...DEFAULT_PARAMS,
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "coil_no_uid",
    sortDir: "asc",
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

  const { tempSearch, setTempSearch, appliedSearch, applySearchFromInput, resetSearch } =
    useAppliedListSearch();
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const handleTabChange = (tab) => {
    setPageTab(tab);
    setSelected(null);
    setDisplayLimit(100);
    resetSearch();
    setParams((prev) => ({
      ...prev,
      status: "all",
      requestType: "all",
      sortKey: tab === PAGE_TABS.PENDING ? "coil_no_uid" : "ipr_uid",
      sortDir: tab === PAGE_TABS.PENDING ? "asc" : "desc",
    }));
  };

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      if (isPendingTab) {
        const [shopFloor, pendingIprs] = await Promise.all([
          fetchAllListPages(async (page, limit) => {
            const body = await inProcessRequestService.getPendingShopFloor({
              page,
              limit,
              ...(appliedSearch && { search: appliedSearch }),
            });
            return { data: body.data ?? [], total: body.total ?? 0 };
          }, params.pageSize),
          fetchAllListPages(async (page, limit) => {
            const body = await inProcessRequestService.getAll({
              filters: { approved: false },
              page,
              limit,
              ...(appliedSearch && { search: appliedSearch }),
            });
            return { data: body.data ?? [], total: body.total ?? 0 };
          }, params.pageSize),
        ]);

        const shopRowsRaw = (shopFloor.data || []).map((row) => {
          const currentJc = resolvePendingCurrentJobCard(row);
          const currentMac = resolvePendingCurrentMachine(row);
          return {
            ...row,
            _pendingKind: PENDING_KIND.SHOP_FLOOR,
            coil_count: 1,
            pjobcardno: currentJc !== "—" ? currentJc : null,
            pjobcardno_label: currentJc !== "—" ? currentJc : null,
            macname: currentMac !== "—" ? currentMac : null,
            macname_label: currentMac !== "—" ? currentMac : null,
          };
        });
        const shopRows = shopRowsRaw;
        const iprRows = (pendingIprs.data || []).map(mapPendingIprToShopFloorColumns);
        setAllRows([...iprRows, ...shopRows]);
      } else {
        const base = {
          filters: {
            ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
            ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
            ...(params.status !== "all" && { approved: params.status === "approved" }),
            ...(params.requestType !== "all" && { request_type: params.requestType }),
          },
        };
        const { data } = await fetchAllListPages(async (page, limit) => {
          const body = await inProcessRequestService.getAll({
            ...base,
            page,
            limit,
            ...(appliedSearch && { search: appliedSearch }),
          });
          return { data: body.data ?? [], total: body.total ?? 0 };
        }, params.pageSize);
        setAllRows(data);
      }
      setDisplayLimit(100);
    } catch (err) {
      toast.error(
        err?.message ||
          (isPendingTab
            ? "Could not load pending work. Please try again."
            : "Could not load the in-process requests. Please try again.")
      );
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [
    isPendingTab,
    params.pageSize,
    params.fromDate,
    params.toDate,
    params.status,
    params.requestType,
    appliedSearch,
  ]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const getRowId = useCallback(
    (row) => (isPendingTab ? pendingRowId(row) : row?.ipr_uid),
    [isPendingTab]
  );

  const filteredRows = useMemo(() => {
    let data = allRows;
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(data, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  useEffect(() => {
    if (!selected) return;
    if (!filteredRows.some((row) => getRowId(row) === selected)) setSelected(null);
  }, [selected, filteredRows, getRowId]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;
  const selectedRecord = useMemo(
    () => filteredRows.find((r) => getRowId(r) === selected) || null,
    [filteredRows, selected, getRowId]
  );
  const selectedIsShopFloor = isPendingTab && isShopFloorPendingRow(selectedRecord);
  const selectedIsPendingIpr =
    Boolean(selectedRecord) &&
    (!isPendingTab || !isShopFloorPendingRow(selectedRecord)) &&
    selectedRecord?.ipr_uid != null;

  const getSelectedRow = useCallback(
    () => filteredRows.find((u) => getRowId(u) === selected),
    [filteredRows, selected, getRowId]
  );

  const footerFilter = useMemo(
    () =>
      appListFooterFromClientFilter({
        tempSearch,
        sourceRows: allRows,
        filteredRows,
        serverFiltered:
          (!isPendingTab &&
            (params.status !== "all" ||
              params.requestType !== "all" ||
              Boolean(params.fromDate) ||
              Boolean(params.toDate))) ||
          Boolean(appliedSearch),
      }),
    [
      tempSearch,
      allRows,
      filteredRows,
      isPendingTab,
      params.fromDate,
      params.toDate,
      params.status,
      params.requestType,
      appliedSearch,
    ]
  );

  const openUpdateStatusFromPending = useCallback(
    (row) => {
      if (!row?.coil_no_uid || !isShopFloorPendingRow(row)) return;
      if (!addAccess.allowed) return;
      setSelected(pendingRowId(row));
      setEditItem({ ...row });
      setModalMode("add");
      setModalOpen(true);
    },
    [addAccess]
  );

  const openBlankNew = useCallback(() => {
    if (!addAccess.allowed) return;
    setEditItem(null);
    setModalMode("add");
    setModalOpen(true);
  }, [addAccess]);

  const { openNewModal, openEditModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: modalOpen || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => {
      if (isPendingTab && selectedIsShopFloor && selectedRecord?.coil_no_uid) {
        openUpdateStatusFromPending(selectedRecord);
        return;
      }
      openBlankNew();
    }, [
      isPendingTab,
      selectedIsShopFloor,
      selectedRecord,
      openUpdateStatusFromPending,
      openBlankNew,
    ]),
    openEdit: useCallback(
      (row) => {
        if (isShopFloorPendingRow(row)) return;
        setEditItem(row);
        setModalMode("edit");
        setModalOpen(true);
      },
      []
    ),
    openApprove: useCallback(
      (row) => {
        if (isShopFloorPendingRow(row)) return;
        setEditItem(row);
        setModalMode("approve");
        setModalOpen(true);
      },
      []
    ),
    canApproveSelection: useCallback(
      () => selectedIsPendingIpr && !isRowApproved(selectedRecord),
      [selectedIsPendingIpr, selectedRecord]
    ),
    onApproveBlocked: useCallback(() => {
      if (selectedIsShopFloor) {
        toast.info("Select a Pending IPR row to approve, or use New / double-click a shop-floor coil.");
        return;
      }
      if (isRowApproved(selectedRecord)) {
        toast.info("This record is already approved. Edit it before approving again.");
      } else {
        toast.info("Select a pending IPR row to approve (Ctrl+A).");
      }
    }, [selectedIsShopFloor, selectedRecord]),
    openDelete: useCallback((row) => {
      if (isShopFloorPendingRow(row)) return;
      setDeleteItem(row);
    }, []),
    canDeleteSelection: useCallback(() => selectedIsPendingIpr, [selectedIsPendingIpr]),
  });

  const openViewModal = () => {
    if (!selectedIsPendingIpr) return;
    if (!viewAccess.allowed) return;
    setEditItem(selectedRecord);
    setModalMode("view");
    setModalOpen(true);
  };

  const registerHeaders = useMemo(
    () => [
      ["IPR UID", "ipr_uid", (v) => <span className="font-bold text-teal-700 text-[10px]">{v}</span>, { fixed: true, width: "90px" }],
      [
        "Job Card",
        "pjobcardno",
        (_v, row) => renderCoilCompactCell(resolveCoilJobCardLabel(row), "font-mono font-bold text-indigo-700"),
        { width: "120px", copyValue: resolveCoilJobCardLabel },
      ],
      [
        "Machine",
        "macname",
        (_v, row) => renderCoilCompactCell(resolveCoilMachineLabel(row), "font-bold text-slate-800 uppercase"),
        { width: "110px", copyValue: resolveCoilMachineLabel },
      ],
      ["Item Code", "item_code", (v) => (
          <span className="font-bold text-slate-800 uppercase text-[11px] truncate block">{v || "—"}</span>
        ),
        { width: "180px" },
      ],
      ["Description", "item_desc", (v) => (
          <span className="text-[11px] text-slate-600 truncate block" title={v || ""}>
            {v || "—"}
          </span>
        ),
        { width: "160px" },
      ],
      ["Coil", "coil_label", (v) => (<span className="text-[10px] font-bold text-slate-600 uppercase truncate block" title={v || ""}>{v || "—"}</span>), { width: "120px" }],
      ["MRN UID", "mrn_uid", (v, row) => (
          <span
            className="font-bold text-indigo-700 text-[10px] truncate block"
            title={row.lot_label ? `Lot ${row.lot_label}` : v || ""}
          >
            {row.lot_label ? `Lot ${row.lot_label}` : v || "—"}
          </span>
        ),
        { width: "110px" },
      ],
      ["Heat No", "heat_label", (v) => (
          <span className="text-[10px] font-semibold text-slate-700 truncate block" title={v || ""}>
            {v || "—"}
          </span>
        ),
        { width: "100px" },
      ],
      [
        "Balance Status",
        "balance_status",
        (v) => {
          const label = v || "—";
          const cls =
            label === "Full"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : label === "Reassign"
                ? "bg-indigo-50 text-indigo-800 border-indigo-200"
              : label === "Balance"
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : label === "Rejected"
                  ? "bg-rose-50 text-rose-800 border-rose-200"
                  : "bg-slate-50 text-slate-600 border-slate-200";
          return (
            <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${cls}`}>
              {label}
            </span>
          );
        },
        { width: "120px", align: "center" },
      ],
      ["Consumed", "consumed_qty", qtyCell, { width: "80px" }],
      ["Balance", "balance_qty", qtyCell, { width: "80px" }],
      ["Total Qty", "total_qty", qtyCell, { width: "80px" }],
      ["Type", "request_type", (_v, row) => <IprRequestTypeCell row={row} />, { width: "168px", align: "center" }],
      ["Remarks", "remarks", (v) => (<span className="text-[10px] text-slate-600 truncate block" title={v || ""}>{v || "—"}</span>), { width: "150px" }],
      ["Reason", "reason", (v) => (<span className="text-[10px] text-slate-600 truncate block" title={v || ""}>{v || "—"}</span>), { width: "150px" }],
      [
        "Status",
        "approved",
        (v) => (
          <span
            className={`px-2 py-0.5 text-[9px] font-black uppercase border ${
              v
                ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                : "bg-amber-50 text-amber-600 border-amber-100"
            }`}
          >
            {v ? "● AUTHORIZED" : "○ PENDING"}
          </span>
        ),
        { width: "150px" },
      ],
      [
        "Next Step",
        "downstream",
        (v) => (
          <span className="text-[10px] font-bold text-slate-600 uppercase">
            {DOWNSTREAM_LABEL[v] || "—"}
          </span>
        ),
        { width: "120px" },
      ],
      ...auditHeaders(),
    ],
    []
  );

  const headers = isPendingTab ? PENDING_SHOP_FLOOR_HEADERS : registerHeaders;

  const getRowClassName = useCallback(
    (row) => getIprListRowClassName(row, isPendingTab),
    [isPendingTab]
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isPendingTab ? "RM In-process Pending" : "RM In-process Request",
    rows: filteredRows,
    headers,
  });

  const extraFilters = useMemo(
    () => [
      {
        label: "Request Type",
        key: "requestType",
        value: params.requestType,
        variant: "server",
        options: IPR_REQUEST_TYPE_FILTER_OPTIONS,
      },
      {
        label: "Status",
        key: "approvedStatus",
        value: params.status,
        variant: "server",
        options: [
          { label: "All Status", value: "all" },
          { label: "Approved", value: "approved" },
          { label: "Pending", value: "pending" },
        ],
      },
    ],
    [params.requestType, params.status]
  );

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
                  { id: PAGE_TABS.REGISTER, label: "Register", icon: Database },
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
                  onClick={openNewModal}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />
                <ActionButton
                  module={MODULE}
                  action="view"
                  variant="outline"
                  label="View"
                  icon={Eye}
                  disabled={!selectedIsPendingIpr}
                  onClick={openViewModal}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                />
                <ActionButton
                  module={MODULE}
                  action="edit"
                  variant="outline"
                  label="Edit"
                  icon={Edit3}
                  disabled={!selectedIsPendingIpr}
                  record={selectedIsPendingIpr ? selectedRecord : null}
                  onClick={openEditModal}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                />
                <ActionButton
                  module={MODULE}
                  action="authorize"
                  variant="outline"
                  label="Approve"
                  icon={CheckCircle}
                  disabled={!selectedIsPendingIpr || isRowApproved(selectedRecord)}
                  onClick={() => {
                    if (!selectedIsPendingIpr) {
                      toast.info("Select a Pending IPR row to approve.");
                      return;
                    }
                    if (isRowApproved(selectedRecord)) {
                      toast.info("This record is already approved. Edit it before approving again.");
                      return;
                    }
                    setEditItem(selectedRecord);
                    setModalMode("approve");
                    setModalOpen(true);
                  }}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none shrink-0"
                />
                <ActionButton
                  module={MODULE}
                  action="delete"
                  variant="danger"
                  label="Delete"
                  icon={Trash2}
                  disabled={!selectedIsPendingIpr}
                  onClick={() => setDeleteItem(selectedRecord)}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />
                <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1 shrink-0" />
                <button
                  type="button"
                  onClick={fetchRows}
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
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            showDate={!isPendingTab}
            fromDate={params.fromDate}
            toDate={params.toDate}
            extraFilters={isPendingTab ? [] : extraFilters}
            showSearchButton={!isPendingTab}
            quickSearchOnly={isPendingTab}
            applyOnSearchEnter={!isPendingTab}
            applyExtrasOnChange={false}
            searchVariant="quick"
            onApply={(data) => {
              applySearchFromInput();
              setSelected(null);
              if (isPendingTab) return;
              setParams((prev) => ({
                ...prev,
                fromDate: data.fromDate,
                toDate: data.toDate,
                status: data.approvedStatus || prev.status,
                requestType: data.requestType || prev.requestType,
              }));
            }}
            onReset={() => {
              resetSearch();
              setSelected(null);
              setParams({
                ...DEFAULT_PARAMS,
                fromDate: dateFilterDefaults.from,
                toDate: dateFilterDefaults.to,
                sortKey: isPendingTab ? "coil_no_uid" : "ipr_uid",
                sortDir: isPendingTab ? "asc" : "desc",
              });
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder={
              isPendingTab
                ? "Search shop floor or pending IPR"
                : "Search by request, coil, item, or MRN"
            }
            searchLabel={isPendingTab ? "Search Pending" : "Search Register"}
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 h-0 relative bg-white flex flex-col overflow-hidden isolate z-0">
          <DataTable
            key={pageTab}
            headers={headers}
            data={items}
            loading={loading}
            viewMode={viewMode}
            allowCopy
            showSelection
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
            selectedId={selected}
            onSelect={setSelected}
            getRowId={getRowId}
            getRowClassName={getRowClassName}
            onRowDoubleClick={(row) => {
              setSelected(getRowId(row));
              if (isPendingTab && isShopFloorPendingRow(row)) {
                openUpdateStatusFromPending(row);
                return;
              }
              if (!viewAccess.allowed) return;
              setEditItem(row);
              setModalMode(isPendingTab && !isRowApproved(row) ? "approve" : "view");
              setModalOpen(true);
            }}
            emptyMessage={
              isPendingTab
                ? "No shop-floor coils or pending IPR requests"
                : "No in-process requests found"
            }
            cardConfig={
              isPendingTab
                ? PENDING_CARD_CONFIG
                : {
                    titleKey: "ipr_uid",
                    badgeIndices: [10],
                    detailKeys: ["item_code", "item_desc", "mrn_label", "heat_label", "reason", "total_qty"],
                    footerKey: "created_at",
                  }
            }
            {...tableHotkeyProps}
          />
          {totalItems > displayLimit && (
            <div className="border-t border-slate-200 px-3 py-2 flex justify-center">
              <button
                type="button"
                onClick={() => setDisplayLimit((n) => n + 100)}
                className="text-[11px] font-bold uppercase text-indigo-600 hover:text-indigo-800"
              >
                Show more ({displayLimit}/{totalItems})
              </button>
            </div>
          )}
        </div>

        <AppListFooter
          shown={items.length}
          total={totalItems}
          noun={isPendingTab ? "Pending Work" : "In-Process Requests"}
          selected={selected}
          selectedRecord={selectedRecord}
          selectionLabel={rmStoreInProcessSelectionLabel(isPendingTab)}
          onClearSelection={() => setSelected(null)}
          {...footerFilter}
        />
      </div>

      <InProcessRequestModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchRows}
        editData={editItem}
        mode={modalMode}
      />

      <DeleteModal
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onSuccess={() => {
          fetchRows();
          setSelected(null);
        }}
        service={inProcessRequestService}
        entityLabel="In-process Request"
        idKey="ipr_uid"
      />
    </div>
  );
}

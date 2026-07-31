"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, X, ShieldX, Database, ClipboardList, LogOut, CheckCircle, Trash2, Eye } from "lucide-react";
import { toast } from "react-toastify";

import { rmRejectionService } from "@/apps/rmstore/lib/services/rmRejection";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import { uniqueBillNos, parseSavedBillNos, formatBillNosForSave, fetchBillOptions, getBillByNo } from "@/apps/rmstore/lib/utils/rejectionBillOptions";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import GenerateStoreOutDrawer from "@/apps/rmstore/modules/rm-rejection/GenerateStoreOutDrawer";
import ApproveRejectionDrawer from "@/apps/rmstore/modules/rm-rejection/ApproveRejectionDrawer";
import ViewRejectionDrawer from "@/apps/rmstore/modules/rm-rejection/ViewRejectionDrawer";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import DataTable from "@/ui/primitives/DataTable";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ActionButton from "@/ui/primitives/ActionButton";
import SearchableSelect from "@/ui/common/forms/SearchableSelect";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { LIST_PAGE_SEARCH_LABEL_CLASS } from "@/ui/common/list/ListPageSearchField";
import RmStoreListFooter, { rmStoreFooterFromClientFilter } from "@/apps/rmstore/lib/helpers/RmStoreListFooter";

const MODULE = "rm_rejection";
const PAGE_TABS = { REGISTER: "register", PENDING: "pending" };

const PENDING_SOURCE = {
  QC_CHECK: "qc_check",
  IN_PROCESS: "in_process",
  AWAITING_AUTHORIZATION: "awaiting_authorization",
  AWAITING_STORE_OUT: "awaiting_store_out",
  AWAITING_BILL: "awaiting_bill",
};

const PENDING_TYPE_FILTER = {
  ALL: "all",
  QC_CHECK: "qc_check",
  IN_PROCESS: "in_process",
  AWAITING_AUTHORIZATION: "awaiting_authorization",
  AWAITING_STORE_OUT: "awaiting_store_out",
  AWAITING_BILL: "awaiting_bill",
};

function rowPendingTypeKey(row) {
  if (row?.pending_source === PENDING_SOURCE.AWAITING_BILL) return PENDING_TYPE_FILTER.AWAITING_BILL;
  if (row?.pending_source === PENDING_SOURCE.AWAITING_STORE_OUT) return PENDING_TYPE_FILTER.AWAITING_STORE_OUT;
  if (row?.pending_source === PENDING_SOURCE.AWAITING_AUTHORIZATION) return PENDING_TYPE_FILTER.AWAITING_AUTHORIZATION;
  if (row?.pending_source === PENDING_SOURCE.QC_CHECK) return PENDING_TYPE_FILTER.QC_CHECK;
  if (row?.pending_source === PENDING_SOURCE.IN_PROCESS) return PENDING_TYPE_FILTER.IN_PROCESS;
  return PENDING_TYPE_FILTER.ALL;
}

function pendingTypeDisplay(row) {
  if (row?.pending_source === PENDING_SOURCE.AWAITING_BILL) {
    return { label: "Awaiting Bill", className: "bg-indigo-50 text-indigo-700 border-indigo-100" };
  }
  if (row?.pending_source === PENDING_SOURCE.AWAITING_AUTHORIZATION) {
    return { label: "Pending Authorization", className: "bg-amber-50 text-amber-800 border-amber-100" };
  }
  if (row?.pending_source === PENDING_SOURCE.AWAITING_STORE_OUT) {
    return { label: "Store Out Pending", className: "bg-orange-50 text-orange-700 border-orange-100" };
  }
  if (row?.pending_source === PENDING_SOURCE.QC_CHECK) {
    return { label: "QC Fail", className: "bg-sky-50 text-sky-700 border-sky-100" };
  }
  if (row?.pending_source === PENDING_SOURCE.IN_PROCESS) {
    const isLot = row?.rejection_type === "lot" || row?.pending_type === "lot";
    return {
      label: isLot ? "In-Process Lot" : "In-Process Coil",
      className: "bg-violet-50 text-violet-700 border-violet-100",
    };
  }
  return { label: "—", className: "bg-slate-50 text-slate-400 border-slate-100" };
}

function pendingCoilUids(row) {
  const coils = Array.isArray(row?.coils) ? row.coils : [];
  const fromCoils = coils.map((c) => String(c?.coil_no_uid || "").trim()).filter(Boolean);
  if (fromCoils.length) return fromCoils;

  const raw = String(row?.coil_no_uid || "").trim();
  if (!raw) return [];
  if (raw.includes(",")) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [raw];
}

function pendingCoilCount(row) {
  const uids = pendingCoilUids(row);
  return Math.max(Number(row?.coil_count) || 0, uids.length);
}

function pendingInspectorName(row) {
  return (
    row?.inspected_by_name ||
    row?.inspected_by ||
    row?.approved_by ||
    row?.created_by ||
    null
  );
}

function pendingInspectedAt(row) {
  return row?.inspected_at || row?.approved_at || row?.created_at || null;
}

const SOURCE_SEP = " · ";

function rejectionSourceDisplay(row) {
  if (row?.pending_source === PENDING_SOURCE.IN_PROCESS && row?.ipr_uid != null) {
    return `In-Process${SOURCE_SEP}IPR-${row.ipr_uid}`;
  }
  if (row?.pending_source === PENDING_SOURCE.QC_CHECK && row?.qc_check_uid != null) {
    return `QC Fail${SOURCE_SEP}QC-${row.qc_check_uid}`;
  }
  if (row?.ipr_uid != null) return `In-Process${SOURCE_SEP}IPR-${row.ipr_uid}`;
  if (row?.qc_check_uid != null) return `QC Fail${SOURCE_SEP}QC-${row.qc_check_uid}`;
  if (row?.qc_reject_uid != null) return `Register${SOURCE_SEP}REJECT-${row.qc_reject_uid}`;
  if (row?.rejection_origin_label) return row.rejection_origin_label;
  return "-";
}

function rejectionSourceBadgeClass(row) {
  const origin = row?.rejection_origin || row?.pending_source;
  if (origin === PENDING_SOURCE.IN_PROCESS || origin === "in_process" || row?.ipr_uid != null) {
    return "bg-violet-50 text-violet-700 border-violet-100";
  }
  if (origin === PENDING_SOURCE.QC_CHECK || origin === "qc_check" || row?.qc_check_uid != null) {
    return "bg-sky-50 text-sky-700 border-sky-100";
  }
  if (origin === "register" || row?.qc_reject_uid != null) {
    return "bg-rose-50 text-rose-700 border-rose-100";
  }
  return "bg-slate-50 text-slate-500 border-slate-100";
}

function rowKey(row) {
  if (row?.pending_source === PENDING_SOURCE.AWAITING_STORE_OUT && row?.qc_reject_uid != null) {
    return `out-${row.qc_reject_uid}`;
  }
  if (row?.pending_source === PENDING_SOURCE.AWAITING_AUTHORIZATION && row?.qc_reject_uid != null) {
    return `auth-${row.qc_reject_uid}`;
  }
  if (row?.pending_source === PENDING_SOURCE.AWAITING_BILL && row?.qc_reject_uid != null) {
    return `bill-${row.qc_reject_uid}`;
  }
  if (row?.pending_source === PENDING_SOURCE.IN_PROCESS && row?.ipr_uid != null) {
    return `ipr-${row.ipr_uid}`;
  }
  if (row?.pending_source === PENDING_SOURCE.QC_CHECK && row?.qc_check_uid != null) {
    return `qc-${row.qc_check_uid}`;
  }
  if (row?.is_virtual_pending || row?.qc_reject_uid == null) {
    return `pending-${row?.qc_check_uid ?? row?.ipr_uid ?? "x"}`;
  }
  return String(row.qc_reject_uid);
}

function isApproved(row) {
  return row?.approved === true || row?.approved === "t" || row?.approved === 1;
}

function inCreatedRange(row, fromDate, toDate) {
  const raw = row?.created_at;
  if (!raw) return true;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return true;
  if (fromDate) {
    const from = new Date(`${fromDate}T00:00:00`).getTime();
    if (t < from) return false;
  }
  if (toDate) {
    const to = new Date(`${toDate}T23:59:59.999`).getTime();
    if (t > to) return false;
  }
  return true;
}

function isStoreOutApproved(row) {
  return row?.store_out_approved === true || row?.store_out_approved === "t" || row?.store_out_approved === 1;
}

function isAwaitingAuthorizationRow(row) {
  if (row?.qc_reject_uid == null || row?.is_virtual_pending) return false;
  if (
    row?.pending_source === PENDING_SOURCE.AWAITING_AUTHORIZATION ||
    row?.pending_type === PENDING_TYPE_FILTER.AWAITING_AUTHORIZATION
  ) {
    return true;
  }
  return registerStage(row).label === "Pending Authorization";
}

function isStoreOutStartedRow(row) {
  return row?.store_out_started === true || row?.store_out_started === "t";
}

function registerStage(row) {
  if (String(row?.bill_no || "").trim()) {
    return { label: "Complete", className: "bg-emerald-50 text-emerald-700 border-emerald-100" };
  }
  if (isStoreOutApproved(row)) {
    return { label: "Awaiting Bill", className: "bg-indigo-50 text-indigo-700 border-indigo-100" };
  }
  if (isApproved(row)) {
    if (isStoreOutStartedRow(row)) {
      return { label: "Store Out In Progress", className: "bg-orange-50 text-orange-700 border-orange-100" };
    }
    return { label: "Store Out Pending", className: "bg-orange-50 text-orange-700 border-orange-100" };
  }
  if (!isApproved(row)) {
    return { label: "Pending Authorization", className: "bg-amber-50 text-amber-800 border-amber-100" };
  }
}

export default function RmRejectionPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);
  const canAddBill = useMemo(() => canAccess(MODULE, "add").allowed, [canAccess]);
  const canAuthorize = useMemo(() => canAccess(MODULE, "authorize"), [canAccess]);

  const [pageTab, setPageTab] = useState(PAGE_TABS.PENDING);
  const isPendingTab = pageTab === PAGE_TABS.PENDING;

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 5000,
    pendingType: PENDING_TYPE_FILTER.ALL,
    registerStage: "all",
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "inspected_at",
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

  const { tempSearch, setTempSearch, resetSearch } = useAppliedListSearch();
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [storeOutDrawerOpen, setStoreOutDrawerOpen] = useState(false);
  const [approveDrawerOpen, setApproveDrawerOpen] = useState(false);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewRow, setViewRow] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [billDraftNos, setBillDraftNos] = useState([]);
  const [billSaving, setBillSaving] = useState(false);

  const handleTabChange = (tab) => {
    setPageTab(tab);
    setSelected(null);
    setDisplayLimit(100);
    resetSearch();
    setParams((prev) => ({
      ...prev,
      pendingType: PENDING_TYPE_FILTER.ALL,
      registerStage: "all",
      sortKey: tab === PAGE_TABS.PENDING ? "inspected_at" : "qc_reject_uid",
      sortDir: "desc",
    }));
  };

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = isPendingTab
          ? await rmRejectionService.getPendingList({ page, limit })
          : await rmRejectionService.getAll({ page, limit });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Could not load the rejections. Please try again.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, isPendingTab]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const filteredRows = useMemo(() => {
    let data = allRows;
    if (isPendingTab) {
      if (params.pendingType !== PENDING_TYPE_FILTER.ALL) {
        data = data.filter((row) => rowPendingTypeKey(row) === params.pendingType);
      }
    } else {
      data = data.filter((row) => inCreatedRange(row, params.fromDate, params.toDate));
      const stage = String(params.registerStage || "all").toLowerCase();
      if (stage === "complete") {
        data = data.filter((row) => String(row?.bill_no || "").trim());
      } else if (stage === "incomplete") {
        data = data.filter((row) => !String(row?.bill_no || "").trim());
      }
    }
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(data, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [
    allRows,
    isPendingTab,
    params.pendingType,
    params.registerStage,
    params.fromDate,
    params.toDate,
    tempSearch,
    params.sortKey,
    params.sortDir,
  ]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;
  const footerFilter = useMemo(
    () =>
      rmStoreFooterFromClientFilter({
        tempSearch,
        sourceRows: allRows,
        filteredRows,
      }),
    [tempSearch, allRows, filteredRows]
  );
  const selectedRecord = useMemo(
    () => filteredRows.find((r) => rowKey(r) === selected) || null,
    [filteredRows, selected]
  );

  const canGenerateStoreOut =
    isPendingTab &&
    selectedRecord?.is_virtual_pending &&
    (selectedRecord?.pending_source === PENDING_SOURCE.QC_CHECK ||
      selectedRecord?.pending_source === PENDING_SOURCE.IN_PROCESS);

  const canApproveRegister = isAwaitingAuthorizationRow(selectedRecord);

  const approveDisabledReason = useMemo(() => {
    if (!selectedRecord) return "Select a Pending Authorization row (REJECT-#)";
    if (!isAwaitingAuthorizationRow(selectedRecord)) {
      return "Approve is only for Pending Authorization rows";
    }
    return "";
  }, [selectedRecord]);

  const handleOpenApproveDrawer = () => {
    if (!canApproveRegister) return;
    setApproveDrawerOpen(true);
  };

  const handleOpenViewDrawer = (row = selectedRecord) => {
    if (!row?.qc_reject_uid) return;
    setViewRow(row);
    setViewDrawerOpen(true);
  };

  const canViewRegister = !isPendingTab && selectedRecord?.qc_reject_uid != null;

  const canDeleteRegister = useMemo(() => {
    if (isPendingTab) return false;
    if (!selectedRecord?.qc_reject_uid) return false;
    if (String(selectedRecord?.bill_no || "").trim()) return false;
    if (isStoreOutStartedRow(selectedRecord)) return false;
    return true;
  }, [isPendingTab, selectedRecord]);

  const deleteDisabledReason = useMemo(() => {
    if (isPendingTab) return "";
    if (!selectedRecord?.qc_reject_uid) return "Select a register entry to delete";
    if (String(selectedRecord?.bill_no || "").trim()) return "Complete register entries cannot be deleted";
    if (isStoreOutStartedRow(selectedRecord)) {
      return selectedRecord?.out_uid
        ? `Store Out #${selectedRecord.out_uid} has started. Delete Store Out first.`
        : "Store Out work has started. Delete Store Out first.";
    }
    return "";
  }, [isPendingTab, selectedRecord]);

  const canEditBill =
    canAddBill &&
    selectedRecord?.qc_reject_uid != null &&
    (selectedRecord?.pending_source === PENDING_SOURCE.AWAITING_BILL ||
      registerStage(selectedRecord).label === "Awaiting Bill");

  useEffect(() => {
    if (
      selectedRecord?.qc_reject_uid != null &&
      (canEditBill || (!isPendingTab && selectedRecord?.bill_no))
    ) {
      setBillDraftNos(parseSavedBillNos(selectedRecord.bill_no));
    } else {
      setBillDraftNos([]);
    }
  }, [selectedRecord?.qc_reject_uid, selectedRecord?.bill_no, selectedRecord?.pending_source, isPendingTab, canEditBill]);

  const savedBillNo = useMemo(
    () => formatBillNosForSave(parseSavedBillNos(selectedRecord?.bill_no)) ?? "",
    [selectedRecord?.bill_no]
  );
  const billDraftFormatted = useMemo(
    () => formatBillNosForSave(billDraftNos) ?? "",
    [billDraftNos]
  );
  const billDirty = billDraftFormatted !== savedBillNo;

  const handleSaveBillNo = async () => {
    const id = selectedRecord?.qc_reject_uid;
    if (!id || !canEditBill) return;
    const payload = formatBillNosForSave(billDraftNos);
    if (!payload) {
      toast.info("Select at least one bill number to complete.");
      return;
    }
    setBillSaving(true);
    try {
      const res = await rmRejectionService.updateBill(id, payload);
      const saved = res?.data;
      setBillDraftNos(parseSavedBillNos(saved?.bill_no ?? payload));
      toast.success(res?.message || "Bill saved. RM Rejection is complete.");
      setAllRows((prev) =>
        prev.map((row) =>
          row.qc_reject_uid === id
            ? { ...row, bill_no: saved?.bill_no ?? payload }
            : row
        )
      );
      await fetchRows();
      setSelected(null);
    } catch (err) {
      toast.error(err?.message || "Could not save the bill number. Please try again.");
    } finally {
      setBillSaving(false);
    }
  };

  const pendingHeaders = useMemo(
    () => [
      ["Ref #", "qc_check_uid", (v, row) => (
          <span className="font-bold text-sky-700 text-[10px]">
            {row?.qc_reject_uid != null &&
            (row?.pending_source === PENDING_SOURCE.AWAITING_BILL ||
              row?.pending_source === PENDING_SOURCE.AWAITING_STORE_OUT ||
              row?.pending_source === PENDING_SOURCE.AWAITING_AUTHORIZATION)
              ? `REJECT-${row.qc_reject_uid}`
              : row?.ipr_uid != null
                ? `IPR-${row.ipr_uid}`
                : v != null
                  ? `QC-${v}`
                  : "—"}
          </span>
        ),
        { width: "90px" },
      ],
      ["Type", "pending_type", (_v, row) => {
          const t = pendingTypeDisplay(row);
          return (
            <span
              className={`inline-flex px-2 py-0.5 text-[9px] font-black uppercase border ${t.className}`}
            >
              {t.label}
            </span>
          );
        },
        { fixed: true, width: "150px" },
      ],
      [
        "Source",
        "rejection_origin_label",
        (_v, row) => (
          <span
            className={`inline-flex px-2 py-0.5 text-[9px] font-black uppercase border ${rejectionSourceBadgeClass(row)}`}
          >
            {rejectionSourceDisplay(row)}
          </span>
        ),
        { width: "140px" },
      ],
      
      ["Coils", "coil_count", (_v, row) => (
          <span className="font-bold tabular-nums text-[11px] text-slate-800">
            {pendingCoilCount(row) || "—"}
          </span>
        ),
        { width: "60px" },
      ],
      ["Coil UID", "coil_no_uid", (_v, row) => {
          const uids = pendingCoilUids(row);
          const label = uids.join(", ");
          const coilSources = (row?.coils || [])
            .map((c) => {
              if (c?.ipr_uid != null) return `${c.coil_no_uid}: IPR-${c.ipr_uid}`;
              if (c?.qc_check_uid != null) return `${c.coil_no_uid}: QC-${c.qc_check_uid}`;
              return c?.coil_no_uid;
            })
            .filter(Boolean)
            .join("\n");
          return (
            <span
              className="font-mono text-[10px] font-bold text-slate-800 truncate block"
              title={coilSources || label || ""}
            >
              {label || "—"}
            </span>
          );
        },
        { width: "180px" },
      ],
      ["MRN", "mrn_no", (v, row) => <span className="font-bold text-slate-800 text-[10px]">{v ?? row?.mrn_refs ?? "—"}</span>, { width: "90px" }],
      ["Heat No.", "heat_no", (v, row) => (
          <span className="font-mono text-[10px] font-bold text-amber-700">{v || row?.heat_nos || "—"}</span>
        ),
        { width: "120px" },
      ],
      ["Item", "item_code", (v, row) => (
          <span className="text-slate-700 text-[10px] uppercase">{v || row?.item_codes || "—"}</span>
        ),
        { width: "140px" },
      ],
      ["Qty", "qty", (v, row) => (
          <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px] tabular-nums">
            {Number(v ?? row?.total_qty ?? 0).toLocaleString()}
          </span>
        ),
        { width: "90px" },
      ],
      [
        "Store Out",
        "out_uid",
        (v) => (
          <span className={`text-[10px] font-bold ${v ? "text-indigo-600" : "text-slate-400"}`}>
            {v != null ? `OUT-${v}` : "—"}
          </span>
        ),
        { width: "90px" },
      ],
      ["Failure Reason", "failure_reason", (v, row) => (
          <span className="text-rose-700 text-[10px] truncate block">{v || row?.reason || "—"}</span>
        ),
        { width: "220px" },
      ],
      ["Inspected By", "inspected_by_name", (_v, row) => (
          <span className="text-[10px] font-semibold text-slate-600 uppercase truncate block" title={pendingInspectorName(row) || ""}>
            {pendingInspectorName(row) || "—"}
          </span>
        ),
        { width: "120px" },
      ],
      ["Inspected At", "inspected_at", (_v, row) => {
          const at = pendingInspectedAt(row);
          return (
            <span className="text-[10px] text-slate-400 font-medium">
              {at ? formatDateTime(at) : "—"}
            </span>
          );
        },
        { width: "150px" },
      ],
    ],
    []
  );

  const registerHeaders = useMemo(
    () => [
      ["Reject UID", "qc_reject_uid", (v) => <span className="font-bold text-rose-600 text-[10px]">{v}</span>, { fixed: true, width: "100px" }],
      [
        "Source",
        "rejection_origin_label",
        (_v, row) => (
          <span
            className={`inline-flex px-2 py-0.5 text-[9px] font-black uppercase border ${rejectionSourceBadgeClass(row)}`}
          >
            {rejectionSourceDisplay(row)}
          </span>
        ),
        { width: "140px" },
      ],
      ["MRN Refs", "mrn_refs", (v) => <span className="font-bold text-slate-800 text-[10px]">{v || "—"}</span>, { width: "120px" }],
      ["Heat Nos.", "heat_nos", (v) => <span className="font-mono text-[10px] font-bold text-amber-700">{v || "—"}</span>, { width: "140px" }],
      ["Item Codes", "item_codes", (v) => <span className="text-slate-700 text-[10px] uppercase">{v || "—"}</span>, { width: "160px" }],
      ["Reason", "reason", (v) => <span className="text-rose-700 text-[10px] font-bold truncate block">{v || "—"}</span>, { width: "180px" }],
      ["Store Out", "out_uid", (v) => (
        <span className={`text-[10px] font-bold ${v ? "text-indigo-600" : "text-slate-400"}`}>
          {v != null ? `OUT-${v}` : "—"}
        </span>
      ), { width: "90px" }],
      ["Bill Number", "bill_no", (v) => (
        <span className={`text-[10px] font-bold uppercase ${v ? "text-slate-800" : "text-slate-400"}`}>
          {v || "—"}
        </span>
      ), { width: "140px" }],
      ["Total Qty", "total_qty", (v) => (
        <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px] tabular-nums">
          {v != null ? Number(v).toLocaleString() : "0"}
        </span>
      ), { width: "100px" }],
      ["Coils", "coil_count", (v) => <span className="font-bold tabular-nums text-[11px]">{v ?? 0}</span>, { width: "70px" }],
      [
        "Stage",
        "stage",
        (_v, row) => {
          const s = registerStage(row);
          return (
            <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${s.className}`}>
              {s.label}
            </span>
          );
        },
        { width: "130px" },
      ],
      ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400">{formatDateTime(v)}</span>, { width: "150px" }],
    ],
    []
  );

  const headers = isPendingTab ? pendingHeaders : registerHeaders;

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isPendingTab ? "RM Rejection Pending" : "RM Rejection Register",
    rows: filteredRows,
    headers,
  });

  const extraFilters = useMemo(() => {
    if (isPendingTab) {
      return [
        {
          label: "Type",
          key: "pendingType",
          value: params.pendingType,
          preserveOrder: true,
          options: [
            { label: "All", value: PENDING_TYPE_FILTER.ALL },
            { label: "QC Fail", value: PENDING_TYPE_FILTER.QC_CHECK },
            { label: "In-Process Rejection", value: PENDING_TYPE_FILTER.IN_PROCESS },
            { label: "Pending Authorization", value: PENDING_TYPE_FILTER.AWAITING_AUTHORIZATION },
            { label: "Store Out Pending", value: PENDING_TYPE_FILTER.AWAITING_STORE_OUT },
            { label: "Awaiting Bill", value: PENDING_TYPE_FILTER.AWAITING_BILL },
          ],
        },
      ];
    }
    return [
      {
        label: "Stage",
        key: "registerStage",
        value: params.registerStage || "all",
        preserveOrder: true,
        options: [
          { label: "All", value: "all" },
          { label: "Complete", value: "complete" },
          { label: "Incomplete", value: "incomplete" },
        ],
      },
    ];
  }, [isPendingTab, params.pendingType, params.registerStage]);

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
                {isPendingTab && (
                  <>
                    <ActionButton
                      module={MODULE}
                      action="add"
                      label="Generate Store Out"
                      icon={LogOut}
                      disabled={!canGenerateStoreOut}
                      onClick={() => setStoreOutDrawerOpen(true)}
                      className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                    />
                    {canAuthorize.allowed ? (
                      <ActionButton
                        module={MODULE}
                        action="authorize"
                        variant="outline"
                        label="Approve"
                        icon={CheckCircle}
                        disabled={!canApproveRegister}
                        title={approveDisabledReason || undefined}
                        onClick={handleOpenApproveDrawer}
                        className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none shrink-0 disabled:text-slate-400 disabled:border-slate-200"
                      />
                    ) : (
                      <button
                        type="button"
                        disabled
                        title="Authorize permission required on RM Rejection"
                        className="rounded-none h-9 text-[11px] font-bold uppercase px-4 border border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed shrink-0 flex items-center gap-2"
                      >
                        <CheckCircle size={14} />
                        Approve
                      </button>
                    )}
                  </>
                )}
                {!isPendingTab && (
                  <>
                    <ActionButton
                      module={MODULE}
                      action="view"
                      variant="outline"
                      label="View"
                      icon={Eye}
                      disabled={!canViewRegister}
                      onClick={() => handleOpenViewDrawer()}
                      className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                    />
                    <ActionButton
                      module={MODULE}
                      action="delete"
                      variant="danger"
                      label="Delete"
                      icon={Trash2}
                      disabled={!canDeleteRegister}
                      title={deleteDisabledReason || undefined}
                      onClick={() => setDeleteItem(selectedRecord)}
                      className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                    />
                  </>
                )}
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
          {selectedRecord && (
            <div className="border-b border-rose-100 bg-rose-50 px-3 py-2 space-y-2">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <span className="text-[10px] font-bold text-rose-600 uppercase truncate">
                  Selected:{" "}
                  {selectedRecord.qc_reject_uid != null &&
                  selectedRecord.pending_source === PENDING_SOURCE.AWAITING_AUTHORIZATION
                    ? `REJECT-${selectedRecord.qc_reject_uid} · Pending authorization`
                    : selectedRecord.qc_reject_uid != null &&
                        selectedRecord.pending_source === PENDING_SOURCE.AWAITING_STORE_OUT
                      ? selectedRecord.out_uid
                        ? `REJECT-${selectedRecord.qc_reject_uid} · OUT-${selectedRecord.out_uid} · Store Out approve pending`
                        : `REJECT-${selectedRecord.qc_reject_uid} · Store Out Pending (Scan/Edit in Store Out)`
                      : selectedRecord.qc_reject_uid != null &&
                          selectedRecord.pending_source === PENDING_SOURCE.AWAITING_BILL
                        ? `REJECT-${selectedRecord.qc_reject_uid} · Store Out #${selectedRecord.out_uid ?? "—"}`
                        : !isPendingTab && selectedRecord.qc_reject_uid != null
                          ? `REJECT-${selectedRecord.qc_reject_uid} · ${registerStage(selectedRecord).label}`
                          : selectedRecord.pending_source === PENDING_SOURCE.IN_PROCESS
                            ? `In-Process #${selectedRecord.ipr_uid}`
                            : selectedRecord.pending_source === PENDING_SOURCE.QC_CHECK
                              ? `QC Check #${selectedRecord.qc_check_uid}`
                              : selectedRecord.qc_reject_uid != null
                                ? `REJECT-${selectedRecord.qc_reject_uid}`
                                : "Pending"}
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-rose-400 hover:text-rose-600 flex items-center gap-1 font-bold text-[10px] uppercase shrink-0"
                >
                  <X size={14} /> Clear
                </button>
              </div>

              {canEditBill ? (
                <div className="w-full min-w-0 space-y-1.5" data-compact-form-bar>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-2">
                    <span className={`${LIST_PAGE_SEARCH_LABEL_CLASS} shrink-0 pt-1.5 sm:pt-2`}>Bill</span>
                    <div className="w-full min-w-0 flex-1" title="Search and select bill numbers">
                      <SearchableSelect
                        multiple
                        showTags
                        variant="toolbar"
                        heightClass="h-8"
                        value={billDraftNos}
                        onChange={(nos) => setBillDraftNos(uniqueBillNos(nos))}
                        fetchService={fetchBillOptions}
                        getByIdService={getBillByNo}
                        dataKey="bill_no"
                        labelKey="bill_no"
                        labelOnlyDisplay
                        placeholder="Select bill numbers"
                        emptyMessage="No bill numbers found"
                        usePortal
                        maxVisibleTags={3}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSaveBillNo()}
                      disabled={billSaving || !billDirty}
                      className="h-9 w-full sm:w-auto sm:shrink-0 px-3 border border-indigo-300 bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold uppercase disabled:opacity-50"
                    >
                      {billSaving ? "…" : "Save & Complete"}
                    </button>
                  </div>
                  <p className="text-[10px] text-indigo-700 font-semibold">
                    Store Out is done. Add bill number(s) like Forwarding Note, then save to finish.
                  </p>
                </div>
              ) : !isPendingTab && selectedRecord?.bill_no ? (
                <p className="text-xs font-bold text-slate-700 uppercase break-all">
                  Bill {selectedRecord.bill_no}
                </p>
              ) : null}
            </div>
          )}
        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            showDate={!isPendingTab}
            fromDate={params.fromDate}
            toDate={params.toDate}
            extraFilters={extraFilters}
            instantClientExtras={isPendingTab}
            applyExtrasOnChange={!isPendingTab}
            showSearchButton={false}
            applyOnSearchEnter={false}
            searchVariant="quick"
            onApply={(data) => {
              setSelected(null);
              setDisplayLimit(100);
              setParams((prev) => ({
                ...prev,
                fromDate: data.fromDate,
                toDate: data.toDate,
                ...(isPendingTab
                  ? { pendingType: data.pendingType || PENDING_TYPE_FILTER.ALL }
                  : { registerStage: data.registerStage || "all" }),
              }));
            }}
            onReset={() => {
              resetSearch();
              setSelected(null);
              setDisplayLimit(100);
              setParams({
                pageSize: 5000,
                registerStage: "all",
                pendingType: PENDING_TYPE_FILTER.ALL,
                fromDate: dateFilterDefaults.from,
                toDate: dateFilterDefaults.to,
                sortKey: isPendingTab ? "inspected_at" : "qc_reject_uid",
                sortDir: "desc",
              });
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder={
              isPendingTab
                ? "Search by coil, MRN, heat, or reason"
                : "Search by MRN, heat, or reason"
            }
            searchLabel={isPendingTab ? "Search Pending" : "Search Register"}
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
            emptyIcon={ShieldX}
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
            getRowId={(row) => rowKey(row)}
            onRowDoubleClick={
              !isPendingTab
                ? (row) => {
                    if (row?.qc_reject_uid == null) return;
                    setSelected(rowKey(row));
                    handleOpenViewDrawer(row);
                  }
                : undefined
            }
            onLoadMore={() => {
              if (!loading && items.length < totalItems) setDisplayLimit((n) => n + 100);
            }}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={
              isPendingTab
                ? {
                    titleKey: "coil_no_uid",
                    badgeIndices: [1],
                    detailKeys: ["coil_count", "coil_no_uid", "mrn_no", "failure_reason"],
                    footerKey: "inspected_at",
                  }
                : { titleKey: "qc_reject_uid", badgeIndices: [9], detailIndices: [1, 2, 4], footerKey: "created_at" }
            }
          />
        </div>

        <RmStoreListFooter
          shown={items.length}
          total={totalItems}
          label={isPendingTab ? "Pending Rejections" : "Register Entries"}
          {...footerFilter}
        />
      </div>

      <GenerateStoreOutDrawer
        open={storeOutDrawerOpen}
        onClose={() => setStoreOutDrawerOpen(false)}
        row={selectedRecord}
        onSuccess={() => {
          setSelected(null);
          setStoreOutDrawerOpen(false);
          toast.info("Register mein save ho gaya. Pending list mein Pending Authorization dikhega — Approve karein.");
          void fetchRows();
        }}
      />

      <ApproveRejectionDrawer
        open={approveDrawerOpen}
        onClose={() => setApproveDrawerOpen(false)}
        row={selectedRecord}
        onSuccess={() => {
          setSelected(null);
          setApproveDrawerOpen(false);
          toast.info("Rejection approved. Ab Store Out → Pending mein scan + approve karein.");
          void fetchRows();
        }}
      />

      <ViewRejectionDrawer
        open={viewDrawerOpen}
        onClose={() => {
          setViewDrawerOpen(false);
          setViewRow(null);
        }}
        row={viewRow || selectedRecord}
      />

      <DeleteModal
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onSuccess={() => {
          setSelected(null);
          if (!isPendingTab) {
            handleTabChange(PAGE_TABS.PENDING);
            toast.info("Register delete ho gaya. Item Pending tab mein wapas aa gaya.");
          } else {
            void fetchRows();
          }
        }}
        service={rmRejectionService}
        entityLabel="RM Rejection"
        idKey="qc_reject_uid"
        titleKey="qc_reject_uid"
        moduleSlug={MODULE}
        warningMessage="This removes the register entry and unlinks coils. Allowed only before Store Out work starts (Scan/Edit)."
      />
    </div>
  );
}

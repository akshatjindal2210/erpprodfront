"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Trash2, X, Warehouse, ClipboardList, CheckCircle, Edit3, FileEdit } from "lucide-react";
import { toast } from "react-toastify";

import { outEntryService } from "@/apps/rmstore/lib/services/outEntry";
import { getOutEntryTypeLabel } from "@/apps/rmstore/lib/constants/outEntryTypes";
import { RM_OUT_ENTRY_STATUS_FILTER_OPTIONS, buildRmOutEntryListFilters, isRmOutEntryScanDraft, pendingRmStoreOutStatus, rmOutEntryScanProgressLabel, rmOutEntryStatusLabel } from "@/apps/rmstore/lib/utils/outEntryScanStatus";
import { PENDING_TYPE, PENDING_TYPE_FILTER_OPTIONS, parseSeedCoilUids, pendingRowId, pendingTypeLabel } from "@/apps/rmstore/modules/out-entry/pendingOutRows";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import CoilScanEntryModal from "@/apps/rmstore/modules/shared/CoilScanEntryModal";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import DataTable from "@/ui/primitives/DataTable";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import RmStoreListFooter, { rmStoreFooterFromClientFilter } from "@/apps/rmstore/lib/helpers/RmStoreListFooter";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout, LIST_PAGE_ACTION_CLASS } from "@/ui/common/list/ListPageToolbar";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import ActionButton from "@/ui/primitives/ActionButton";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { formatDateTime } from "@/platform/utils/core/utilHelper";

const MODULE = "rm_out_entry";

const PAGE_TABS = {
  STORE_OUT: "store_out",
  PENDING: "pending",
};

function pendingToOutEntryRow(row) {
  if (!row?.out_uid) return null;
  return {
    out_uid: row.out_uid,
    entry_type: row.entry_type,
    qc_reject_uid: row.qc_reject_uid,
    scan_complete: row.scan_complete,
    approved: row.approved ?? false,
    issue_uid: row.issue_uid,
    pjobcardno: row.pjobcardno,
    coil_count: row.coil_count,
    pending_coil_count: row.pending_coil_count,
  };
}

function isRmOutEntryApprovable(row) {
  if (!row) return false;
  if (isRmOutEntryScanDraft(row)) return false;
  if (row.approved === true || row.approved === "t" || row.approved === 1) return false;
  return row.scan_complete === true || row.scan_complete === "t" || row.scan_complete === 1;
}

function isRowApproved(row) {
  return row?.approved === true || row?.approved === "t" || row?.approved === 1;
}

function isRowScanComplete(row) {
  return row?.scan_complete === true || row?.scan_complete === "t" || row?.scan_complete === 1;
}

function PendingTypeBadge({ type }) {
  const t = String(type || "").toLowerCase();
  const label = pendingTypeLabel(t);
  const className =
    t === PENDING_TYPE.JOB_CARD
      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
      : t === PENDING_TYPE.BATCH
        ? "bg-violet-50 text-violet-700 border-violet-200"
        : t === PENDING_TYPE.REJECTION
          ? "bg-rose-50 text-rose-700 border-rose-200"
          : "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${className}`}>
      {label}
    </span>
  );
}

export default function StoreOutPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);
  const canApproveStoreOut = useMemo(() => canAccess(MODULE, "authorize").allowed, [canAccess]);

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
  const [pendingParams, setPendingParams] = useState({
    pageSize: 500,
    sortKey: "sort_at",
    sortDir: "desc",
    pendingType: PENDING_TYPE.ALL,
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
  const [pendingRows, setPendingRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [editItem, setEditItem] = useState(null);
  const [seedFromCoil, setSeedFromCoil] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

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

  const fetchPendingAll = useCallback(async () => {
    setLoading(true);
    try {
      const pendingTypeFilter =
        pendingParams.pendingType && pendingParams.pendingType !== PENDING_TYPE.ALL
          ? { pending_type: pendingParams.pendingType }
          : {};
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await outEntryService.getPendingList({
          page,
          limit,
          filters: pendingTypeFilter,
        });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, pendingParams.pageSize);
      setPendingRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Could not load pending store-out rows. Please try again.");
      setPendingRows([]);
    } finally {
      setLoading(false);
    }
  }, [pendingParams.pageSize, pendingParams.pendingType]);

  useEffect(() => {
    if (isStoreOut) fetchOuts();
    else fetchPendingAll();
  }, [isStoreOut, fetchOuts, fetchPendingAll]);

  const activeSourceRows = isStoreOut ? allRows : pendingRows;
  const activeSortKey = isStoreOut ? params.sortKey : pendingParams.sortKey;
  const activeSortDir = isStoreOut ? params.sortDir : pendingParams.sortDir;

  const filteredRows = useMemo(() => {
    let data = activeSourceRows;
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(data, tempSearch, { skipSort: !!activeSortKey });
    }
    return sortRowsByKey(data, activeSortKey, activeSortDir);
  }, [isStoreOut, activeSourceRows, pendingParams.pendingType, tempSearch, activeSortKey, activeSortDir]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;
  const footerFilter = useMemo(
    () =>
      rmStoreFooterFromClientFilter({
        tempSearch,
        sourceRows: activeSourceRows,
        filteredRows,
        serverFiltered: isStoreOut
          ? params.status !== "all" || Boolean(appliedSearch)
          : pendingParams.pendingType !== PENDING_TYPE.ALL,
      }),
    [tempSearch, activeSourceRows, filteredRows, isStoreOut, params.status, appliedSearch, pendingParams.pendingType]
  );

  const getRowId = useCallback(
    (row) => {
      if (!row) return "row-unknown";
      if (isStoreOut) return row.out_uid ?? "out-unknown";
      return pendingRowId(row);
    },
    [isStoreOut]
  );

  const selectedRecord = useMemo(
    () => filteredRows.find((r) => getRowId(r) === selected) || null,
    [filteredRows, selected, getRowId]
  );

  const selectedOutEntryRecord = useMemo(() => {
    if (!selectedRecord) return null;
    if (isStoreOut) return selectedRecord;
    return pendingToOutEntryRow(selectedRecord);
  }, [isStoreOut, selectedRecord]);

  const selectedIsDraft = useMemo(() => {
    if (isStoreOut) return Boolean(selectedRecord && isRmOutEntryScanDraft(selectedRecord));
    if (!selectedRecord?.out_uid) return false;
    return !isRowScanComplete(selectedRecord);
  }, [isStoreOut, selectedRecord]);

  const selectedApprovable = isRmOutEntryApprovable(selectedOutEntryRecord);
  const selectedPendingEditable = useMemo(() => {
    if (isStoreOut || !selectedRecord?.out_uid) return false;
    return isRowScanComplete(selectedRecord) && !selectedIsDraft;
  }, [isStoreOut, selectedRecord, selectedIsDraft]);

  const approveEnabled =
    Boolean(selectedOutEntryRecord) && selectedApprovable && canApproveStoreOut;

  const openBlankStoreOut = useCallback(() => {
    setModalMode("add");
    setEditItem(null);
    setSeedFromCoil(null);
    setModalOpen(true);
  }, []);

  const openDraftForm = useCallback((row) => {
    if (!row?.out_uid || !isRmOutEntryScanDraft(row)) return;
    setModalMode("edit");
    setSeedFromCoil(null);
    setEditItem(row);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((row) => {
    if (!row?.out_uid) return;
    setModalMode("edit");
    setSeedFromCoil(null);
    setEditItem(row);
    setModalOpen(true);
  }, []);

  const openApprove = useCallback((row) => {
    if (!row?.out_uid) return;
    if (!isRmOutEntryApprovable(row)) {
      toast.error("Complete all coil scans and submit before approving.");
      return;
    }
    setModalMode("approve");
    setSeedFromCoil(null);
    setEditItem(row);
    setModalOpen(true);
  }, []);

  const openFromPendingRow = useCallback((row) => {
    if (row?.out_uid) return;

    const type = String(row?.pending_type || "").toLowerCase();

    if (type === PENDING_TYPE.REJECTION) {
      const rejectId = row?.qc_reject_uid;
      if (!rejectId) return;
      setEditItem(null);
      setModalMode("add");
      setSeedFromCoil({
        entry_type: "rm_rejection",
        qc_reject_uid: rejectId,
        coil_count: row.coil_count ?? 0,
        total_qty: row.qty ?? row.total_qty ?? 0,
        item_codes: row.item_codes ?? row.item_code ?? null,
        item_descs: row.item_descs ?? row.item_desc ?? row.rm_item_desc ?? null,
        heat_nos: row.heat_nos ?? row.heat_no ?? null,
        mrn_refs: row.mrn_refs ?? row.mrn_no ?? null,
        reason: row.reason ?? null,
        rejection_remarks: row.rejection_remarks ?? row.remarks ?? null,
      });
      setModalOpen(true);
      return;
    }

    if (type === PENDING_TYPE.JOB_CARD) {
      const uids = parseSeedCoilUids(row);
      if (!uids.length) {
        toast.info("No coils pending for this job card.");
        return;
      }
      setEditItem(null);
      setModalMode("add");
      setSeedFromCoil({
        coil_uids: uids,
        issue_uid: row.issue_uid,
        pjobcardno: row.pjobcardno,
        macname: row.macname ?? null,
      });
      setModalOpen(true);
    }
  }, []);

  const buildPendingDraftRow = useCallback((row) => {
    if (!row?.out_uid) return null;
    const type = String(row.pending_type || "").toLowerCase();
    return {
      out_uid: row.out_uid,
      entry_type:
        row.entry_type ||
        (type === PENDING_TYPE.JOB_CARD ? "job_card" : type === PENDING_TYPE.REJECTION ? "rm_rejection" : row.entry_type),
      scan_complete: row.scan_complete,
      issue_uid: row.issue_uid,
      pjobcardno: row.pjobcardno,
      qc_reject_uid: row.qc_reject_uid,
    };
  }, []);

  const handleStartOutEntry = useCallback(
    (row) => {
      if (!row) {
        toast.info("Select a pending row first.");
        return;
      }
      openFromPendingRow(row);
    },
    [openFromPendingRow]
  );

  const handleNewClick = useCallback(() => {
    if (isStoreOut) {
      openBlankStoreOut();
      return;
    }
    if (!selectedRecord) {
      toast.info("Select a pending row first.");
      return;
    }
    if (selectedRecord.out_uid) {
      if (selectedIsDraft) {
        toast.info("An existing draft is open — use the Draft button to continue.");
      } else {
        toast.info("Scanning is complete — authorize the store-out entry.");
      }
      return;
    }
    handleStartOutEntry(selectedRecord);
  }, [isStoreOut, selectedRecord, selectedIsDraft, openBlankStoreOut, handleStartOutEntry]);

  const handleDraftClick = useCallback(() => {
    if (!selectedRecord?.out_uid || !selectedIsDraft) {
      toast.info("Select a draft row, then click Draft.");
      return;
    }
    const rec = isStoreOut ? selectedRecord : buildPendingDraftRow(selectedRecord);
    if (!rec || !isRmOutEntryScanDraft(rec)) return;
    openDraftForm(rec);
  }, [selectedRecord, selectedIsDraft, isStoreOut, buildPendingDraftRow, openDraftForm]);

  const handleEditClick = useCallback(() => {
    const row = selectedRecord;
    if (!row) {
      toast.info("Select a row to edit.");
      return;
    }
    if (isStoreOut) {
      if (isRmOutEntryScanDraft(row)) {
        toast.info("Select a draft row, then click Draft.");
        return;
      }
      openEdit(row);
      return;
    }
    const rec = buildPendingDraftRow(row);
    if (!rec) {
      toast.info("Select a pending store-out row to edit.");
      return;
    }
    if (isRmOutEntryScanDraft(rec)) {
      toast.info("Select a draft row, then click Draft.");
      return;
    }
    openEdit(rec);
  }, [isStoreOut, selectedRecord, buildPendingDraftRow, openEdit]);

  const handleApproveClick = useCallback(() => {
    const rec = selectedOutEntryRecord;
    if (!rec) {
      toast.info(
        isStoreOut
          ? "Select a pending row to approve."
          : "Select a row with completed store out scans to approve."
      );
      return;
    }
    if (!canApproveStoreOut) {
      toast.error("You do not have permission to authorize store out.");
      return;
    }
    if (!isRmOutEntryApprovable(rec)) {
      toast.error("Complete all coil scans and submit before approving.");
      return;
    }
    openApprove(rec);
  }, [selectedOutEntryRecord, canApproveStoreOut, isStoreOut, openApprove]);

  const handleDeleteClick = useCallback(() => {
    if (!selectedOutEntryRecord) return;
    setDeleteItem(selectedOutEntryRecord);
  }, [selectedOutEntryRecord]);

  const getSelectedRow = useCallback(() => selectedOutEntryRecord, [selectedOutEntryRecord]);

  const modalOpenAny = modalOpen || Boolean(deleteItem);

  const { openNewModal, openEditModal, openApproveModal, openDeleteModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    modalOpen: modalOpenAny,
    selectedId: selected,
    getSelectedRow,
    getAuthorizeAccess: useCallback(() => canAccess(MODULE, "authorize"), [canAccess]),
    openAdd: handleNewClick,
    canOpenNew: useCallback(() => {
      if (isStoreOut) return true;
      return Boolean(selectedRecord && !selectedRecord?.out_uid);
    }, [isStoreOut, selectedRecord]),
    onNewBlocked: useCallback(() => {
      if (!isStoreOut && !selectedRecord) toast.info("Select a pending row first.");
    }, [isStoreOut, selectedRecord]),
    openEdit: useCallback(() => {
      if (selectedIsDraft) handleDraftClick();
      else handleEditClick();
    }, [selectedIsDraft, handleDraftClick, handleEditClick]),
    canEditSelection: useCallback(() => {
      if (selectedIsDraft) return Boolean(selectedRecord?.out_uid);
      if (isStoreOut) return Boolean(selectedRecord && !isRmOutEntryScanDraft(selectedRecord));
      return selectedPendingEditable;
    }, [selectedIsDraft, selectedRecord, isStoreOut, selectedPendingEditable]),
    openApprove: handleApproveClick,
    canApproveSelection: useCallback(() => Boolean(approveEnabled), [approveEnabled]),
    onApproveBlocked: handleApproveClick,
    openDelete: handleDeleteClick,
    canDeleteSelection: useCallback(
      () => Boolean(selected && (isStoreOut || selectedRecord?.out_uid)),
      [selected, isStoreOut, selectedRecord]
    ),
    onDeleteBlocked: useCallback(() => {
      if (!selectedOutEntryRecord) toast.info("Select a row to delete.");
    }, [selectedOutEntryRecord]),
  });

  const handleRefresh = useCallback(() => {
    if (isStoreOut) fetchOuts();
    else fetchPendingAll();
  }, [isStoreOut, fetchOuts, fetchPendingAll]);

  const handleRowDoubleClick = useCallback(
    (row) => {
      if (isStoreOut) {
        if (isRmOutEntryScanDraft(row)) openDraftForm(row);
        else openEdit(row);
        return;
      }
      if (!row.out_uid) {
        openFromPendingRow(row);
        return;
      }
      const draftRow = buildPendingDraftRow(row);
      if (draftRow && isRmOutEntryScanDraft(draftRow)) {
        openDraftForm(draftRow);
        return;
      }
      if (isRowScanComplete(row)) {
        openEdit(draftRow || pendingToOutEntryRow(row));
        return;
      }
      toast.info("Scanning is incomplete — use Draft to continue.");
    },
    [isStoreOut, openDraftForm, openEdit, openFromPendingRow, buildPendingDraftRow]
  );

  const STORE_OUT_HEADERS = useMemo(
    () => [
      ["Out UID", "out_uid", (v) => <span className="font-bold text-indigo-600 text-[10px]">{v}</span>, { fixed: true, width: "90px" }],
      ["Type", "entry_type", (v) => {
          const label = getOutEntryTypeLabel(v);
          const isRejection = String(v || "").toLowerCase() === "rm_rejection";
          return (
            <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${isRejection ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-indigo-50 text-indigo-700 border-indigo-100"}`}>
              {label}
            </span>
          );
        },
        { width: "120px", align: "center" },
      ],
      ["MRN UID", "mrn_uids", (v) => <span className="font-bold text-slate-800 text-[10px] font-mono tracking-tight">{v || "—"}</span>, { width: "120px" }],
      ["Job Card No", "pjobcardno", (v) => <span className="font-bold text-slate-800 text-[10px] font-mono tracking-tight">{v || "—"}</span>, { width: "120px" }],
      ["Machine / Reason", "macname", (_v, row) => {
          const machine = String(row?.macname || "").trim();
          const reason = String(row?.reason || "").trim();
          const text = [machine, reason].filter(Boolean).join(" · ");
          return (
            <span className="text-[10px] font-bold text-slate-700 uppercase truncate block" title={text || ""}>
              {text || "—"}
            </span>
          );
        },
        { width: "160px" },
      ],
      ["Heat Nos", "heat_nos", (v) => <span className="font-mono text-[10px] font-bold text-amber-700">{v || "—"}</span>, { width: "140px" }],
      ["Item Codes", "item_codes", (v) => <span className="text-slate-700 text-[10px] uppercase">{v || "—"}</span>, { width: "160px" }],
      ["Item Description", "item_descs", (v, row) => (
          <span className="text-[11px] text-slate-600 truncate block" title={v || row?.item_desc || ""}>
            {v || row?.item_desc || "—"}
          </span>
        ), { width: "200px" }],
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
          const progress =
            isRmOutEntryScanDraft(row) || (!row?.approved && isRowScanComplete(row))
              ? rmOutEntryScanProgressLabel(row)
              : null;
          return (
            <div className="flex flex-col gap-0.5 min-w-[100px]">
              <span className={`px-2 py-0.5 text-[9px] font-black uppercase border w-fit ${className}`}>
                ● {text}
              </span>
              {progress ? (
                <span className="text-[8px] font-bold text-slate-500 tabular-nums">{progress}</span>
              ) : null}
            </div>
          );
        },
        { width: "120px" },
      ],
      ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400">{formatDateTime(v)}</span>, { width: "150px" }],
      ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400">{formatDateTime(v)}</span>, { width: "150px" }],
      ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400">{formatDateTime(v)}</span>, { width: "150px" }],
    ],
    []
  );

  const PENDING_UNIFIED_HEADERS = useMemo(
    () => [
      ["Type", "pending_type", (_v, row) => <PendingTypeBadge type={row?.pending_type} />, { fixed: true, width: "120px", align: "center" }],
      ["Reference", "ref_key", (_v, row) => {
          const type = String(row?.pending_type || "").toLowerCase();
          if (type === PENDING_TYPE.JOB_CARD) {
            const outPart = row.out_uid ? ` · OUT-${row.out_uid}` : "";
            const issuePart = row.issue_uid ? `ISSUE #${row.issue_uid} · ` : "";
            return (
              <span className="font-bold text-indigo-700 text-[11px]">
                {issuePart}{row.pjobcardno || "—"}{outPart}
              </span>
            );
          }
          if (type === PENDING_TYPE.BATCH) {
            return (
              <span className="font-mono font-bold text-violet-700 text-[10px] truncate block">
                Batch · {row.mrn_uid ?? "—"}
              </span>
            );
          }
          if (type === PENDING_TYPE.REJECTION) {
            return (
              <span className="font-bold text-rose-700 text-[11px]">
                REJECT #{row.qc_reject_uid ?? row.out_uid ?? "—"}
              </span>
            );
          }
          return (
            <span className="font-mono font-bold text-indigo-600 text-[10px] truncate block" title={row.coil_no_uid || ""}>
              {row.coil_no_uid || "—"}
            </span>
          );
        },
        { fixed: true, width: "160px", align: "center" },
      ],
      // ["FG Item", "item_code", (v) => <span className="font-bold text-[11px] uppercase">{v || "—"}</span>, { width: "100px" }],
      ["RM Item Code", "rm_item_code", (v, row) => (
          <span className="font-bold text-slate-800 uppercase text-[11px] truncate block">
            {v || row?.item_codes || row?.item_code || "—"}
          </span>
        ),
        { width: "120px" },
      ],
      ["RM Description", "rm_item_desc", (v, row) => (
          <span className="text-[11px] text-slate-600 truncate block" title={v || row?.item_desc || ""}>
            {v || row?.item_desc || "—"}
          </span>
        ),
        { width: "180px" },
      ],
      ["Machine / Remarks", "macname", (v, row) => {
          const type = String(row?.pending_type || "").toLowerCase();
          if (type === PENDING_TYPE.JOB_CARD) {
            return (
              <span className="text-[10px] font-bold text-slate-700 uppercase truncate block" title={v || ""}>
                {v || "—"}
              </span>
            );
          }
          if (type === PENDING_TYPE.REJECTION) {
            const text = row?.rejection_remarks ?? row?.remarks ?? "";
            return (
              <span className="text-[10px] text-slate-600 truncate block" title={text || ""}>
                {text || "—"}
              </span>
            );
          }
          return <span className="text-[10px] text-slate-300">—</span>;
        },
        { width: "150px" },
      ],
      ["Reject Reason", "reason", (v, row) => {
          const type = String(row?.pending_type || "").toLowerCase();
          if (type !== PENDING_TYPE.REJECTION) return <span className="text-[10px] text-slate-300">—</span>;
          return (
            <span className="text-[10px] font-bold text-rose-700 truncate block" title={v || ""}>
              {v || "—"}
            </span>
          );
        },
        { width: "120px" },
      ],
      ["Qty", "qty_display", (_v, row) => {
          const type = String(row?.pending_type || "").toLowerCase();
          const qty =
            type === PENDING_TYPE.JOB_CARD
              ? row.pending_qty
              : type === PENDING_TYPE.REJECTION
                ? row.qty ?? row.total_qty
                : row.qty;
          return (
            <span className="font-black text-emerald-700 text-[11px] tabular-nums">
              {qty != null ? Number(qty).toLocaleString() : "0"}
            </span>
          );
        },
        { width: "85px" },
      ],
      ["Coils", "coil_count_display", (_v, row) => {
          const type = String(row?.pending_type || "").toLowerCase();
          const count =
            type === PENDING_TYPE.JOB_CARD
              ? row.pending_coil_count
              : type === PENDING_TYPE.REJECTION
                ? row.coil_count ?? 0
                : row.coil_count ?? (type === PENDING_TYPE.COIL ? 1 : 0);
          return (
            <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded bg-indigo-50 text-indigo-700 text-[10px] font-black tabular-nums border border-indigo-100">
              {count ?? 0}
            </span>
          );
        },
        { width: "70px" },
      ],
      ["MRN UID", "mrn_uid", (_v, row) => {
          const label = row.mrn_uid || row.mrn_uids || "—";
          return <span className="font-bold text-[10px]">{label}</span>;
        },
        { width: "90px" },
      ],
      // ["Heat", "heat_no", (v) => <span className="font-mono text-[10px] font-bold text-amber-700">{v || "—"}</span>, { width: "100px" }],
      ["Status", "out_uid", (_v, row) => {
          const st = pendingRmStoreOutStatus(row);
          return (
            <div className="flex flex-col gap-0.5 min-w-[100px]">
              <span className={`px-2 py-0.5 text-[9px] font-black uppercase border w-fit ${st.className}`}>
                {st.text}
              </span>
              {st.progress ? (
                <span className="text-[8px] font-bold text-slate-500 tabular-nums">{st.progress}</span>
              ) : null}
            </div>
          );
        },
        { width: "120px" },
      ],
      ["Date", "sort_at", (v, row) => (
          <span className="text-[10px] text-slate-400">
            {formatDateTime(v || row.approved_at || row.created_at)}
          </span>
        ),
        { width: "140px" },
      ],
    ],
    []
  );

  const headers = isStoreOut ? STORE_OUT_HEADERS : PENDING_UNIFIED_HEADERS;

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

  const selectedPendingSummary = useMemo(() => {
    if (!selectedRecord || isStoreOut) return null;
    const type = String(selectedRecord.pending_type || "").toLowerCase();
    if (type === PENDING_TYPE.JOB_CARD) {
      const machinePart = selectedRecord.macname ? ` · ${selectedRecord.macname}` : "";
      const outPart = selectedRecord.out_uid ? ` · OUT-${selectedRecord.out_uid}` : "";
      const statusPart = selectedRecord.out_uid
        ? isRowScanComplete(selectedRecord)
          ? " · PENDING AUTH"
          : " · SCAN"
        : "";
      return `Issue #${selectedRecord.issue_uid} · ${selectedRecord.pjobcardno}${machinePart}${outPart} · ${selectedRecord.pending_coil_count ?? 0} coil(s) · Qty ${Number(selectedRecord.pending_qty || 0).toLocaleString()}${statusPart}`;
    }
    if (type === PENDING_TYPE.BATCH) {
      return `Batch MRN ${selectedRecord.mrn_no ?? selectedRecord.mrn_uid} · ${selectedRecord.coil_count ?? 0} coils`;
    }
    if (type === PENDING_TYPE.REJECTION) {
      const outPart = selectedRecord.out_uid
        ? ` · OUT-${selectedRecord.out_uid}`
        : " · Awaiting Scan";
      const storePart = selectedRecord.rejection_remarks || selectedRecord.remarks
        ? ` · Store: ${selectedRecord.rejection_remarks || selectedRecord.remarks}`
        : "";
      return `RM Rejection #${selectedRecord.qc_reject_uid ?? "—"}${outPart} · ${selectedRecord.coil_count ?? 0} coil(s)${storePart}${selectedRecord.out_uid && isRowScanComplete(selectedRecord) ? " · PENDING AUTH" : selectedRecord.out_uid ? " · SCAN" : ""}`;
    }
    return `${selectedRecord.coil_no_uid}${selectedRecord.mrn_uid ? ` · MRN ${selectedRecord.mrn_uid}` : ""}`;
  }, [selectedRecord, isStoreOut]);

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <ImsSegmentedTabs
                className="mr-2"
                active={pageTab}
                onChange={handleTabChange}
                tabs={[
                  { id: PAGE_TABS.STORE_OUT, label: "Store Out", icon: Warehouse },
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
                  disabled={!isStoreOut && (!selectedRecord || Boolean(selectedRecord?.out_uid))}
                  onClick={handleNewClick}
                  className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4`}
                />
                <ActionButton
                  module={MODULE}
                  action="edit"
                  variant="outline"
                  label="Draft"
                  icon={FileEdit}
                  disabled={!selectedIsDraft || modalOpen}
                  record={selectedOutEntryRecord}
                  onClick={handleDraftClick}
                  className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4 bg-white border-amber-300 text-amber-800`}
                />
                <ActionButton
                  module={MODULE}
                  action="edit"
                  variant="outline"
                  label="Edit"
                  icon={Edit3}
                  disabled={
                    isStoreOut
                      ? !selectedRecord || isRmOutEntryScanDraft(selectedRecord)
                      : !selectedPendingEditable
                  }
                  record={isStoreOut ? selectedRecord : selectedOutEntryRecord}
                  onClick={handleEditClick}
                  className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4 bg-white border-slate-300`}
                />
                {canApproveStoreOut ? (
                  <button
                    type="button"
                    onClick={() => void openApproveModal()}
                    disabled={!approveEnabled}
                    title={
                      !selectedOutEntryRecord
                        ? isStoreOut
                          ? "Select a pending row to approve"
                          : "Select a row with completed store out scans to approve"
                        : !selectedApprovable
                          ? "Row is draft or already authorized"
                          : "Authorize store out"
                    }
                    className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors`}
                  >
                    <CheckCircle size={16} strokeWidth={2} />
                    <span>Approve</span>
                  </button>
                ) : null}
                <ActionButton
                  module={MODULE}
                  action="delete"
                  variant="danger"
                  label="Delete"
                  icon={Trash2}
                  disabled={!selected || (!isStoreOut && !selectedRecord?.out_uid)}
                  onClick={handleDeleteClick}
                  className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4`}
                />
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-0.5 shrink-0" />
                <button
                  type="button"
                  onClick={handleRefresh}
                  aria-label="Refresh"
                  className={`${LIST_PAGE_ACTION_CLASS} px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center`}
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
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in fade-in duration-200">
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wide truncate">
                Selected:{" "}
                {isStoreOut
                  ? `OUT-${selectedRecord?.out_uid ?? selected}`
                  : selectedPendingSummary || getRowId(selectedRecord)}
                {isStoreOut && selectedRecord ? (
                  <span className="ml-2 text-indigo-400 font-semibold normal-case">
                    · {getOutEntryTypeLabel(selectedRecord.entry_type)}
                    {selectedRecord.pjobcardno ? ` · ${selectedRecord.pjobcardno}` : ""}
                    {selectedRecord.macname || selectedRecord.reason
                      ? ` · ${[selectedRecord.macname, selectedRecord.reason].filter(Boolean).join(" · ")}`
                      : ""}
                    {selectedApprovable && canApproveStoreOut ? " · Approve" : ""}
                  </span>
                ) : null}
                {!isStoreOut && selectedApprovable && canApproveStoreOut ? (
                  <span className="ml-2 text-indigo-400 font-semibold normal-case">· Approve store out</span>
                ) : null}
              </span>
              <button
                onClick={() => setSelected(null)}
                className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase shrink-0"
              >
                <X size={14} /> Clear Selection
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
                : [{
                    label: "Type",
                    key: "pendingType",
                    value: pendingParams.pendingType,
                    options: PENDING_TYPE_FILTER_OPTIONS,
                  }]
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
              } else {
                setPendingParams((prev) => ({
                  ...prev,
                  pendingType: data.pendingType || PENDING_TYPE.ALL,
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
                setPendingParams({
                  pageSize: 500,
                  sortKey: "sort_at",
                  sortDir: "desc",
                  pendingType: PENDING_TYPE.ALL,
                });
              }
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder={
              isStoreOut
                ? "Search by MRN, heat, or item"
                : "Search by issue UID, job card, rejection UID, heat, or item"
            }
            searchLabel={isStoreOut ? "Search Store Out" : "Search Pending"}
            searchVariant="quick"
            showSearchButton
            applyOnSearchEnter={isStoreOut}
            applyExtrasOnChange={false}
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
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
            emptyIcon={isStoreOut ? Warehouse : ClipboardList}
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
                setPendingParams((p) => ({
                  ...p,
                  sortKey: key,
                  sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                }));
              }
            }}
            selectedId={selected}
            onSelect={setSelected}
            getRowId={getRowId}
            onRowDoubleClick={handleRowDoubleClick}
            {...tableHotkeyProps}
            onLoadMore={() => {
              if (!loading && items.length < totalItems) setDisplayLimit((n) => n + 100);
            }}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
          />
        </div>

        <RmStoreListFooter
          shown={items.length}
          total={totalItems}
          label={isStoreOut ? "Store Out Entries" : "Pending Store Out"}
          {...footerFilter}
        />
      </div>

      <CoilScanEntryModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setModalMode("add");
          setEditItem(null);
          setSeedFromCoil(null);
        }}
        onSuccess={async (data) => {
          await Promise.all([fetchOuts(), fetchPendingAll()]);
          if (data?.out_uid) {
            const entryType = String(data.entry_type || "").toLowerCase();
            setSelected(
              pendingRowId({
                pending_type:
                  entryType === "rm_rejection" ? PENDING_TYPE.REJECTION : PENDING_TYPE.JOB_CARD,
                out_uid: data.out_uid,
                issue_uid: data.issue_uid,
                pjobcardno: data.pjobcardno,
                qc_reject_uid: data.qc_reject_uid,
              })
            );
          }
        }}
        mode="out"
        approveMode={modalMode === "approve"}
        editItem={editItem}
        seedFromCoil={seedFromCoil}
        scannerElementId="rm-store-out-scanner"
        permissionModule={MODULE}
      />

      {deleteItem && (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={() => {
            fetchOuts();
            fetchPendingAll();
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

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { RefreshCw, ShieldCheck, Eye, ClipboardCheck, CheckCircle, ClipboardList, Database, Edit3, Trash2, Printer } from "lucide-react";
import { toast } from "react-toastify";

import { qcCheckService } from "@/apps/rmstore/lib/services/qcCheck";
import { appConfigService } from "@/apps/settings/lib/services/appConfigService";
import { printCoilReport } from "@/apps/rmstore/lib/utils/coilReportActions";
import { mrnUidsMatch } from "@/apps/rmstore/lib/helpers/qrScan";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import DataTable from "@/ui/primitives/DataTable";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import AppListFooter, { appListFooterFromClientFilter } from "@/ui/common/list/listPageFooter";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ActionButton from "@/ui/primitives/ActionButton";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { rmStoreSelectionLabel } from "@/apps/rmstore/lib/rmStoreSelectionLabel";
import { auditHeaders, auditPair } from "@/platform/utils/list/auditListUi";
import { isRowApproved } from "@/apps/rmstore/lib/helpers/RmStoreDrawerFooter";
import QcCheckModal from "./QcCheckModal";
import QcScanGateModal from "./QcScanGateModal";

const MODULE = "rm_qc_check";

/** Left = Register (DB history). Right = Pending work (default). */
const PAGE_TABS = {
  REGISTER: "register",
  PENDING: "pending",
};

function rowKey(row) {
  if (row?.is_batch_pending && row?.mrn_uid) return `batch-${row.mrn_uid}`;
  if (row?.qc_check_uid != null) return `qc-${row.qc_check_uid}`;
  return `coil-${row?.coil_no_uid || ""}`;
}

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  if (s === "passed") {
    return (
      <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-emerald-50 text-emerald-700 border-emerald-200">
        ● Passed
      </span>
    );
  }
  if (s === "failed") {
    return (
      <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-rose-50 text-rose-700 border-rose-200">
        ○ Failed
      </span>
    );
  }
  if (s === "awaiting_approval") {
    return (
      <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-indigo-50 text-indigo-700 border-indigo-200">
        ○ Awaiting Approval
      </span>
    );
  }
  if (s === "draft") {
    return (
      <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-sky-50 text-sky-700 border-sky-200">
        ● DRAFT
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 text-[9px] font-black uppercase border bg-amber-50 text-amber-700 border-amber-200">
      ○ Pending
    </span>
  );
}

export default function QcCheckPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);
  const hasAddPermission = canAccess(MODULE, "add").allowed;
  const hasEditPermission = canAccess(MODULE, "edit").allowed;
  const hasAuthorizePermission = canAccess(MODULE, "authorize").allowed;
  const hasDeletePermission = canAccess(MODULE, "delete").allowed;

  const [pageTab, setPageTab] = useState(PAGE_TABS.PENDING);
  const isPendingTab = pageTab === PAGE_TABS.PENDING;

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 500,
    status: "pending",
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "created_at",
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
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState({ open: false, mode: "inspect", row: null });
  const [scanGate, setScanGate] = useState({ open: false, row: null });
  /** After batch scan unlock — remaining coils open Spec form one-by-one after each submit. */
  const [postScanQueue, setPostScanQueue] = useState([]);
  const [batchContext, setBatchCoils] = useState([]);
  const postScanQueueRef = useRef([]);
  postScanQueueRef.current = postScanQueue;
  const closingAfterQcSuccessRef = useRef(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [printing, setPrinting] = useState(false);
  /** App Config: QC Check — require sticker scan (default true). */
  const [requireStickerScan, setRequireStickerScan] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await appConfigService.list("rmstore");
        const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const hit = rows.find((r) => String(r?.key || r?.config_key || "") === "qc_check_require_sticker_scan");
        const raw = hit?.config_value ?? hit?.value;
        if (cancelled) return;
        if (raw == null || String(raw).trim() === "") {
          setRequireStickerScan(true);
          return;
        }
        setRequireStickerScan(String(raw).trim().toLowerCase() === "true");
      } catch {
        if (!cancelled) setRequireStickerScan(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTabChange = (tab) => {
    setPageTab(tab);
    setSelected(null);
    setDisplayLimit(100);
    setPostScanQueue([]);
    setBatchCoils([]);
    setParams((prev) => ({
      ...prev,
      status: tab === PAGE_TABS.PENDING ? "pending" : "all",
      sortKey: tab === PAGE_TABS.PENDING ? "created_at" : "qc_check_uid",
      sortDir: "desc",
    }));
  };

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const listStatus = isPendingTab ? "pending" : params.status === "pending" ? "all" : params.status;
      const base = {
        filters: {
          // Pending = same work queue as Unapproved stickers — no date window (like packing list)
          ...(!isPendingTab && params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(!isPendingTab && params.toDate && { to_date: `${params.toDate} 23:59:59` }),
          status: listStatus,
        },
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await qcCheckService.getAll({
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
      toast.error(err?.message || "Could not load the QC checks. Please try again.");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.fromDate, params.toDate, params.status, appliedSearch, isPendingTab]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const filteredRows = useMemo(() => {
    let data = allRows;
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(allRows, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;
  const footerFilter = useMemo(
    () =>
      appListFooterFromClientFilter({
        tempSearch,
        sourceRows: allRows,
        filteredRows,
        serverFiltered: params.status !== "all" || Boolean(appliedSearch),
      }),
    [tempSearch, allRows, filteredRows, params.status, appliedSearch]
  );
  const selectedRecord = useMemo(
    () => filteredRows.find((r) => rowKey(r) === selected) || null,
    [filteredRows, selected]
  );

  const openInspect = useCallback(
    (row, forceView = false) => {
      const editable =
        ["pending", "draft"].includes(String(row?.status || "").toLowerCase()) ||
        row?.is_virtual_pending;
      if (editable && !forceView && !hasAddPermission && !hasEditPermission) {
        toast.error("You do not have permission to perform a QC check.");
        return;
      }
      if ((forceView || !editable) && !viewAccess.allowed) return;

      setModal({ open: true, mode: forceView || !editable ? "view" : "inspect", row });
    },
    [hasAddPermission, hasEditPermission, viewAccess]
  );

  /** Open Spec Check form for the unlocked coil (fill values → submit). */
  const openUnlockedRow = useCallback(
    (unlockedRow, remainingQueue = []) => {
      if (!unlockedRow?.coil_no_uid) {
        toast.error("The scanned coil UID is missing.");
        return;
      }
      setSelected(rowKey(unlockedRow));
      const queue = Array.isArray(remainingQueue) ? remainingQueue : [];
      setPostScanQueue(queue);
      if (queue.length > 0 || unlockedRow?.is_batch_pending) {
        setBatchCoils(unlockedRow?.is_batch_pending ? [] : [unlockedRow, ...queue]);
      } else {
        setBatchCoils([]);
      }
      const st = String(unlockedRow.status || "").toLowerCase();
      window.setTimeout(() => {
        if (st === "awaiting_approval" && unlockedRow.qc_check_uid) {
          if (hasAuthorizePermission) {
            setModal({ open: true, mode: "approve", row: unlockedRow });
            return;
          }
          if (hasEditPermission) {
            setModal({ open: true, mode: "edit", row: unlockedRow });
            return;
          }
        }
        openInspect(unlockedRow);
      }, 0);
    },
    [openInspect, hasAuthorizePermission, hasEditPermission]
  );

  /**
   * Pending Check — optional sticker scan (App Config), then Spec form.
   * When scan is disabled: open Spec directly after prepare (same unlock path as scan success).
   */
  const openCheckDirect = useCallback(
    async (row) => {
      const target = row || selectedRecord || null;
      if (!target) {
        toast.info("Select a pending QC row first.");
        return;
      }
      try {
        const isBatch =
          Boolean(target.is_batch_pending) ||
          String(target.sticker_mode || "").toLowerCase() === "batch";

        if (isBatch && target.mrn_uid) {
          const uid = String(target.mrn_uid).trim();
          const coilCsv = String(target.coil_no_uid || "");
          if (coilCsv.includes(",")) {
            await qcCheckService.prepare({ coil_no_uid: coilCsv, is_batch_qc: true });
            openUnlockedRow({ ...target, is_batch_pending: true, coil_no_uid: coilCsv }, []);
            return;
          }
          let list = [];
          const res = await qcCheckService.getAll({
            page: 1,
            limit: 1000,
            filters: { status: "pending", mrn_uid: uid, expand_coils: true },
          });
          list = (res?.data || []).filter((r) => String(r.coil_no_uid || "").trim());
          if (!list.length) {
            const allPending = await qcCheckService.getAll({
              page: 1,
              limit: 1000,
              filters: { status: "pending", expand_coils: true },
            });
            list = (allPending?.data || []).filter(
              (r) => String(r.coil_no_uid || "").trim() && mrnUidsMatch(r.mrn_uid, uid)
            );
          }
          if (!list.length) {
            toast.error("No pending coils were found for this batch MRN.");
            return;
          }
          const batchRow = {
            ...list[0],
            coil_no_uid: list.map((c) => c.coil_no_uid).join(", "),
            coil_count: list.length,
            is_batch_pending: true,
          };
          await qcCheckService.prepare({ coil_no_uid: batchRow.coil_no_uid, is_batch_qc: true });
          openUnlockedRow(batchRow, []);
          return;
        }

        if (!target.coil_no_uid) {
          toast.error("Coil UID is missing on this row.");
          return;
        }
        const prepareBody = target.qc_check_uid
          ? { qc_check_uid: target.qc_check_uid }
          : { coil_no_uid: target.coil_no_uid };
        await qcCheckService.prepare(prepareBody);
        openUnlockedRow(target, []);
      } catch (err) {
        toast.error(
          err?.message || "Specifications could not be loaded. Define them in RM Spec Master."
        );
      }
    },
    [selectedRecord, openUnlockedRow]
  );

  const openCheckWithScan = useCallback(
    (row) => {
      if (!hasAddPermission) {
        toast.error("You do not have permission to perform a QC check.");
        return;
      }
      const target = row || selectedRecord || null;
      const st = String(target?.status || "").toLowerCase();
      if (target && st === "draft" && target.coil_no_uid) {
        setPostScanQueue([]);
        openInspect(target);
        return;
      }
      setPostScanQueue([]);
      if (!requireStickerScan) {
        void openCheckDirect(target);
        return;
      }
      setScanGate({ open: true, row: target });
    },
    [selectedRecord, hasAddPermission, openInspect, requireStickerScan, openCheckDirect]
  );

  const handleQcModalSuccess = useCallback(
    (meta) => {
      fetchRows();
      // Draft save should not advance to the next coil
      if (meta?.isDraft) return;
      const queue = postScanQueueRef.current;
      if (!queue.length) {
        setBatchCoils([]);
        return;
      }
      const [next, ...rest] = queue;
      closingAfterQcSuccessRef.current = true;
      setPostScanQueue(rest);
      window.setTimeout(() => {
        closingAfterQcSuccessRef.current = false;
        if (next?.coil_no_uid) {
          toast.info(`Next coil: complete the spec check for ${next.coil_no_uid}.`);
          openInspect(next);
        } else {
          setBatchCoils([]);
        }
      }, 50);
    },
    [fetchRows, openInspect]
  );

  const openApprove = useCallback((row) => {
    const target = row || selectedRecord;
    if (!target?.qc_check_uid) return;
    const st = String(target.status || "").toLowerCase();
    if (st !== "awaiting_approval") {
      if (isRowApproved(target) || ["passed", "failed"].includes(st)) {
        toast.info("This record is already approved. Edit it before approving again.");
      }
      return;
    }
    setModal({ open: true, mode: "approve", row: target });
  }, [selectedRecord]);

  const openEdit = useCallback((row) => {
    const target = row || selectedRecord;
    if (!target?.qc_check_uid) return;
    const st = String(target.status || "").toLowerCase();
    if (st === "draft") {
      openInspect(target);
      return;
    }
    if (!["awaiting_approval", "passed", "failed"].includes(st)) return;
    setModal({ open: true, mode: "edit", row: target });
  }, [selectedRecord, openInspect]);

  const headers = useMemo(
    () => {
      const base = [
        ["QC #", "qc_check_uid", (v) => (<span className="font-bold text-sky-700 text-[10px]">{v != null ? v : "—"}</span>), { fixed: true, width: "80px" }],
        ["MRN UID", "mrn_uid", (v) => <span className="font-bold text-slate-800 text-[10px]">{v || "—"}</span>, { width: "110px" }],
        ["Item Code", "item_code", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "—"}</span>, { fixed: true, width: "200px" }],
        ["Description", "item_desc", (v) => <span className="text-[11px] text-slate-600 truncate block">{v || "—"}</span>, { width: "220px" }],
        ["Coil UID", "coil_no_uid", (v) => (<span className="font-mono text-[10px] font-bold text-slate-800 truncate block" title={v || ""}>{v || "—"}</span>), { width: "220px" }],
        ["Coil Count", "coil_count", (v, row) => {
            const count = v != null && v !== "" ? Number(v) : (row?.coil_no_uid || "").includes(",") ? (row.coil_no_uid.split(",").length) : (row?.is_batch_pending ? 0 : 1);
            return (
              <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded bg-indigo-50 text-indigo-700 text-[10px] font-black tabular-nums border border-indigo-100">
                {count}
              </span>
            );
          },
          { width: "100px" },
        ],
        ["Heat No.", "heat_no", (v) => <span className="font-mono text-[10px] font-bold text-amber-700">{v || "—"}</span>, { width: "120px" }],
        ["Qty", "qty", (v) => (
            <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px] tabular-nums">
              {v != null ? Number(v).toLocaleString() : "0"}
            </span>
          ),
          { width: "90px" },
        ],
        ["Status", "status", (v) => <StatusBadge status={v} />, { width: "160px" }],
        ["Failure Reason", "failure_reason", (v) => <span className="text-rose-700 text-[10px] truncate block">{v || "—"}</span>, { width: "180px" }],
        ...auditPair("Inspected", "inspected_by_name", "inspected_at"),
      ];

      if (isPendingTab) return base;

      return [...base, ...auditHeaders()];
    },
    [isPendingTab]
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isPendingTab ? "RM QC Pending" : "RM QC Register",
    rows: filteredRows,
    headers,
  });

  const extraFilters = useMemo(() => {
    if (isPendingTab) return [];
    return [
      {
        label: "Status",
        key: "qcStatus",
        value: params.status,
        options: [
          { label: "All Records", value: "all" },
          { label: "Passed", value: "passed" },
          { label: "Failed", value: "failed" },
        ],
      },
    ];
  }, [isPendingTab, params.status]);

  const canInspect = isPendingTab && hasAddPermission;
  const canApproveRow =
    selectedRecord &&
    selectedRecord.qc_check_uid != null &&
    String(selectedRecord.status || "").toLowerCase() === "awaiting_approval";
  const canEditRow =
    selectedRecord?.qc_check_uid != null &&
    ["awaiting_approval", "passed", "failed", "draft"].includes(
      String(selectedRecord.status || "").toLowerCase()
    );
  const canDeleteRow =
    selectedRecord?.qc_check_uid != null &&
    ["passed", "failed", "awaiting_approval", "draft"].includes(
      String(selectedRecord.status || "").toLowerCase()
    );
  const canView =
    selectedRecord &&
    selectedRecord.qc_check_uid != null;

  const canPrintReport = useMemo(() => {
    return (
      selectedRecord?.qc_check_uid != null &&
      (selectedRecord.approved ||
        ["passed", "failed"].includes(String(selectedRecord.status || "").toLowerCase()))
    );
  }, [selectedRecord]);

  const handlePrint = useCallback(
    async (row) => {
      const target = row || selectedRecord;
      await printCoilReport({
        coil_no_uid: target?.coil_no_uid,
        permissionModule: "rm_qc_check",
        printing,
        setPrinting,
      });
    },
    [selectedRecord, printing]
  );

  const getSelectedRow = useCallback(() => selectedRecord, [selectedRecord]);

  const { openNewModal, openEditModal, openApproveModal, openDeleteModal, tableHotkeyProps } =
    useListDrawerHotkeys({
      module: MODULE,
      modalOpen: modal.open || scanGate.open || !!deleteItem,
      selectedId: selected,
      getSelectedRow,
      openAdd: useCallback(() => {
        openCheckWithScan(selectedRecord);
      }, [selectedRecord, openCheckWithScan]),
      canOpenNew: useCallback(() => Boolean(canInspect), [canInspect]),
      newBlockedMessage: "You do not have permission to perform a QC check.",
      openEdit: useCallback(
        (row) => {
          if (!canEditRow) return;
          openEdit(row);
        },
        [canEditRow, openEdit]
      ),
      openApprove: useCallback(
        (row) => {
          openApprove(row || selectedRecord);
        },
        [openApprove, selectedRecord]
      ),
      canApproveSelection: useCallback(() => Boolean(canApproveRow), [canApproveRow]),
      onApproveBlocked: useCallback(() => {
        if (selectedRecord && (isRowApproved(selectedRecord) || ["passed", "failed"].includes(String(selectedRecord.status || "").toLowerCase()))) {
          toast.info("This record is already approved. Edit it before approving again.");
          return;
        }
        toast.info("Select a row awaiting approval.");
      }, [selectedRecord]),
      approveBlockedMessage: "Select a row awaiting approval.",
      openDelete: useCallback(
        (row) => {
          if (!row?.qc_check_uid) return;
          setDeleteItem(row);
        },
        []
      ),
      canDeleteSelection: useCallback(() => Boolean(canDeleteRow), [canDeleteRow]),
      deleteBlockedMessage: "Select a saved QC record (draft or register) to delete.",
      onPrint: handlePrint,
      canPrintSelection: useCallback(() => Boolean(canPrintReport), [canPrintReport]),
      printBlockedMessage: "Select an approved QC record to print.",
    });

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
                  <ActionButton
                    module={MODULE}
                    action="add"
                    label="Check"
                    icon={ClipboardCheck}
                    disabled={!canInspect}
                    onClick={openNewModal}
                    className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                  />
                )}
                <ActionButton
                  module={MODULE}
                  action="view"
                  variant="outline"
                  label="View"
                  icon={Eye}
                  disabled={!canView}
                  record={selectedRecord}
                  onClick={() => canView && openInspect(selectedRecord, true)}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                />
                <ActionButton
                  module={MODULE}
                  action="view"
                  variant="outline"
                  label={printing ? "…" : "Print QC"}
                  icon={Printer}
                  disabled={!canPrintReport || printing}
                  record={selectedRecord}
                  onClick={() => handlePrint(selectedRecord)}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                />
                <ActionButton
                  module={MODULE}
                  action="edit"
                  variant="outline"
                  label="Edit"
                  icon={Edit3}
                  disabled={!canEditRow}
                  record={selectedRecord}
                  onClick={openEditModal}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                />
                <ActionButton
                  module={MODULE}
                  action="authorize"
                  variant="outline"
                  label="Approve"
                  icon={CheckCircle}
                  disabled={!canApproveRow}
                  record={selectedRecord}
                  onClick={openApproveModal}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none shrink-0"
                />
                <ActionButton
                  module={MODULE}
                  action="delete"
                  variant="danger"
                  label="Delete"
                  icon={Trash2}
                  disabled={!hasDeletePermission || !canDeleteRow}
                  record={selectedRecord}
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
            extraFilters={extraFilters}
            onApply={(data) => {
              applySearchFromInput();
              setParams((prev) => ({
                ...prev,
                fromDate: data.fromDate,
                toDate: data.toDate,
                ...(isPendingTab
                  ? { status: "pending" }
                  : { status: data.qcStatus || prev.status }),
              }));
            }}
            onReset={() => {
              resetSearch();
              setParams({
                pageSize: 500,
                status: isPendingTab ? "pending" : "all",
                fromDate: dateFilterDefaults.from,
                toDate: dateFilterDefaults.to,
                sortKey: isPendingTab ? "created_at" : "qc_check_uid",
                sortDir: "desc",
              });
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search by coil, MRN, heat, or item"
            searchLabel={isPendingTab ? "Search Pending" : "Search Register"}
            searchVariant="quick"
            quickSearchOnly={isPendingTab}
            showSearchButton={!isPendingTab}
            applyOnSearchEnter={!isPendingTab}
            applyExtrasOnChange={false}
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 h-0 relative bg-white flex flex-col overflow-hidden isolate z-0">
          <DataTable
            headers={headers}
            data={items}
            loading={loading}
            viewMode={viewMode}
            allowCopy
            showSelection
            emptyIcon={ShieldCheck}
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
            onRowDoubleClick={(row) => {
              const st = String(row?.status || "").toLowerCase();
              if (isPendingTab) {
                const editable = ["pending", "draft"].includes(st) || row?.is_virtual_pending;
                if (editable) {
                  openCheckWithScan(row);
                } else if (st === "awaiting_approval" && hasAuthorizePermission) {
                  setModal({ open: true, mode: "approve", row });
                } else {
                  openInspect(row, true);
                }
              } else {
                if (st === "awaiting_approval" && hasAuthorizePermission) {
                  setModal({ open: true, mode: "approve", row });
                } else {
                  openInspect(row, true);
                }
              }
            }}
            onLoadMore={() => {
              if (!loading && items.length < totalItems) setDisplayLimit((n) => n + 100);
            }}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={{ titleKey: "coil_no_uid", badgeIndices: [8], detailIndices: [2, 3, 4], footerKey: "created_at" }}
            {...tableHotkeyProps}
          />
        </div>

        <AppListFooter
          shown={items.length}
          total={totalItems}
          noun={isPendingTab ? "Pending Work" : "QC Register"}
          selected={selected}
          selectedRecord={selectedRecord}
          selectionLabel={rmStoreSelectionLabel.qcCheck}
          onClearSelection={() => setSelected(null)}
          {...footerFilter}
        />
      </div>

      <QcScanGateModal
        open={scanGate.open}
        row={scanGate.row}
        onClose={() => {
          setScanGate({ open: false, row: null });
          setPostScanQueue([]);
        }}
        onUnlocked={(unlockedRow, remainingQueue) => {
          setScanGate({ open: false, row: null });
          openUnlockedRow(unlockedRow, remainingQueue);
        }}
      />

      <QcCheckModal
        open={modal.open}
        mode={modal.mode}
        row={modal.row}
        batchCoils={batchContext}
        onClose={() => {
          setModal({ open: false, mode: "inspect", row: null });
          // Keep remaining batch coils after submit; clear only on user cancel
          if (!closingAfterQcSuccessRef.current) {
            setPostScanQueue([]);
            setBatchCoils([]);
          }
        }}
        onSuccess={handleQcModalSuccess}
      />

      <DeleteModal
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onSuccess={() => {
          fetchRows();
          setSelected(null);
        }}
        service={qcCheckService}
        entityLabel="QC Check"
        idKey="qc_check_uid"
        titleKey="coil_no_uid"
        moduleSlug={MODULE}
        warningMessage="The coil will return to Pending for QC. Failed checks linked to a rejection cannot be deleted here."
      />
    </div>
  );
}

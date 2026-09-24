"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Truck, CheckCircle2, ClipboardList, Plus, Eye, Edit3, CheckCircle, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

import { invoiceReceivingService } from "@/apps/ims/lib/services/invoiceReceiving";
import { imsInvoiceReceivingLabel } from "@/apps/ims/lib/imsSelectionLabel";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { applyClientSearch, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import AppListFooter from "@/ui/common/list/listPageFooter";
import { ListPageToolbar, ListPageToolbarLayout, LIST_PAGE_ACTION_CLASS } from "@/ui/common/list/ListPageToolbar";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import DataTable from "@/ui/primitives/DataTable";
import ActionButton from "@/ui/primitives/ActionButton";
import InvoiceReceivingModal from "./InvoiceReceivingModal";
import DeleteModal from "@/ui/common/modals/DeleteModal";
import { MODULE_DATES } from "@/platform/config/moduleDates.config";
import { canIrApproveRow, canIrClearReceivingRow, canIrEditOnPendingTab, canIrEditOnRegisterTab, formatImsErpScalar, formatIrBillDate, formatIrDateTime, getIrPendingRowClassName, hasIrReceivingFile, irRemarksDisplay, isImsErpNullLiteral, isIrApproved, isIrAwaitingReceive, filterIrRegisterRows, isIrReceivedNotApproved, mergeIrPendingRows } from "./invoiceReceivingUtils";
/* Re-enable with Attachments column:
import FilePreviewLink from "@/ui/common/system/FilePreviewLink";
import { irReceivingFilePaths, publicUploadHref, receivingFileLabel } from "./invoiceReceivingUtils";
*/

const MODULE = "invoice_receiving";
const TABS = { REGISTER: "register", PENDING: "pending" };

const ERP_NULL_CLASS = "text-[10px] text-slate-400 italic font-medium";

function IrErpScalarCell({ value, className = "text-[10px] text-slate-500" }) {
  const text = formatImsErpScalar(value);
  if (text === "—") return "—";
  if (text === "null") return <span className={ERP_NULL_CLASS}>null</span>;
  return <span className={className}>{text}</span>;
}

const irRows = (res) => (res?.success && Array.isArray(res.data) ? res.data : []);

/* Attachments column — uncomment when needed
function IrAttachCell({ row, raw }) {
  const rawVal = raw ?? row?.receivingfile ?? row?.file_path;
  if (isImsErpNullLiteral(rawVal)) return <span className={ERP_NULL_CLASS}>null</span>;
  const paths = irReceivingFilePaths(row);
  if (!paths.length) return "—";
  return (
    <div className="flex flex-col gap-0.5 max-h-20 overflow-y-auto">
      {paths.map((p) => {
        const name = receivingFileLabel(p);
        const href = publicUploadHref(p);
        if (!name || !href) return null;
        return (
          <FilePreviewLink key={p} href={href} fileName={name} className="text-[9px] font-bold text-indigo-700 truncate hover:underline text-left">
            {name}
          </FilePreviewLink>
        );
      })}
    </div>
  );
}
*/

function useIrData(viewAccess, isPending, registerFrom, registerTo) {
  const seqRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [pendingRows, setPendingRows] = useState([]);
  const [registerRows, setRegisterRows] = useState([]);

  const registerQuery = useMemo(() => {
    const from = String(registerFrom ?? "").trim();
    const to = String(registerTo ?? "").trim();
    if (!from || !to) return null;
    return { from_date: from, to_date: to };
  }, [registerFrom, registerTo]);

  const loadPending = useCallback(async () => {
    if (!viewAccess?.allowed) return;
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const pRes = await invoiceReceivingService.list("");
      if (seq !== seqRef.current) return;
      if (!pRes?.success) throw new Error(pRes?.message || "Failed to load pending.");
      const pendingRaw = irRows(pRes);
      setPendingRows(mergeIrPendingRows(pendingRaw, []));
      setLoading(false);
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      invoiceReceivingService.list("register", {
        from_date: MODULE_DATES.ims.invoiceReceiving.pendingMergeFrom,
        to_date: today,
        gate_registered_only: true,
      }).then((rRes) => {
        if (seq !== seqRef.current) return;
        if (rRes?.success) setPendingRows(mergeIrPendingRows(pendingRaw, irRows(rRes)));
      });
    } catch (err) {
      if (seq !== seqRef.current) return;
      toast.error(err?.message || "Failed to load.");
      setPendingRows([]);
      setLoading(false);
    }
  }, [viewAccess]);

  const loadRegister = useCallback(
    async (fromYmd, toYmd) => {
      if (!viewAccess?.allowed) return;
      const from = String(fromYmd ?? registerFrom ?? "").trim();
      const to = String(toYmd ?? registerTo ?? "").trim();
      if (!from || !to) return;
      const seq = ++seqRef.current;
      setLoading(true);
      try {
        const rRes = await invoiceReceivingService.list("register", { from_date: from, to_date: to });
        if (seq !== seqRef.current) return;
        if (!rRes?.success) throw new Error(rRes?.message || "Failed to load register.");
        setRegisterRows(filterIrRegisterRows(irRows(rRes)));
      } catch (err) {
        if (seq !== seqRef.current) return;
        toast.error(err?.message || "Failed to load.");
        setRegisterRows([]);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    [viewAccess, registerFrom, registerTo]
  );

  useEffect(() => {
    if (!viewAccess?.allowed) return;
    if (isPending) {
      loadPending();
      return;
    }
    if (!registerQuery) {
      setRegisterRows([]);
      setLoading(false);
      return;
    }
    loadRegister(registerQuery.from_date, registerQuery.to_date);
  }, [viewAccess, isPending, registerQuery, loadPending, loadRegister]);

  const refreshActiveTab = useCallback(() => {
    if (isPending) loadPending();
    else loadRegister();
  }, [isPending, loadPending, loadRegister]);

  const refreshBothSilently = useCallback(async () => {
    if (!viewAccess?.allowed) return;
    const seq = ++seqRef.current;
    try {
      const pendingReq = invoiceReceivingService.list("");
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const mergeReq = invoiceReceivingService.list("register", {
        from_date: MODULE_DATES.ims.invoiceReceiving.pendingMergeFrom,
        to_date: today,
        gate_registered_only: true,
      });
      const tabReq = registerQuery ? invoiceReceivingService.list("register", registerQuery) : null;
      const [pRes, mergeRes, tabRes] = await Promise.all([
        pendingReq,
        mergeReq,
        tabReq ?? Promise.resolve(null),
      ]);
      if (seq !== seqRef.current) return;
      setPendingRows(mergeIrPendingRows(irRows(pRes), irRows(mergeRes)));
      if (tabRes?.success) setRegisterRows(filterIrRegisterRows(irRows(tabRes)));
    } catch {
      /* keep */
    }
  }, [viewAccess, registerQuery]);

  return { loading, pendingRows, registerRows, refreshActiveTab, reloadRegister: loadRegister, refreshBothSilently };
}

const SHARED_HEADERS = [
  [
    "Bill Number",
    "prnbillno",
    (v) => (
      <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight">{v || "—"}</span>
    ),
    { width: "160px" },
  ],
  [
    "Bill Date",
    "billdt",
    (v, row) => (
      <span className="text-[10px] text-slate-500 font-medium tabular-nums">{formatIrBillDate(v ?? row?.billdt)}
      </span>
    ),
    { width: "140px" },
  ],
  [
    "Customer",
    "acc_name",
    (v) => (
      <span
        className="text-[10px] font-medium text-slate-500 uppercase italic whitespace-normal break-words leading-snug block"
        title={v || ""}
      >
        {v || "—"}
      </span>
    ),
    { width: "220px", wrap: true },
  ],
  ["Transport", "transport", (v) => <span className="text-[10px] font-medium text-slate-600 uppercase">{v || "—"}</span>, { width: "160px" }],
  ["Vehicle No", "vehicleno", (v) => <span className="text-[10px] font-bold text-slate-700 uppercase tabular-nums">{v || "—"}</span>, { width: "120px" }],
];

const STATUS_COL = [
  "Status",
  "approved",
  (v, row) => {
    const ok = isIrApproved(row ?? { approved: v });
    return (
      <span
        className={`px-2 py-0.5 text-[9px] font-black uppercase border ${
          ok ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
        }`}
      >
        {ok ? "● AUTHORIZED" : "○ PENDING"}
      </span>
    );
  },
  { width: "120px" },
];

export default function InvoiceReceivingPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess(MODULE, "view"), [canAccess]);
  const addAccess = useMemo(() => canAccess(MODULE, "add"), [canAccess]);
  const editAccess = useMemo(() => canAccess(MODULE, "edit"), [canAccess]);
  const authorizeAccess = useMemo(() => canAccess(MODULE, "authorize"), [canAccess]);
  const deleteAccess = useMemo(() => canAccess(MODULE, "delete"), [canAccess]);
  const canReceiveNew = useMemo(() => Boolean(addAccess?.allowed || authorizeAccess?.allowed), [addAccess, authorizeAccess]);
  const canUploadChange = useMemo(
    () => Boolean(addAccess?.allowed || editAccess?.allowed || authorizeAccess?.allowed),
    [addAccess, editAccess, authorizeAccess]
  );
  const newToolbarAction = addAccess?.allowed ? "add" : "authorize";
  const editToolbarAction = editAccess?.allowed ? "edit" : authorizeAccess?.allowed ? "authorize" : "add";
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [pageTab, setPageTab] = useState(TABS.PENDING);
  const isPending = pageTab === TABS.PENDING;

  const [viewMode, handleViewMode] = useViewMode();
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [sort, setSort] = useState({ key: "prnbillno", dir: "desc" });
  const [modal, setModal] = useState({ open: false, mode: "add", bill: null });
  const [deleteItem, setDeleteItem] = useState(null);
  /** Register: dates sent to ERP list API (default span on tab open; Search updates). */
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");
  /** Register date pickers — change here; Search applies to API range. */
  const [draftFromDate, setDraftFromDate] = useState("");
  const [draftToDate, setDraftToDate] = useState("");

  const { tempSearch, setTempSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();

  useEffect(() => {
    if (!viewAccess?.allowed) return;
    const from = String(dateFilterDefaults.from ?? "").trim();
    const to = String(dateFilterDefaults.to ?? "").trim();
    if (!from || !to) return;
    setDraftFromDate((d) => d || from);
    setDraftToDate((d) => d || to);
    if (pageTab === TABS.REGISTER) {
      setAppliedFromDate((prev) => prev || from);
      setAppliedToDate((prev) => prev || to);
    }
  }, [viewAccess?.allowed, pageTab, dateFilterDefaults.from, dateFilterDefaults.to]);

  const { loading, pendingRows, registerRows, refreshActiveTab, reloadRegister, refreshBothSilently } = useIrData(
    viewAccess,
    isPending,
    appliedFromDate,
    appliedToDate
  );

  const handleToolbarRefresh = useCallback(() => {
    if (isPending) {
      refreshActiveTab();
      return;
    }
    const from = String(appliedFromDate || draftFromDate || "").trim();
    const to = String(appliedToDate || draftToDate || "").trim();
    if (!from || !to) {
      toast.info("Select From and To date, then Search or Refresh.");
      return;
    }
    const appliedFrom = String(appliedFromDate || "").trim();
    const appliedTo = String(appliedToDate || "").trim();
    if (appliedFrom === from && appliedTo === to) {
      reloadRegister(from, to);
      return;
    }
    setAppliedFromDate(from);
    setAppliedToDate(to);
  }, [
    isPending,
    refreshActiveTab,
    reloadRegister,
    appliedFromDate,
    appliedToDate,
    draftFromDate,
    draftToDate,
  ]);

  useEffect(() => {
    setDisplayLimit(100);
  }, [tempSearch, isPending, appliedFromDate, appliedToDate]);

  const sourceRows = isPending ? pendingRows : registerRows;

  const filteredRows = useMemo(
    () => sortRowsByKey(applyClientSearch(sourceRows, tempSearch), sort.key, sort.dir),
    [sourceRows, tempSearch, sort]
  );

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const getRowId = useCallback((item) => item?.prnbillno, []);
  const selectedRecord = useMemo(
    () => filteredRows.find((i) => getRowId(i) === selected) || null,
    [filteredRows, selected, getRowId]
  );
  const getSelectedRow = useCallback(
    () => filteredRows.find((i) => getRowId(i) === selected) || null,
    [filteredRows, selected, getRowId]
  );

  const canEditSelection = useCallback(() => {
    if (!canUploadChange || !selectedRecord) return false;
    if (isPending) return canIrEditOnPendingTab(selectedRecord);
    return canIrEditOnRegisterTab(selectedRecord);
  }, [canUploadChange, selectedRecord, isPending]);

  const openModal = useCallback(
    (mode, row) => {
      const target = row || getSelectedRow();
      if (!target?.prnbillno) {
        toast.info("Select a bill first.");
        return;
      }
      if (mode === "add") {
        if (!isPending) {
          toast.info("First receive is only from Pending (New). After that use Edit or Approve on Register.");
          return;
        }
        if (!canReceiveNew) {
          toast.info("No permission to receive.");
          return;
        }
        if (isIrReceivedNotApproved(target) || isIrApproved(target)) {
          toast.info("This bill is already received. Use Edit or Approve on Pending.");
          return;
        }
      }
      if (mode === "approve") {
        if (!isPending) {
          toast.info("Approve received bills from the Pending tab.");
          return;
        }
        if (!authorizeAccess?.allowed) {
          toast.info("No permission to approve.");
          return;
        }
        if (!hasIrReceivingFile(target)) {
          toast.info("Upload attachment first (New / Edit), then approve.");
          return;
        }
        if (isIrApproved(target)) {
          toast.info("Already approved. Edit on Register if you need changes.");
          return;
        }
      }
      if (mode === "edit") {
        if (!canUploadChange) {
          toast.info("No permission to edit or upload.");
          return;
        }
        if (isPending && !canIrEditOnPendingTab(target)) {
          toast.info("Use New to receive this bill first.");
          return;
        }
        if (!isPending && !canIrEditOnRegisterTab(target)) {
          toast.info("Only authorized (approved) bills can be edited on Register.");
          return;
        }
      }
      setModal({ open: true, mode, bill: target });
    },
    [getSelectedRow, isPending, canReceiveNew, canUploadChange, authorizeAccess]
  );

  const canDeleteSelection = useCallback(() => {
    if (!deleteAccess?.allowed || !selectedRecord) return false;
    return canIrClearReceivingRow(selectedRecord, isPending);
  }, [deleteAccess, selectedRecord, isPending]);

  const openDeleteModal = useCallback(() => {
    if (!canIrClearReceivingRow(getSelectedRow(), isPending)) {
      toast.info(isPending ? "Select a received bill on Pending to clear." : "Select an authorized register row to clear.");
      return;
    }
    if (!deleteAccess?.allowed) {
      toast.info("No permission to delete.");
      return;
    }
    const row = getSelectedRow();
    if (!row?.prnbillno) {
      toast.info("Select a register row first.");
      return;
    }
    setDeleteItem(row);
  }, [isPending, deleteAccess, getSelectedRow]);

  const irDeleteService = useMemo(
    () => ({
      delete: async () => {
        if (!deleteItem?.prnbillno) throw new Error("Bill not found.");
        const res = await invoiceReceivingService.remove({
          prnbillno: deleteItem.prnbillno,
          billdt: deleteItem.billdt,
        });
        if (!res?.success) throw new Error(res?.message || "Failed to clear receiving.");
        return res;
      },
    }),
    [deleteItem]
  );

  const { openNewModal, openEditModal, openApproveModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: MODULE,
    addActions: ["add", "authorize"],
    bypassModulePermission: true,
    modalOpen: modal.open || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: () => openModal("add"),
    openEdit: (row) => openModal("edit", row),
    openApprove: (row) => openModal("approve", row),
    canApproveSelection: () => isPending && authorizeAccess?.allowed && Boolean(selectedRecord) && canIrApproveRow(selectedRecord),
    onApproveBlocked: () => {
      if (!isPending) toast.info("Approve from the Pending tab.");
      else if (!authorizeAccess?.allowed) toast.info("No permission to approve.");
      else if (selectedRecord && isIrApproved(selectedRecord)) toast.info("Already on Register as authorized.");
      else if (selectedRecord && !hasIrReceivingFile(selectedRecord)) toast.info("Receive attachments first (New / Edit).");
      else toast.info("Select a received bill pending approval.");
    },
    canOpenNew: () => isPending && canReceiveNew && (!selectedRecord || isIrAwaitingReceive(selectedRecord)),
    onNewBlocked: () => toast.info(isPending ? "Select a bill not yet received, or use Edit if already received." : "Switch to Pending to receive."),
    canEditSelection,
    onEditBlocked: () => {
      if (!canUploadChange) toast.info("No permission to edit or upload.");
      else if (isPending) toast.info("Select a received bill on Pending, or use New for first receive.");
      else toast.info("Select an authorized bill on Register.");
    },
    openDelete: openDeleteModal,
    canDeleteSelection,
    onDeleteBlocked: () => {
      if (!deleteAccess?.allowed) toast.info("No permission to delete.");
      else if (isPending) toast.info("Select a received (not approved) bill on Pending.");
      else toast.info("Select an authorized register row.");
    },
  });

  const PENDING_EXTRA = [
    // STATUS_COL,
    [
      "Remarks",
      "remarks",
      (v, row) => {
        const text = irRemarksDisplay(v, row);
        if (!text) {
          if (isImsErpNullLiteral(v)) return <span className={ERP_NULL_CLASS}>null</span>;
          return "—";
        }
        return (
          <span className="text-[10px] text-slate-600 line-clamp-2 leading-snug block" title={text}>
            {text}
          </span>
        );
      },
      { width: "140px", wrap: true },
    ],
    /*
    [
      "Attachments",
      "receivingfile",
      (v, row) => <IrAttachCell row={row} raw={v} />,
      { width: "160px" },
    ],
    */
    ["Uploaded By", "uploaded_by", (v) => <IrErpScalarCell value={v} />, { width: "100px" }],
    [
      "Uploaded At",
      "uploaded_at",
      (v) => <span className="text-[10px] text-slate-400 font-medium">{formatIrDateTime(v)}</span>,
      { width: "130px" },
    ],
  ];

  const headers = useMemo(() => {
    if (isPending) return [...SHARED_HEADERS, ...PENDING_EXTRA];
    return [
      ...SHARED_HEADERS,
      STATUS_COL,
      [
        "Remarks",
        "remarks",
        (v, row) => {
          const text = irRemarksDisplay(v, row);
          if (!text) {
            if (isImsErpNullLiteral(v)) return <span className={ERP_NULL_CLASS}>null</span>;
            return "—";
          }
          return (
            <span className="text-[10px] text-slate-600 line-clamp-2 leading-snug block" title={text}>
              {text}
            </span>
          );
        },
        { width: "160px", wrap: true },
      ],
      /*
      [
        "Attachments",
        "receivingfile",
        (v, row) => <IrAttachCell row={row} raw={v} />,
        { width: "160px" },
      ],
      */
      ["Uploaded By", "uploaded_by", (v) => <IrErpScalarCell value={v} />, { width: "110px" }],
      [
        "Uploaded At",
        "uploaded_at",
        (v) => <span className="text-[10px] text-slate-400 font-medium">{formatIrDateTime(v)}</span>,
        { width: "150px" },
      ],
      [
        "Approved By",
        "approved_by",
        (v, row) => <IrErpScalarCell value={v || row?.approved_by_name} />,
        { width: "110px" },
      ],
      [
        "Approved At",
        "approved_at",
        (v) => <span className="text-[10px] text-slate-400 font-medium">{formatIrDateTime(v)}</span>,
        { width: "150px" },
      ],
    ];
  }, [isPending]);

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isPending ? "Invoice Receiving Pending" : "Invoice Receiving Register",
    rows: filteredRows,
    headers,
  });

  const applyRegisterDefaultDates = useCallback(() => {
    const from = String(dateFilterDefaults.from ?? "").trim();
    const to = String(dateFilterDefaults.to ?? "").trim();
    setDraftFromDate(from);
    setDraftToDate(to);
    setAppliedFromDate(from);
    setAppliedToDate(to);
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const handleTabChange = useCallback(
    (tab) => {
      setPageTab(tab);
      setSelected(null);
      resetSearch();
      if (tab === TABS.REGISTER) {
        applyRegisterDefaultDates();
      }
      setDisplayLimit(100);
      setSort({ key: "prnbillno", dir: "desc" });
    },
    [resetSearch, applyRegisterDefaultDates]
  );

  const getRowClassName = useCallback(
    (row) => (isPending ? getIrPendingRowClassName(row) : ""),
    [isPending]
  );

  if (!viewAccess?.allowed) {
    return <div className="p-6 text-sm text-slate-500">No access.</div>;
  }

  const btn = LIST_PAGE_ACTION_CLASS;

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <ImsSegmentedTabs
                active={pageTab}
                onChange={handleTabChange}
                tabs={[
                  { id: TABS.REGISTER, label: "Register", icon: CheckCircle2 },
                  { id: TABS.PENDING, label: "Pending", icon: ClipboardList },
                ]}
              />
            }
            actions={
              <>
                {canReceiveNew ? (
                  <ActionButton
                    module={MODULE}
                    action={newToolbarAction}
                    label="New"
                    icon={Plus}
                    disabled={!isPending || !selectedRecord || !isIrAwaitingReceive(selectedRecord)}
                    onClick={openNewModal}
                    className={`${btn} px-4 shadow-none`}
                  />
                ) : null}
                {canUploadChange ? (
                  <ActionButton
                    module={MODULE}
                    action={editToolbarAction}
                    variant="outline"
                    label="Edit"
                    icon={Edit3}
                    disabled={!canEditSelection()}
                    record={editAccess?.allowed ? selectedRecord : null}
                    onClick={openEditModal}
                    className={`${btn} px-4 bg-white border-slate-300 shadow-none`}
                  />
                ) : null}
                <ActionButton
                  module={MODULE}
                  action="authorize"
                  variant="outline"
                  label="Approve"
                  icon={CheckCircle}
                  disabled={!isPending || !selectedRecord || !canIrApproveRow(selectedRecord)}
                  record={selectedRecord}
                  onClick={openApproveModal}
                  className={`${btn} px-4 bg-white border-slate-300 text-emerald-600 shadow-none`}
                />
                <ActionButton
                  module={MODULE}
                  action="view"
                  variant="outline"
                  label="View"
                  icon={Eye}
                  disabled={!selectedRecord}
                  record={selectedRecord}
                  onClick={() => openModal("view", selectedRecord)}
                  className={`${btn} px-4 bg-white border-slate-300 shadow-none`}
                />
                <ActionButton
                  module={MODULE}
                  action="delete"
                  variant="danger"
                  label="Delete"
                  icon={Trash2}
                  disabled={!canDeleteSelection()}
                  record={selectedRecord}
                  onClick={openDeleteModal}
                  className={`${btn} px-4 shadow-none`}
                />
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-0.5 shrink-0" />
                <button
                  type="button"
                  onClick={handleToolbarRefresh}
                  className={`${btn} px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center shadow-none`}
                  aria-label="Refresh"
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
            key={pageTab}
            showDate={!isPending}
            fromDate={isPending ? "" : draftFromDate}
            toDate={isPending ? "" : draftToDate}
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
            onApply={(data) => {
              if (isPending) return;
              const from = String(data.fromDate ?? "").trim();
              const to = String(data.toDate ?? "").trim();
              if (!from || !to) {
                toast.info("Select From and To date, then Search.");
                return;
              }
              setDraftFromDate(from);
              setDraftToDate(to);
              setAppliedFromDate(from);
              setAppliedToDate(to);
              setDisplayLimit(100);
            }}
            onReset={() => {
              resetSearch();
              setSelected(null);
              if (!isPending) {
                applyRegisterDefaultDates();
              }
              setDisplayLimit(100);
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            onSearchEnter={applySearchFromInput}
            searchVariant="quick"
            quickSearchOnly={isPending}
            showSearchButton={!isPending}
            applyOnSearchEnter={!isPending}
            searchPlaceholder={
              isPending
                ? "Search bill, customer, transport, vehicle…"
                : "Search bill, customer, transport, vehicle, remarks…"
            }
            searchLabel={isPending ? "Quick search" : "Search Register"}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 h-0 relative bg-white flex flex-col overflow-hidden isolate z-0">
          <DataTable
            key={`${pageTab}-${viewMode}`}
            headers={headers}
            data={items}
            loading={loading}
            viewMode={viewMode}
            allowCopy={true}
            showSelection={true}
            selectedId={selected}
            onSelect={setSelected}
            onRowDoubleClick={(row, id) => {
              setSelected(id);
              if (isPending && canReceiveNew && isIrAwaitingReceive(row)) openModal("add", row);
              else if (isPending && authorizeAccess?.allowed && canIrApproveRow(row)) openModal("approve", row);
              else if (canIrEditOnPendingTab(row) || canIrEditOnRegisterTab(row)) openModal("edit", row);
              else openModal("view", row);
            }}
            getRowId={getRowId}
            getRowClassName={isPending ? getRowClassName : undefined}
            sortKey={sort.key ?? ""}
            sortDir={sort.dir}
            onSort={(key) => {
              setDisplayLimit(100);
              setSort((s) => ({
                key,
                dir: s.key === key && s.dir === "asc" ? "desc" : "asc",
              }));
            }}
            onLoadMore={() => {
              if (!loading && items.length < filteredRows.length) setDisplayLimit((n) => n + 100);
            }}
            hasMore={items.length < filteredRows.length}
            totalItems={filteredRows.length}
            emptyIcon={isPending ? Truck : CheckCircle2}
            emptyMessage={isPending ? "No pending invoices" : "No register entries"}
            emptySubMessage={
              isPending
                ? "Only gate-registered bills await receiving."
                : "No invoices in this date range. Try a wider range or click Search after changing dates."
            }
            cardConfig={{
              titleKey: "prnbillno",
              detailKeys: isPending
                ? ["billdt", "acc_name", "transport", "vehicleno"]
                : ["billdt", "acc_name", "transport", "vehicleno", "approved", "remarks", "uploaded_at", "approved_at"],
            }}
            {...tableHotkeyProps}
          />
        </div>

        <AppListFooter
          shown={items.length}
          total={filteredRows.length}
          noun={isPending ? "Pending Bills" : "Register Entries"}
          selected={selected}
          selectedRecord={selectedRecord}
          selectionLabel={imsInvoiceReceivingLabel}
          onClearSelection={() => setSelected(null)}
        />
      </div>

      <InvoiceReceivingModal
        open={modal.open}
        mode={modal.mode}
        bill={modal.bill}
        onClose={() => setModal({ open: false, mode: "add", bill: null })}
        onSuccess={() => {
          setSelected(null);
          void refreshBothSilently();
        }}
      />

      {deleteItem ? (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={() => {
            setSelected(null);
            void refreshBothSilently();
          }}
          service={irDeleteService}
          entityLabel="Invoice receiving"
          idKey="prnbillno"
          titleKey="prnbillno"
          warningMessage="This clears receivingfile and receiverefno on ERP only. The bill will appear on Pending again."
          moduleSlug={MODULE}
        />
      ) : null}
    </div>
  );
}

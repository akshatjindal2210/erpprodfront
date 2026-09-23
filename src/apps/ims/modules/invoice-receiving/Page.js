"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Truck, CheckCircle2, ClipboardList, Plus, Eye, Pencil, CheckCircle, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

import { invoiceReceivingService } from "@/apps/ims/lib/services/invoiceReceiving";
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
import FilePreviewLink from "@/ui/common/system/FilePreviewLink";
import {
  canIrApproveRow,
  canIrClearReceivingRow,
  canIrEditRegisterRow,
  formatImsErpScalar,
  formatIrBillDate,
  formatIrDateTime,
  hasIrReceivingFile,
  irReceivingFilePath,
  irRemarksDisplay,
  isImsErpNullLiteral,
  isIrApproved,
  normalizeInvoiceReceivingRow,
  publicUploadHref,
  receivingFileLabel,
} from "./invoiceReceivingUtils";

const MODULE = "invoice_receiving";
const TABS = { REGISTER: "register", PENDING: "pending" };

const ERP_NULL_CLASS = "text-[10px] text-slate-400 italic font-medium";

function IrErpScalarCell({ value, className = "text-[10px] text-slate-500" }) {
  const text = formatImsErpScalar(value);
  if (text === "—") return "—";
  if (text === "null") return <span className={ERP_NULL_CLASS}>null</span>;
  return <span className={className}>{text}</span>;
}

const SHARED_HEADERS = [
  [
    "Bill Number",
    "prnbillno",
    (v) => (
      <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight">{v || "—"}</span>
    ),
    { fixed: true, width: "160px" },
  ],
  [
    "Bill Date",
    "billdt",
    (v) => <span className="text-[10px] text-slate-500 font-medium">{formatIrBillDate(v)}</span>,
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
    { width: "280px", wrap: true },
  ],
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
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [pageTab, setPageTab] = useState(TABS.PENDING);
  const isPending = pageTab === TABS.PENDING;

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [pendingRows, setPendingRows] = useState([]);
  const [registerRows, setRegisterRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [sort, setSort] = useState({ key: "prnbillno", dir: "desc" });
  const [modal, setModal] = useState({ open: false, mode: "add", bill: null });
  const [deleteItem, setDeleteItem] = useState(null);
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");

  const { tempSearch, setTempSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();

  useEffect(() => {
    if (dateFilterDefaults.from || dateFilterDefaults.to) {
      setAppliedFromDate(dateFilterDefaults.from);
      setAppliedToDate(dateFilterDefaults.to);
    }
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const fetchPending = useCallback(async () => {
    if (!viewAccess?.allowed) return;
    setLoading(true);
    try {
      const res = await invoiceReceivingService.list("");
      if (!res?.success) throw new Error(res?.message || "Failed to load.");
      setPendingRows((Array.isArray(res.data) ? res.data : []).map(normalizeInvoiceReceivingRow));
    } catch (err) {
      toast.error(err?.message || "Failed to load pending invoices.");
      setPendingRows([]);
    } finally {
      setLoading(false);
    }
  }, [viewAccess]);

  const fetchRegister = useCallback(async () => {
    if (!viewAccess?.allowed) return;
    setLoading(true);
    try {
      const res = await invoiceReceivingService.list("register", {
        from_date: appliedFromDate || undefined,
        to_date: appliedToDate || undefined,
      });
      if (!res?.success) throw new Error(res?.message || "Failed to load.");
      setRegisterRows((Array.isArray(res.data) ? res.data : []).map(normalizeInvoiceReceivingRow));
    } catch (err) {
      toast.error(err?.message || "Failed to load register.");
      setRegisterRows([]);
    } finally {
      setLoading(false);
    }
  }, [viewAccess, appliedFromDate, appliedToDate]);

  useEffect(() => {
    if (!viewAccess?.allowed) return;
    if (isPending) fetchPending();
    else fetchRegister();
  }, [isPending, viewAccess, fetchPending, fetchRegister]);

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

  const refreshActiveTab = useCallback(() => {
    if (isPending) fetchPending();
    else fetchRegister();
  }, [isPending, fetchPending, fetchRegister]);

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
        if (!addAccess?.allowed) {
          toast.info("No permission to receive.");
          return;
        }
        if (hasIrReceivingFile(target)) {
          toast.info("This bill is already received. Use Register → Edit or Approve.");
          return;
        }
      }
      if (mode === "approve") {
        if (isPending) {
          toast.info("Receive the file first (Pending → New), then approve on Register.");
          return;
        }
        if (!authorizeAccess?.allowed) {
          toast.info("No permission to approve.");
          return;
        }
        if (!hasIrReceivingFile(target)) {
          toast.info("Upload attachment first (Register → Edit), then approve.");
          return;
        }
        if (isIrApproved(target)) {
          toast.info("Already approved. Edit first, then approve again.");
          return;
        }
      }
      if (mode === "edit") {
        if (isPending) {
          toast.info("Switch to Register to edit.");
          return;
        }
        if (!editAccess?.allowed) {
          toast.info("No permission to edit.");
          return;
        }
      }
      setModal({ open: true, mode, bill: target });
    },
    [getSelectedRow, isPending, addAccess, editAccess, authorizeAccess]
  );

  const canDeleteSelection = useCallback(() => {
    if (isPending || !deleteAccess?.allowed || !selectedRecord) return false;
    return canIrClearReceivingRow(selectedRecord);
  }, [isPending, deleteAccess, selectedRecord]);

  const openDeleteModal = useCallback(() => {
    if (isPending) {
      toast.info("Delete is only on Register (clears receiving file).");
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
    modalOpen: modal.open || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: () => openModal("add"),
    openEdit: (row) => openModal("edit", row),
    openApprove: (row) => openModal("approve", row),
    canApproveSelection: () =>
      !isPending && authorizeAccess?.allowed && Boolean(selectedRecord) && canIrApproveRow(selectedRecord),
    onApproveBlocked: () => {
      if (isPending) toast.info("Receive on Pending first, then approve on Register.");
      else if (!authorizeAccess?.allowed) toast.info("No permission to approve.");
      else if (selectedRecord && isIrApproved(selectedRecord)) toast.info("Already approved. Edit first, then approve again.");
      else if (selectedRecord && !hasIrReceivingFile(selectedRecord)) toast.info("Receive the invoice file first (Pending → New).");
      else toast.info("Select a register row that is received and pending approval.");
    },
    canOpenNew: () => isPending && addAccess?.allowed,
    onNewBlocked: () => toast.info(isPending ? "No permission to receive." : "Switch to Pending to receive a new invoice."),
    canEditSelection: () =>
      !isPending && editAccess?.allowed && Boolean(selectedRecord) && canIrEditRegisterRow(selectedRecord),
    onEditBlocked: () => {
      if (isPending) toast.info("Switch to Register to edit.");
      else if (!editAccess?.allowed) toast.info("No permission to edit.");
      else toast.info("Select a register row.");
    },
    openDelete: openDeleteModal,
    canDeleteSelection,
    onDeleteBlocked: () => {
      if (isPending) toast.info("Switch to Register to delete receiving.");
      else if (!deleteAccess?.allowed) toast.info("No permission to delete.");
      else toast.info("Select a register row.");
    },
  });

  const headers = useMemo(() => {
    if (isPending) return SHARED_HEADERS;
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
      [
        "Attachment",
        "receivingfile",
        (v, row) => {
          const raw = v ?? row?.receivingfile ?? row?.file_path;
          if (isImsErpNullLiteral(raw)) return <span className={ERP_NULL_CLASS}>null</span>;
          const path = irReceivingFilePath(row);
          const name = receivingFileLabel(path);
          const href = publicUploadHref(path);
          if (!name || !href) return "—";
          return (
            <FilePreviewLink href={href} fileName={name} className="text-[10px] font-bold text-indigo-700 truncate hover:underline">
              {name}
            </FilePreviewLink>
          );
        },
        { width: "140px" },
      ],
      ["Received By", "uploaded_by", (v) => <IrErpScalarCell value={v} />, { width: "110px" }],
      [
        "Received At",
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

  const handleTabChange = useCallback(
    (tab) => {
      setPageTab(tab);
      setSelected(null);
      resetSearch();
      if (tab === TABS.REGISTER) {
        setAppliedFromDate(dateFilterDefaults.from);
        setAppliedToDate(dateFilterDefaults.to);
      }
      setDisplayLimit(100);
      setSort({ key: "prnbillno", dir: "desc" });
      setLoading(true);
    },
    [resetSearch, dateFilterDefaults.from, dateFilterDefaults.to]
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
                <ActionButton
                  module={MODULE}
                  action="add"
                  label="New"
                  icon={Plus}
                  disabled={!isPending}
                  onClick={openNewModal}
                  className={`${btn} px-3 sm:px-4`}
                />
                <ActionButton
                  module={MODULE}
                  action="edit"
                  variant="outline"
                  label="Edit"
                  icon={Pencil}
                  disabled={isPending || !selectedRecord || !canIrEditRegisterRow(selectedRecord)}
                  record={selectedRecord}
                  onClick={openEditModal}
                  className={`${btn} px-3 sm:px-4 bg-white border-slate-300`}
                />
                <ActionButton
                  module={MODULE}
                  action="authorize"
                  variant="outline"
                  label="Approve"
                  icon={CheckCircle}
                  disabled={isPending || !selectedRecord || !canIrApproveRow(selectedRecord)}
                  record={selectedRecord}
                  onClick={openApproveModal}
                  className={`${btn} px-3 sm:px-4 bg-white border-slate-300 text-emerald-600`}
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
                  className={`${btn} px-3 sm:px-4 bg-white border-slate-300`}
                />
                <ActionButton
                  module={MODULE}
                  action="delete"
                  variant="outline"
                  label="Delete"
                  icon={Trash2}
                  disabled={isPending || !canDeleteSelection()}
                  record={selectedRecord}
                  onClick={openDeleteModal}
                  className={`${btn} px-3 sm:px-4 bg-white border-slate-300 text-rose-600`}
                />
                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-0.5 shrink-0" />
                <button
                  type="button"
                  onClick={refreshActiveTab}
                  className={`${btn} px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center`}
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
            fromDate={isPending ? "" : appliedFromDate}
            toDate={isPending ? "" : appliedToDate}
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
            onApply={(data) => {
              if (isPending) return;
              setAppliedFromDate(data.fromDate || "");
              setAppliedToDate(data.toDate || "");
              setDisplayLimit(100);
            }}
            onReset={() => {
              resetSearch();
              setSelected(null);
              if (!isPending) {
                setAppliedFromDate(dateFilterDefaults.from);
                setAppliedToDate(dateFilterDefaults.to);
              }
              setDisplayLimit(100);
            }}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            onSearchEnter={applySearchFromInput}
            applyOnSearchEnter={false}
            searchPlaceholder={
              isPending ? "Search bill or customer…" : "Search bill, customer, remarks, or file…"
            }
            searchLabel={isPending ? "Search Pending" : "Search Register"}
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
              openModal(isPending && addAccess?.allowed ? "add" : "view", row);
            }}
            getRowId={getRowId}
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
            emptyTitle={isPending ? "No pending invoices" : "No register entries"}
            emptyDescription={
              isPending
                ? "Bills awaiting receiving file from ERP."
                : "No invoices in this date range on the register."
            }
            cardConfig={{
              titleKey: "prnbillno",
              detailKeys: isPending
                ? ["billdt", "acc_name"]
                : ["billdt", "acc_name", "approved", "remarks", "uploaded_at", "approved_at"],
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
          selectionLabel={(r) => `Selected: ${r?.prnbillno || "—"}`}
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
          refreshActiveTab();
        }}
      />

      {deleteItem ? (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={() => {
            setSelected(null);
            fetchPending();
            fetchRegister();
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

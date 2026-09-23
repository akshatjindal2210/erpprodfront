"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock, Edit3, Eye, FileEdit, Layers, List, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";
import { manageTrayService } from "@/apps/ims/lib/services/manageTray";
import { isManageTrayApproved, isManageTrayDraft, isManageTrayInProgress, isManageTrayInUse, isManageTrayReady, manageTrayLinkProgress, manageTrayStatusMeta } from "@/apps/ims/lib/helpers/manageTrayHelper";
import ManageTrayLinkModal from "@/apps/ims/modules/manage-tray/ManageTrayLinkModal";
import ManageTrayStartModal from "@/apps/ims/modules/manage-tray/ManageTrayStartModal";
import { formatDateTime } from "@/platform/utils/core/utilHelper";
import { IMS_LIST_PAGE_SHELL } from "@/ui/common/list/listPageShellClasses";
import AppListFooter from "@/ui/common/list/listPageFooter";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import ActionButton from "@/ui/primitives/ActionButton";
import { ListPageToolbar, ListPageToolbarLayout, LIST_PAGE_ACTION_CLASS } from "@/ui/common/list/ListPageToolbar";
import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import ImsSegmentedTabs from "@/ui/common/list/ImsSegmentedTabs";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import { useViewDateFilterDefaults } from "@/ui/common/list/dateFilterDefaults";
import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { applyClientSearch, nextSortParams, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import DataTable from "@/ui/primitives/DataTable";
import DeleteModal from "@/ui/common/modals/DeleteModal";

const TABS = { PENDING: "pending", REGISTER: "register" };
const PENDING_FILTER = { PENDING: "pending", REPORT: "report" };
const VIEW = { PENDING: "pending", REPORT: "report" };
const REPORT_VIEWS = { SUMMARY: "summary", TRAYS: "trays" };

const cell = (v) => <span className="text-[10px] text-slate-700">{v ?? "—"}</span>;
const num = (v) => Number(v) || 0;

function manageTraySearchParts(row) {
  const meta = manageTrayStatusMeta(row);
  const { linked, required } = manageTrayLinkProgress(row);
  return [
    row?.packing_number,
    row?.category_name,
    row?.item_code,
    row?.created_by_name,
    row?.updated_by_name,
    row?.remarks,
    row?.box_count,
    row?.code,
    row?.type,
    row?.batch_id,
    row?.pool_status,
    row?.pool_label,
    row?.packing_number,
    row?.box_no_uid,
    row?.acc_name,
    row?.item_code,
    meta?.label,
    linked,
    required,
    required ? `${linked}/${required}` : null,
  ].filter((v) => v != null && v !== "");
}

function poolBadgeClass(label) {
  const s = String(label || "").toUpperCase();
  if (s === "VACANT") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (s === "PACKING AREA" || s === "IN USE" || s === "OUT") return "bg-amber-50 text-amber-800 border-amber-200";
  if (s === "STORE IN" || s === "STORAGE") return "bg-slate-100 text-slate-700 border-slate-200";
  if (s === "CUSTOMER END" || s === "WITH CUSTOMER") return "bg-indigo-50 text-indigo-700 border-indigo-100";
  return "bg-slate-50 text-slate-500 border-slate-200";
}

export default function ManageTrayPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("manage_tray", "view"), [canAccess]);
  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);
  const [tab, setTab] = useState(TABS.PENDING);
  const pendingTab = tab === TABS.PENDING;
  const [pendingFilter, setPendingFilter] = useState(PENDING_FILTER.PENDING);
  const isReport = pendingTab && pendingFilter === PENDING_FILTER.REPORT;
  const pending = pendingTab && !isReport;
  const [reportView, setReportView] = useState(REPORT_VIEWS.SUMMARY);
  const [reportFilter, setReportFilter] = useState(null);
  const [viewMode, handleViewMode] = useViewMode();
  const [rows, setRows] = useState([]);
  const [reportSummary, setReportSummary] = useState(null);
  const [tempSearch, setTempSearch] = useState("");
  const [sort, setSort] = useState({ sortKey: "", sortDir: "asc" });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkRecord, setLinkRecord] = useState(null);
  const [linkReadOnly, setLinkReadOnly] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [fromDate, setFromDate] = useState(dateFilterDefaults.from);
  const [toDate, setToDate] = useState(dateFilterDefaults.to);
  const restoreSelectedIdRef = useRef(null);
  useEffect(() => {
    if (!dateFilterDefaults.from && !dateFilterDefaults.to) return;
    setFromDate(dateFilterDefaults.from);
    setToDate(dateFilterDefaults.to);
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const summaryRows = useMemo(() => {
    const s = reportSummary;
    if (!s) return [];
    const buckets = [
      { id: "total", status: "Total", customer: "", count: num(s.total_count), pool: "all" },
      { id: "vacant", status: "Vacant", customer: "", count: num(s.vacant_count), pool: "vacant" },
      { id: "storage", status: "Store In", customer: "", count: num(s.storage_count), pool: "storage" },
      { id: "packing", status: "Packing Area", customer: "", count: num(s.packing_area_count), pool: "in_use" },
    ];
    const customers = (s.customers || [])
      .filter((c) => String(c.acc_name || "").trim())
      .map((c, i) => ({
        id: `cust-${c.acc_code ?? `x${i}`}`,
        status: "Customer",
        customer: c.acc_name,
        count: num(c.count),
        pool: "with_customer",
        acc_code: c.acc_code,
      }));
    return [...buckets, ...customers];
  }, [reportSummary]);

  const reportSummaryView = isReport && reportView === REPORT_VIEWS.SUMMARY;
  const reportTrayView = isReport && reportView === REPORT_VIEWS.TRAYS;
  const tableSource = reportSummaryView ? summaryRows : rows;
  const filteredRows = useMemo(() => {
    const searched = applyClientSearch(tableSource, tempSearch, {
      getParts: reportSummaryView
        ? (r) => [r.status, r.customer, r.count]
        : reportTrayView
          ? manageTraySearchParts
          : (row) => manageTraySearchParts(row).filter((part) => part !== row?.acc_name),
      skipSort: Boolean(sort.sortKey),
    });
    if (!sort.sortKey) return searched;
    const rowsForSort = sort.sortKey === "status"
      ? searched.map((row) => (row.status != null ? row : { ...row, status: manageTrayStatusMeta(row).label }))
      : searched;
    return sortRowsByKey(rowsForSort, sort.sortKey, sort.sortDir);
  }, [tableSource, tempSearch, reportSummaryView, reportTrayView, sort]);

  const selectedRow = useMemo(
    () => filteredRows.find((r) => String(r.id) === String(selected)) ?? null,
    [filteredRows, selected]
  );
  const selectedIsDraft = useMemo(() => isManageTrayInProgress(selectedRow), [selectedRow]);
  const selectedIsReady = useMemo(() => isManageTrayReady(selectedRow), [selectedRow]);
  const selectedInUse = useMemo(() => isManageTrayInUse(selectedRow), [selectedRow]);
  const canDeleteSelection = useMemo(() => {
    if (isReport || !selectedRow || selectedInUse) return false;
    const { linked } = manageTrayLinkProgress(selectedRow);
    return linked > 0;
  }, [isReport, selectedRow, selectedInUse]);

  const manageTraySelectionLabel = useCallback(
    (r) => {
      if (reportSummaryView) {
        return `Selected: ${r?.status ?? "—"}${r?.customer ? ` · ${r.customer}` : ""} · ${num(r?.count).toLocaleString()} trays`;
      }
      let s = `Selected: ${r?.packing_number ?? "—"} · ${pending ? manageTrayStatusMeta(r).label : "REGISTERED"}`;
      if (isManageTrayInUse(r)) s += " · Already in use";
      if (isManageTrayReady(r)) s += " · Click New to start.";
      if (isManageTrayInProgress(r)) s += " · Click Draft to continue.";
      return s;
    },
    [reportSummaryView, pending]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isReport) {
        const summaryRes = await manageTrayService.reportSummary();
        setReportSummary(summaryRes?.data ?? null);
        if (reportView === REPORT_VIEWS.TRAYS) {
          const ledgerRes = await manageTrayService.reportLedger({
            page: 1,
            limit: 2000,
            sortBy: "type",
            order: "ASC",
            filters: {
              pool_status: reportFilter?.pool || "all",
              acc_code: reportFilter?.acc_code ?? null,
              unassigned: reportFilter?.unassigned === true,
            },
          });
          setRows(ledgerRes?.data ?? []);
        } else {
          setRows([]);
        }
      } else {
        setReportSummary(null);
        const res = await manageTrayService.getAll({
          page: 1,
          limit: 500,
          sortBy: "created_at",
          order: "DESC",
          filters: {
            approved: !pendingTab,
            ...(!pendingTab && fromDate ? { from_date: fromDate } : {}),
            ...(!pendingTab && toDate ? { to_date: toDate } : {}),
          },
        });
        const data = res?.data ?? [];
        setRows(data);
        if (pendingTab && !isReport && data.length === 0) setPendingFilter(PENDING_FILTER.REPORT);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to load");
      setRows([]);
      if (isReport) setReportSummary(null);
    } finally {
      setLoading(false);
    }
  }, [pendingTab, isReport, reportView, reportFilter, fromDate, toDate]);

  useEffect(() => {
    const restoreId = restoreSelectedIdRef.current;
    restoreSelectedIdRef.current = null;
    void (async () => {
      await load();
      if (restoreId != null) setSelected(String(restoreId));
      else setSelected(null);
    })();
  }, [load]);

  useEffect(() => {
    setSelected(null);
  }, [tempSearch]);

  useEffect(() => {
    setSort({ sortKey: "", sortDir: "asc" });
  }, [tab, pendingFilter, reportView]);

  const handleTabChange = useCallback((nextTab) => {
    setTab(nextTab);
    setTempSearch("");
    setSelected(null);
    setPendingFilter(PENDING_FILTER.PENDING);
    setReportView(REPORT_VIEWS.SUMMARY);
    setReportFilter(null);
  }, []);

  const viewValue = isReport ? VIEW.REPORT : VIEW.PENDING;

  const handlePendingFilterChange = useCallback((next) => {
    const view = next === VIEW.REPORT ? VIEW.REPORT : VIEW.PENDING;
    if (pendingTab && view === viewValue) return;
    setTempSearch("");
    setSelected(null);
    setReportView(REPORT_VIEWS.SUMMARY);
    setReportFilter(null);
    setTab(TABS.PENDING);
    setPendingFilter(view === VIEW.REPORT ? PENDING_FILTER.REPORT : PENDING_FILTER.PENDING);
  }, [pendingTab, viewValue]);

  const handleSearchReset = useCallback(() => {
    setTempSearch("");
    setSelected(null);
    setFromDate(dateFilterDefaults.from || "");
    setToDate(dateFilterDefaults.to || "");
    if (pendingTab) setPendingFilter(PENDING_FILTER.PENDING);
    setReportView(REPORT_VIEWS.SUMMARY);
    setReportFilter(null);
  }, [pendingTab, dateFilterDefaults.from, dateFilterDefaults.to]);

  const openTraysForRow = useCallback((row) => {
    if (!row) return;
    const named = String(row.id || "").startsWith("cust-");
    setReportFilter({
      pool: row.pool || "all",
      acc_code: named ? row.acc_code ?? null : null,
      unassigned: named && row.acc_code == null,
      label: named ? row.customer : row.status,
    });
    setReportView(REPORT_VIEWS.TRAYS);
    setSelected(null);
    setTempSearch("");
  }, []);

  const handleReportViewChange = useCallback((next) => {
    if (next === REPORT_VIEWS.TRAYS && selectedRow && reportSummaryView) {
      openTraysForRow(selectedRow);
      return;
    }
    setReportView(next || REPORT_VIEWS.SUMMARY);
    setReportFilter(null);
    setSelected(null);
    setTempSearch("");
  }, [selectedRow, reportSummaryView, openTraysForRow]);

  const handleStartLinking = useCallback(() => {
    if (pending && selectedRow && isManageTrayDraft(selectedRow)) {
      setLinkRecord(null);
      setLinkModalOpen(true);
      return;
    }
    setStartOpen(true);
  }, [pending, selectedRow]);

  const handleDraftClick = useCallback(() => {
    if (!selectedRow || !isManageTrayInProgress(selectedRow)) {
      toast.info("Select an in-progress packing, then click Draft.");
      return;
    }
    setLinkModalOpen(true);
  }, [selectedRow]);

  const handleDeleteClick = useCallback(() => {
    if (selectedInUse) {
      toast.info("This packing is already in use. You cannot delete it.");
      return;
    }
    if (!canDeleteSelection || !selectedRow) {
      toast.info("Select a packing with links to clear.");
      return;
    }
    setDeleteItem(selectedRow);
  }, [canDeleteSelection, selectedRow, selectedInUse]);

  const canEditLinking = useMemo(() => {
    if (pending || isReport || !selectedRow || linkModalOpen || selectedInUse) return false;
    return isManageTrayApproved(selectedRow);
  }, [isReport, selectedRow, linkModalOpen, pending, selectedInUse]);

  const openPackingForView = useCallback((row) => {
    if (!row) return;
    setSelected(String(row.id));
    setLinkRecord(row);
    setLinkReadOnly(true);
    setLinkModalOpen(true);
  }, []);

  const openPackingForEdit = useCallback(async (row, readOnlyIfInUse = false) => {
    if (!row) return;
    setLinkReadOnly(false);
    if (isManageTrayInUse(row)) {
      if (!readOnlyIfInUse) {
        toast.info("This packing is already in use. You cannot edit it.");
        return;
      }
      setSelected(String(row.id));
      setLinkRecord(row);
      setLinkModalOpen(true);
      return;
    }
    try {
      await manageTrayService.movePending(row.packing_number || row.id);
    } catch (err) {
      toast.error(err?.message || "Could not move this packing to Pending.");
      return;
    }
    setTab(TABS.PENDING);
    setPendingFilter(PENDING_FILTER.PENDING);
    setSelected(String(row.id));
    setLinkRecord(row);
    setLinkModalOpen(true);
  }, []);

  const handleEditClick = useCallback(() => {
    if (!selectedRow || isReport) return;
    void openPackingForEdit(selectedRow);
  }, [selectedRow, isReport, openPackingForEdit]);

  const getSelectedRow = useCallback(() => selectedRow, [selectedRow]);

  const { openNewModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "manage_tray",
    modalOpen: linkModalOpen || startOpen || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: handleStartLinking,
    canOpenNew: useCallback(() => true, []),
    openEdit: () => void handleEditClick(),
    canEditSelection: useCallback(() => canEditLinking, [canEditLinking]),
    onEditBlocked: useCallback(() => {
      if (!selectedRow) toast.info("Select a packing to edit links.");
      else if (selectedInUse) toast.info("This packing is already in use. You cannot edit it.");
      else if (pending && isManageTrayApproved(selectedRow)) {
        toast.info("Open the Registered tab to edit this packing.");
      } else toast.info("Select a packing to edit sticker and tray links.");
    }, [selectedRow, pending, selectedInUse]),
  });

  const listHeaders = useMemo(() => {
    const base = [
      ["Packing No", "packing_number", (v) => <span className="font-bold text-[10px]">{v}</span>, { width: "110px", fixed: true }],
      [
        "Status",
        "status",
        (_, row) => {
          const openLeft = num(row.open_in_hand) || num(row.open_count);
          const linked = num(row.link_count);
          const required = num(row.box_count);
          const meta = !pendingTab || (isManageTrayInUse(row) && !openLeft)
            ? { label: "REGISTERED", className: "bg-emerald-50 text-emerald-600 border-emerald-100" }
            : manageTrayStatusMeta({ ...row, approved: openLeft > 0 ? false : row.approved });
          const progress = meta.label === "DRAFT" && (linked || required) ? `${linked} / ${required || "?"} boxes` : null;
          return (
            <div className="flex flex-col gap-0.5 min-w-[100px]">
              <span className={`px-2 py-0.5 text-[9px] font-black uppercase border w-fit ${meta.className}`}>
                {meta.label}
              </span>
              {progress ? (
                <span className="text-[8px] font-bold text-slate-500 tabular-nums">{progress}</span>
              ) : null}
            </div>
          );
        },
        { width: "120px", wrap: true },
      ],
      ["Item", "item_code", cell, { width: "90px" }],
      ["Box", "box_count", (v) => <span className="text-[10px] font-bold tabular-nums">{v != null ? num(v) : "—"}</span>, { width: "70px" }],
      ["Created By", "created_by_name", cell, { width: "100px" }],
      ["Created At", "created_at", (v) => cell(formatDateTime(v)), { width: "130px" }],
    ];
    if (!pendingTab) {
      base.push(
        ["Updated By", "updated_by_name", cell, { width: "100px" }],
        ["Updated At", "updated_at", (v) => cell(formatDateTime(v)), { width: "130px" }]
      );
    }
    return base;
  }, [pendingTab]);

  const ledgerHeaders = useMemo(
    () => [
      ["Tray Code", "code", (v) => <span className="font-mono font-bold text-[10px]">{v || "—"}</span>, { width: "100px", fixed: true }],
      ["Type", "type", (v) => <span className="text-[10px] font-bold uppercase text-slate-700">{v || "—"}</span>, { width: "60px" }],
      [
        "Pool",
        "pool_label",
        (v) => (
          <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${poolBadgeClass(v)}`}>● {v || "—"}</span>
        ),
        { width: "120px" },
      ],
      ["Packing No", "packing_number", (v) => <span className="font-mono font-bold text-[10px]">{v || "—"}</span>, { width: "100px" }],
      ["Customer", "acc_name", cell, { width: "160px" }],
      ["Item", "item_code", cell, { width: "90px" }],
      ["Sticker", "box_no_uid", (v) => <span className="font-mono text-[10px] text-slate-600">{v || "—"}</span>, { width: "130px" }],
      ["Qty", "qty", (v) => <span className="text-[10px] font-bold tabular-nums text-emerald-700">{v != null ? num(v) : "—"}</span>, { width: "60px" }],
      ["Batch", "batch_id", cell, { width: "110px" }],
      ["Assigned At", "assigned_at", (v) => cell(formatDateTime(v)), { width: "130px" }],
      ["Updated At", "updated_at", (v) => cell(formatDateTime(v)), { width: "130px" }],
    ],
    []
  );

  const summaryHeaders = useMemo(
    () => [
      [
        "Status",
        "status",
        (v) => (
          <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${poolBadgeClass(v === "Total" ? "" : v === "Customer" ? "CUSTOMER END" : v)}`}>
            {v || "—"}
          </span>
        ),
        { width: "140px" },
      ],
      [
        "Customer",
        "customer",
        (v) => <span className="text-[10px] font-bold uppercase text-slate-800">{v || "—"}</span>,
        { width: "240px" },
      ],
      [
        "Trays",
        "count",
        (v) => (
          <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 border border-indigo-100 text-[11px] tabular-nums">
            {num(v).toLocaleString()}
          </span>
        ),
        { width: "90px" },
      ],
    ],
    []
  );

  const headers = reportSummaryView ? summaryHeaders : isReport ? ledgerHeaders : listHeaders;

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: isReport ? "Manage Tray Pool Ledger" : pendingTab ? "Manage Tray Pending" : "Manage Tray Registered",
    rows: filteredRows,
    headers,
  });

  const extraFilters = useMemo(() => [
    {
      label: "View",
      key: "pendingFilter",
      value: pendingTab ? viewValue : "",
      preserveOrder: true,
      variant: "quick",
      options: [
        { label: "Pending", value: VIEW.PENDING },
        { label: "Report", value: VIEW.REPORT },
      ],
    },
  ], [pendingTab, viewValue]);

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 overflow-hidden rounded-none shadow-sm">
        <ListPageToolbar>
          <ListPageToolbarLayout
            tabs={
              <ImsSegmentedTabs
                className="mr-2"
                active={tab}
                onChange={handleTabChange}
                tabs={[
                  { id: TABS.REGISTER, label: "Registered", icon: CheckCircle2 },
                  { id: TABS.PENDING, label: "Pending", icon: Clock },
                ]}
              />
            }
            subTabs={
              isReport ? (
                <ImsSegmentedTabs
                  className="mr-2"
                  active={reportView}
                  onChange={handleReportViewChange}
                  tabs={[
                    { id: REPORT_VIEWS.SUMMARY, label: "Summary", icon: List },
                    { id: REPORT_VIEWS.TRAYS, label: "By Tray", icon: Layers },
                  ]}
                />
              ) : null
            }
            actions={
              <>
                <ActionButton
                  module="manage_tray"
                  action="add"
                  label="New"
                  icon={Plus}
                  disabled={linkModalOpen || startOpen}
                  onClick={openNewModal}
                  title={
                    pending && selectedRow && isManageTrayDraft(selectedRow)
                      ? "Start scan for the selected packing"
                      : "Receive, reassign, or start a pending packing"
                  }
                  className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4`}
                />
                {pending && (
                  <ActionButton
                    module="manage_tray"
                    action="edit"
                    variant="outline"
                    label="Draft"
                    icon={FileEdit}
                    disabled={!selectedIsDraft || linkModalOpen}
                    record={null}
                    onClick={handleDraftClick}
                    title="Continue in-progress linking"
                    className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4 bg-white border-amber-300 text-amber-800`}
                  />
                )}
                {!isReport && !pending && (
                  <ActionButton
                    module="manage_tray"
                    action="view"
                    variant="outline"
                    label="View"
                    icon={Eye}
                    disabled={!selectedRow || linkModalOpen}
                    record={null}
                    onClick={() => openPackingForView(selectedRow)}
                    title="View submitted links"
                    className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4 bg-white border-slate-300`}
                  />
                )}
                {!isReport && (
                  <ActionButton
                    module="manage_tray"
                    action="edit"
                    variant="outline"
                    label="Edit"
                    icon={Edit3}
                    disabled={!canEditLinking}
                    record={pending ? null : selectedRow}
                    onClick={() => void handleEditClick()}
                    title={selectedInUse ? "This packing is already in use. You cannot edit it." : pending ? "Pending packings cannot be edited. Use New." : "Edit sticker and tray links"}
                    className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4 bg-white border-slate-300`}
                  />
                )}
                {!isReport && (
                  <ActionButton
                    module="manage_tray"
                    action="delete"
                    variant="danger"
                    label="Delete"
                    icon={Trash2}
                    disabled={!canDeleteSelection || linkModalOpen || startOpen}
                    onClick={handleDeleteClick}
                    title={selectedInUse ? "This packing is already in use. You cannot delete it." : "Clear sticker and tray links"}
                    className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4`}
                  />
                )}

                {reportSummaryView && selectedRow && (
                  <button
                    type="button"
                    onClick={() => openTraysForRow(selectedRow)}
                    className={`${LIST_PAGE_ACTION_CLASS} px-3 sm:px-4 border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 flex items-center gap-1.5`}
                  >
                    <Layers size={14} /> View Trays
                  </button>
                )}

                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-0.5 shrink-0" />

                <button
                  type="button"
                  onClick={load}
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

          {reportTrayView && reportFilter && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-amber-50 border border-amber-200">
              <span className="text-[10px] font-bold text-amber-800 uppercase">
                {reportFilter.label} — {filteredRows.length} tray{filteredRows.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => setReportFilter(null)}
                className="text-amber-600 hover:text-amber-900 flex items-center gap-1 font-bold text-[10px] uppercase"
              >
                <X size={14} /> Show all trays
              </button>
            </div>
          )}

        </ListPageToolbar>

        <ListPageFilterStrip>
          <DateRangeFilter
            key={`${tab}-${pendingFilter}-${fromDate}-${toDate}`}
            showDate={!pendingTab}
            fromDate={!pendingTab ? fromDate : ""}
            toDate={!pendingTab ? toDate : ""}
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
            instantClientExtras
            searchVariant={!pendingTab ? "server" : "quick"}
            applyOnSearchEnter={false}
            extraFilters={extraFilters}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            onReset={handleSearchReset}
            onApply={(data) => {
              if (pendingTab) return;
              setFromDate(String(data?.fromDate || "").slice(0, 10));
              setToDate(String(data?.toDate || "").slice(0, 10));
            }}
            onExtraFilterChange={(key, value) => {
              if (key === "pendingFilter") handlePendingFilterChange(value);
            }}
            searchPlaceholder={reportSummaryView ? "Search status or customer" : isReport ? "Search tray code, type, or customer" : !pendingTab ? "Search packing no..." : "Search packing or item"}
            searchLabel={!pendingTab ? "Search packing no." : "Quick Search"}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 h-0 relative bg-white flex flex-col overflow-hidden isolate z-0">
          <DataTable
            key={`${tab}-${pendingFilter}-${reportView}-${reportFilter?.label || "all"}-${viewMode}`}
            headers={headers}
            data={filteredRows}
            loading={loading}
            viewMode={viewMode}
            selectedId={selected}
            onSelect={setSelected}
            getRowId={(r) => String(r.id)}
            allowCopy
            sortKey={sort.sortKey}
            sortDir={sort.sortDir}
            onSort={(key) => setSort((prev) => nextSortParams(prev, key))}
            onRowDoubleClick={(row) => {
              if (reportSummaryView) {
                openTraysForRow(row);
                return;
              }
              if (isReport || pending) return;
              openPackingForView(row);
            }}
            {...tableHotkeyProps}
          />
        </div>

        <AppListFooter
          shown={filteredRows.length}
          total={
            reportSummaryView ? summaryRows.length : rows.length
          }
          noun={
            reportSummaryView
              ? "summary rows"
              : reportTrayView
                ? "trays"
                : pending
                  ? "pending packings"
                  : "registered packings"
          }
          selected={selected}
          selectedRecord={selectedRow}
          selectionLabel={manageTraySelectionLabel}
          onClearSelection={() => setSelected(null)}
        />
      </div>

      <ManageTrayStartModal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        onDone={() => {
          load();
        }}
        onStartPending={(row) => {
          setLinkRecord(row);
          setLinkModalOpen(true);
        }}
      />

      <ManageTrayLinkModal
        open={linkModalOpen}
        onClose={() => {
          setLinkModalOpen(false);
          setLinkRecord(null);
          setLinkReadOnly(false);
        }}
        record={linkRecord || selectedRow}
        readOnly={linkReadOnly || (!pending && isManageTrayInUse(linkRecord || selectedRow))}
        onSuccess={(data) => {
          if (data?.moved_to_pending) {
            setTab(TABS.PENDING);
            setPendingFilter(PENDING_FILTER.PENDING);
          }
          load();
          setSelected(null);
        }}
      />

      <DeleteModal
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onSuccess={() => {
          load();
          setSelected(null);
        }}
        service={manageTrayService}
        entityLabel="Manage Tray links"
        idKey="id"
        titleKey="packing_number"
        moduleSlug="manage_tray"
        warningMessage="This clears all sticker and tray links and returns the packing to Pending."
      />
    </div>
  );
}

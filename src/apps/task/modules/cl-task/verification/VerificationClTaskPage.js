"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { FilePenLine, ShieldCheck, RefreshCcw, X, ClipboardCheck, Star, AlertTriangle, Eye, Loader2, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

import { useCanAccess } from "@/platform/hooks/auth/useCanAccess";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { useListDrawerHotkeys } from "@/platform/hooks/list/useListDrawerHotkeys";
import { IMS_LIST_PAGE_SHELL, IMS_TABLE_CELL_DATE, IMS_TABLE_CELL_TEXT } from "@/ui/common/list/listPageShellClasses";
import { applyClientSearch, sortRowsByKey } from "@/ui/common/list/clientListSearch";
import { useAppliedListSearch } from "@/ui/common/list/useAppliedListSearch";

import ListPageExportToggle from "@/ui/common/list/ListPageExportToggle";
import { useListPageExport } from "@/platform/hooks/list/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/ui/common/list/ListPageToolbar";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import DataTable from "@/ui/primitives/DataTable";
import ActionButton from "@/ui/primitives/ActionButton";
import DeleteModal from "@/ui/common/modals/DeleteModal";

import { clTaskService } from "@/apps/task/lib/services/clTaskApi";
import { useClTaskFilters } from "@/apps/task/lib/hooks/useClTaskFilters";
import { CL_ORG_FILTER_CLASS } from "@/apps/task/lib/helpers/clTaskScopeHelper";
import { formatDateTime, formatScheduledDate } from "@/apps/task/lib/helpers/utilHelper";
import { stripHtml } from "@/apps/task/lib/helpers/clTaskFormHelper";
import { isClTaskMissed, isClTaskDueFillable } from "@/apps/task/lib/helpers/clTaskTimeHelper";
import { filterRowsByViewDays, isOutsidePermissionDays } from "@/platform/utils/auth/permissionDays";
import { editTimeBlockedByAccess } from "@/platform/hooks/list/useListDrawerHotkeys";
import ClVerificationFormModal from "./ClVerificationFormModal";
import VerificationClTaskCard from "./VerificationClTaskCard";

const capitalize = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "—");

/** Default Approval = submitted, waiting for verifier. */
const STATUS_FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Due", value: "due" },
  { label: "Missed", value: "missed" },
  { label: "Approval", value: "approval" },
  { label: "Complete", value: "complete" },
];

function matchesVerificationStatus(row, statusFilter) {
  if (!statusFilter || statusFilter === "all") return true;
  /** Approval / Complete / All: any type (open + frequently). */
  if (statusFilter === "approval") return row.status === "awaiting_verification";
  if (statusFilter === "complete") return row.status === "completed";
  /** Due + Missed: frequently only (open never appears here). */
  if (statusFilter === "missed") {
    return row.task_type === "frequently" && (isClTaskMissed(row) || row.is_missed === true);
  }
  if (statusFilter === "due") {
    return row.task_type === "frequently" && isClTaskDueFillable(row);
  }
  return true;
}

function verificationStatusMeta(row) {
  const type = String(row?.task_type || "");
  const status = String(row?.status || "");
  const missed = type === "frequently" && (isClTaskMissed(row) || row?.is_missed === true);

  if (missed) {
    return { label: "MISSED", tone: "bg-rose-50 text-rose-600 border-rose-100" };
  }
  if (status === "completed") {
    return { label: "COMPLETE", tone: "bg-emerald-50 text-emerald-600 border-emerald-100" };
  }
  if (status === "awaiting_verification") {
    return { label: "APPROVAL", tone: "bg-violet-50 text-violet-700 border-violet-200" };
  }
  if (type === "open") {
    return { label: "OPEN", tone: "bg-sky-50 text-sky-700 border-sky-100" };
  }
  return { label: "DUE", tone: "bg-amber-50 text-amber-700 border-amber-100" };
}

const instanceDeleteService = {
  delete: (id) => clTaskService.deleteInstance(id),
};

export default function VerificationClTaskPage() {
  const canAccess = useCanAccess();
  const canView = canAccess("cl_task_verification", "view").allowed;
  const canAdd = canAccess("cl_task_verification", "add").allowed;
  const canEdit = canAccess("cl_task_verification", "edit").allowed;
  const canDelete = canAccess("cl_task_verification", "delete").allowed;
  const canVerify = canAccess("cl_task_verification", "authorize").allowed;
  const viewAccess = canAccess("cl_task_verification", "view");
  const editAccess = canAccess("cl_task_verification", "edit");

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const { tempSearch, setTempSearch, appliedSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();
  const [selected, setSelected] = useState(null);
  const [formTask, setFormTask] = useState(null);
  /** Permission subset passed into the shared form, e.g. ['ADD'], ['EDIT'], ['APPROVE'], ['VIEW']. */
  const [formPermissions, setFormPermissions] = useState(["VIEW"]);
  const [deleteItem, setDeleteItem] = useState(null);
  const [statusFilter, setStatusFilter] = useState("approval");

  const [params, setParams] = useState({
    pageSize: 1000,
    sortKey: "submitted_at",
    sortDir: "asc",
  });

  const {
    selectedDepartment,
    setSelectedDepartment,
    selectedDesignation,
    setSelectedDesignation,
    selectedPerson,
    setSelectedPerson,
    departmentsLists,
    designationsLists,
    personOptions,
    clearFilters,
  } = useClTaskFilters();

  const fetchTasks = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await clTaskService.getVerification({
        page: 1,
        limit: params.pageSize,
        sortBy: "submitted_at",
        order: "ASC",
        status: "all",
        ...(appliedSearch ? { search: appliedSearch } : {}),
        ...(selectedDepartment ? { department_id: selectedDepartment } : {}),
        ...(selectedDesignation ? { designation_id: selectedDesignation } : {}),
        ...(selectedPerson ? { person_id: selectedPerson } : {}),
      });
      const body = res?.data;
      const nested = body?.data;
      const list = Array.isArray(nested)
        ? nested
        : (nested?.data ?? nested?.items ?? []);
      setAllRows(Array.isArray(list) ? list : []);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err.response?.data?.message || err?.message || "Failed to load verification tasks");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [canView, params.pageSize, appliedSearch, selectedDepartment, selectedDesignation, selectedPerson]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filteredRows = useMemo(() => {
    let data = filterRowsByViewDays(allRows, viewAccess.days, [
      "submitted_at",
      "created_at",
      "scheduled_date",
      "updated_at",
    ]);
    data = data.filter((r) => matchesVerificationStatus(r, statusFilter));
    if (selectedDepartment) {
      data = data.filter((r) => Number(r.department_id) === Number(selectedDepartment));
    }
    if (selectedDesignation) {
      data = data.filter((r) => Number(r.designation_id) === Number(selectedDesignation));
    }
    if (selectedPerson) {
      data = data.filter((r) => Number(r.person_id) === Number(selectedPerson));
    }
    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(data, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [
    allRows,
    tempSearch,
    params.sortKey,
    params.sortDir,
    statusFilter,
    selectedDepartment,
    selectedDesignation,
    selectedPerson,
    viewAccess.days,
  ]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + 100);
    }
  }, [loading, items.length, totalItems]);

  const selectedRecord = useMemo(
    () => filteredRows.find((t) => t.instance_id === selected) || null,
    [filteredRows, selected],
  );

  const getSelectedRow = useCallback(
    () => filteredRows.find((t) => t.instance_id === selected),
    [filteredRows, selected],
  );

  const canAddOnRow = useCallback(
    (row) => !!row && canAdd && row.status === "awaiting_verification",
    [canAdd],
  );
  /** EDIT only before verify — locked once completed. */
  const canEditOnRow = useCallback(
    (row) =>
      !!row &&
      canEdit &&
      !isOutsidePermissionDays(row, editAccess.days) &&
      ["pending", "awaiting_verification"].includes(row.status),
    [canEdit, editAccess.days],
  );
  /** APPROVE: update only (awaiting or completed) — cannot verify. */
  const canApproveOnRow = useCallback(
    (row) =>
      !!row &&
      canVerify &&
      ["awaiting_verification", "completed", "pending"].includes(row.status) &&
      !isOutsidePermissionDays(row, editAccess.days),
    [canVerify, editAccess.days],
  );

  const openView = useCallback((row) => {
    if (!row) return;
    setFormPermissions(["VIEW"]);
    setFormTask(row);
  }, []);

  /** Verify button only — score + Verify/Reject (ADD). Never opened from Update / Approve. */
  const openAddForm = useCallback((row) => {
    if (!row || !canAdd) return;
    if (row.status !== "awaiting_verification") {
      toast.info("Verify is available only on Approval status");
      return;
    }
    setFormPermissions(["ADD"]);
    setFormTask(row);
  }, [canAdd]);

  /** Update button — user data only (EDIT). No Verify actions. */
  const openEditForm = useCallback((row) => {
    if (!row || !canEdit) return;
    if (editTimeBlockedByAccess(row, editAccess)) {
      toast.info(`Edit time limit exceeded (${editAccess.days} days)`);
      return;
    }
    if (row.status === "completed") {
      toast.info("Verified tasks can only be updated with Approve permission");
      return;
    }
    if (!["pending", "awaiting_verification"].includes(row.status)) {
      toast.info("Update is available only before verification");
      return;
    }
    setFormPermissions(["EDIT"]);
    setFormTask(row);
  }, [canEdit, editAccess]);

  /** Approve button — update only (APPROVE). No Verify actions. */
  const openApproveForm = useCallback((row) => {
    if (!row || !canVerify) return;
    if (editTimeBlockedByAccess(row, editAccess)) {
      toast.info(`Edit time limit exceeded (${editAccess.days} days)`);
      return;
    }
    if (!["awaiting_verification", "completed", "pending"].includes(row.status)) {
      toast.info("Update is available on Approval, Pending, or Complete status");
      return;
    }
    setFormPermissions(["APPROVE"]);
    setFormTask(row);
  }, [canVerify, editAccess]);

  /**
   * Card / double-click — update or view only.
   * Verify never opens here; user must click Verify toolbar button.
   */
  const openSmartForm = useCallback((row) => {
    if (!row) return;
    if (row.status === "completed") {
      if (canVerify && canApproveOnRow(row)) {
        setFormPermissions(["APPROVE"]);
        setFormTask(row);
        return;
      }
      openView(row);
      return;
    }
    const updatePerms = [];
    if (canEditOnRow(row)) updatePerms.push("EDIT");
    if (canApproveOnRow(row)) updatePerms.push("APPROVE");
    if (updatePerms.length) {
      setFormPermissions(updatePerms);
      setFormTask(row);
      return;
    }
    openView(row);
  }, [canVerify, openView, canApproveOnRow, canEditOnRow]);

  const openDeleteModal = useCallback((row) => {
    if (!canDelete || !row) return;
    setDeleteItem({ ...row, id: row.instance_id });
  }, [canDelete]);

  const { tableHotkeyProps } = useListDrawerHotkeys({
    module: "cl_task_verification",
    authorizeAction: "authorize",
    modalOpen: !!formTask || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: canAdd ? () => openAddForm(getSelectedRow()) : undefined,
    openApprove: canVerify ? openApproveForm : undefined,
    openEdit: canEdit ? openEditForm : undefined,
    openDelete: canDelete ? openDeleteModal : undefined,
    canOpenNew: useCallback(
      () => !!selected && canAdd && selectedRecord?.status === "awaiting_verification",
      [selected, canAdd, selectedRecord?.status],
    ),
    canApproveSelection: useCallback(
      () =>
        !!selected &&
        canVerify &&
        ["awaiting_verification", "completed", "pending"].includes(selectedRecord?.status),
      [selected, canVerify, selectedRecord?.status],
    ),
    canDeleteSelection: useCallback(() => !!selected && canDelete, [selected, canDelete]),
  });

  const handleFilterApply = (data = {}) => {
    if (data.searchSubmit) {
      applySearchFromInput();
    }
    const nextStatus = data.status || statusFilter || "approval";
    setStatusFilter(nextStatus);
    setSelectedDepartment(data.department_id || "");
    setSelectedDesignation(data.designation_id || "");
    setSelectedPerson(data.person_id || "");
    setDisplayLimit(100);
    setSelected(null);
  };

  const handleReset = () => {
    resetSearch();
    setStatusFilter("approval");
    clearFilters();
    setSelected(null);
    setDisplayLimit(100);
    setParams({
      pageSize: 1000,
      sortKey: "submitted_at",
      sortDir: "asc",
    });
  };
  const extraFilters = useMemo(
    () => [
      {
        label: "Status",
        key: "status",
        value: statusFilter || "approval",
        variant: "quick",
        preserveOrder: true,
        options: STATUS_FILTER_OPTIONS,
      },
      {
        label: "Department",
        key: "department_id",
        value: selectedDepartment || "",
        searchable: true,
        placeholder: "Search departments…",
        variant: "quick",
        className: CL_ORG_FILTER_CLASS,
        options: [
          { label: "All Departments", value: "" },
          ...departmentsLists.map((d) => ({ label: d.name, value: String(d.id) })),
        ],
      },
      {
        label: "Designation",
        key: "designation_id",
        value: selectedDesignation || "",
        searchable: true,
        placeholder: "Search designations…",
        variant: "quick",
        className: CL_ORG_FILTER_CLASS,
        options: [
          { label: "All Designations", value: "" },
          ...designationsLists.map((d) => ({ label: d.name, value: String(d.id) })),
        ],
      },
      {
        label: "Users",
        key: "person_id",
        value: selectedPerson || "",
        searchable: true,
        placeholder: "Search users…",
        variant: "quick",
        className: CL_ORG_FILTER_CLASS,
        options: [
          { label: "All Users", value: "" },
          ...personOptions.map((p) => ({ label: p.name, value: String(p.id) })),
        ],
      },
    ],
    [
      statusFilter,
      selectedDepartment,
      selectedDesignation,
      selectedPerson,
      departmentsLists,
      designationsLists,
      personOptions,
    ],
  );

  const HEADERS = useMemo(
    () => [
      [
        "#",
        "instance_id",
        (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>,
        { fixed: true, width: "70px" },
      ],
      [
        "Title",
        "title",
        (v, row) => {
          const desc = stripHtml(row.description) || stripHtml(row.sop_description);
          return (
            <div className="flex flex-col leading-tight py-0.5 min-w-0">
              <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight truncate" title={v}>
                {v || "—"}
              </span>
              {desc ? (
                <span className="text-[10px] text-slate-500 truncate italic" title={desc}>
                  {desc}
                </span>
              ) : null}
              {row.reject_count > 0 ? (
                <span className="inline-flex items-center gap-1 mt-0.5 text-[9px] font-bold text-rose-600 uppercase">
                  <AlertTriangle size={9} /> {row.reject_count}x reject
                </span>
              ) : null}
            </div>
          );
        },
        { fixed: true, width: "220px" },
      ],
      [
        "Type",
        "task_type",
        (v, row) => (
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-bold text-slate-600 uppercase">{capitalize(v)}</span>
            {row.recurrence_type ? (
              <span className="text-[9px] text-slate-400 uppercase">{row.recurrence_type}</span>
            ) : null}
          </div>
        ),
        { width: "100px" },
      ],
      [
        "Person",
        "person_name",
        (v) => <span className={IMS_TABLE_CELL_TEXT}>{v || "—"}</span>,
        { width: "130px" },
      ],
      [
        "Department",
        "department_name",
        (v) => <span className="text-[10px] font-bold text-slate-600 uppercase">{v || "—"}</span>,
        { width: "120px" },
      ],
      [
        "Designation",
        "designation_name",
        (v) => <span className="text-[10px] font-medium text-slate-500 uppercase">{v || "—"}</span>,
        { width: "120px" },
      ],
      [
        "Scheduled",
        "scheduled_date",
        (v) => <span className={IMS_TABLE_CELL_DATE}>{formatScheduledDate(v)}</span>,
        { width: "110px" },
      ],
      [
        "Submitted",
        "submitted_at",
        (v) => <span className={IMS_TABLE_CELL_DATE}>{formatDateTime(v)}</span>,
        { width: "150px" },
      ],
      [
        "Status",
        "status",
        (_v, row) => {
          const { label, tone } = verificationStatusMeta(row);
          return (
            <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${tone}`}>
              ● {label}
            </span>
          );
        },
        { width: "110px" },
      ],
      [
        "Score",
        "score",
        (v, row) =>
          row.status === "completed" && v != null ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-700">
              <Star size={11} className="fill-amber-400 text-amber-400" />{" "}
              {Number.isFinite(Number(v)) ? `${Math.round((Number(v) / 10) * 1000) / 10}%` : "—"}
            </span>
          ) : (
            <span className="text-[10px] text-slate-300">—</span>
          ),
        { width: "90px", align: "center" },
      ],
      [
        "Weightage",
        "weightage",
        (v, row) => (
          <span className="font-black text-slate-700 text-[11px]">{v ?? row.wastage ?? "—"}</span>
        ),
        { width: "90px", align: "center" },
      ],
    ],
    [],
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "CL Verification",
    rows: filteredRows,
    headers: HEADERS,
  });

  const statusFooter =
    statusFilter === "complete"
      ? " · Complete"
      : statusFilter === "due"
        ? " · Due"
        : statusFilter === "missed"
          ? " · Missed"
          : statusFilter === "all"
            ? " · All"
            : " · Approval";

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
                <button
                  type="button"
                  onClick={() => openView(selectedRecord)}
                  disabled={!selectedRecord}
                  className="h-9 shrink-0 px-4 rounded-none border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider shadow-none disabled:opacity-40"
                >
                  <Eye size={14} /> View
                </button>

                <ActionButton
                  module="cl_task_verification"
                  action="add"
                  variant="outline"
                  label="Verify"
                  icon={ClipboardCheck}
                  disabled={!canAddOnRow(selectedRecord)}
                  onClick={() => openAddForm(selectedRecord)}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                  title="Add permission — scoring / Verify-Approve"
                />

                <ActionButton
                  module="cl_task_verification"
                  action="edit"
                  variant="outline"
                  label="Update"
                  icon={FilePenLine}
                  disabled={!canEditOnRow(selectedRecord)}
                  record={selectedRecord}
                  onClick={() => openEditForm(selectedRecord)}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                  title="Edit permission — user data only (cannot approve)"
                />

                <ActionButton
                  module="cl_task_verification"
                  action="authorize"
                  label="Approve"
                  icon={ShieldCheck}
                  disabled={!canApproveOnRow(selectedRecord)}
                  onClick={() => openApproveForm(selectedRecord)}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                  title="Approve permission — update only (cannot verify; only Add can approve)"
                />

                <ActionButton
                  module="cl_task_verification"
                  action="delete"
                  variant="danger"
                  label="Delete"
                  icon={Trash2}
                  disabled={!selectedRecord || !canDelete}
                  onClick={() => openDeleteModal(selectedRecord)}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />

                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />

                <button
                  type="button"
                  onClick={fetchTasks}
                  disabled={loading}
                  className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase shadow-none shrink-0 disabled:opacity-60"
                  aria-label="Refresh"
                >
                  <RefreshCcw size={14} className={loading ? "animate-spin text-indigo-600" : ""} />
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
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-600 uppercase truncate">
                Selected: {selectedRecord?.title || selectedRecord?.instance_id}
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
            showDate={false}
            applyExtrasOnChange
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchVariant="quick"
            searchPlaceholder="Search title, person, description…"
            searchLabel="Search"
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          {viewMode === "card" ? (
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 bg-slate-50/60">
              {loading && items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
                  <Loader2 size={28} className="animate-spin text-indigo-500" />
                  <p className="text-sm font-medium">Loading verification queue…</p>
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
                    <ClipboardCheck size={22} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">No tasks in this filter</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Change status or dept / person filters to see more.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {items.map((task) => (
                    <VerificationClTaskCard
                      key={task.instance_id}
                      task={task}
                      selected={Number(selected) === Number(task.instance_id)}
                      onSelect={(row) =>
                        setSelected((prev) =>
                          Number(prev) === Number(row.instance_id) ? null : row.instance_id,
                        )
                      }
                      onOpen={openSmartForm}
                    />
                  ))}
                </div>
              )}
              {!loading && items.length < totalItems ? (
                <div className="flex justify-center py-4">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50"
                  >
                    Load more
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <DataTable
              headers={HEADERS}
              data={items}
              loading={loading}
              viewMode="table"
              allowCopy
              {...tableHotkeyProps}
              showSelection
              skeletonCount={50}
              emptyIcon={ClipboardCheck}
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
              getRowId={(item) => item.instance_id}
              onRowDoubleClick={openSmartForm}
              onLoadMore={handleLoadMore}
              hasMore={items.length < totalItems}
              totalItems={totalItems}
            />
          )}
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems}
            {statusFooter}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      <ClVerificationFormModal
        task={formTask}
        permissions={formPermissions}
        onClose={() => {
          setFormTask(null);
          setFormPermissions(["VIEW"]);
        }}
        onSuccess={() => {
          setFormTask(null);
          setFormPermissions(["VIEW"]);
          setSelected(null);
          fetchTasks();
        }}
      />

      {deleteItem && (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={() => {
            fetchTasks();
            setSelected(null);
          }}
          service={instanceDeleteService}
          entityLabel="CL Task"
          idKey="instance_id"
          warningMessage="This deletes only this task occurrence (instance), not the master template."
        />
      )}
    </div>
  );
}

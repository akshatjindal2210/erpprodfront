"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Trash2, RefreshCcw, X, ClipboardList, Power, Edit3, Copy } from "lucide-react";
import { toast } from "react-toastify";

import { useCanAccess } from "@/core/hooks/useCanAccess";
import { useViewMode } from "@/core/hooks/useViewMode";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";
import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";
import { applyClientSearch, sortRowsByKey } from "@/features/apps/ims/helpers/clientListSearch";
import { useAppliedListSearch } from "@/features/apps/ims/helpers/useAppliedListSearch";

import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useListPageExport } from "@/core/hooks/useListPageExport";
import { ListPageToolbar, ListPageToolbarLayout } from "@/core/components/common/ListPageToolbar";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import DataTable from "@/core/components/ui/DataTable";
import ActionButton from "@/core/components/ui/ActionButton";
import DeleteModal from "@/core/components/common/DeleteModal";

import { clTaskService } from "@/features/apps/task/services/clTaskApi";
import { useClTaskFilters } from "@/features/apps/task/hooks/useClTaskFilters";
import { formatDateTime, formatScheduledDate } from "@/features/apps/task/helpers/utilHelper";
import { stripHtml } from "@/features/apps/task/helpers/clTaskFormHelper";
import { formatDueTimeLabel } from "@/features/apps/task/helpers/clTaskTimeHelper";
import { filterRowsByViewDays } from "@/core/utils/permissionDays";
import { editTimeBlockedByAccess } from "@/core/hooks/useListDrawerHotkeys";
import ClTaskModal from "./ClTaskModal";
const capitalize = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "—");

const isActiveFlag = (v) => v === true || v === 1 || v === "1" || v === "t" || v === "true";

const formatTypeLabel = (taskType, recurrenceType) => {
  const base = capitalize(taskType);
  if (taskType === "frequently" && recurrenceType) {
    return `${base} · ${capitalize(recurrenceType)}`;
  }
  return base;
};

export default function ClTaskPage() {
  const canAccess = useCanAccess();
  const canView = canAccess("cl_task_master", "view").allowed;
  const canAdd = canAccess("cl_task_master", "add").allowed;
  const canDelete = canAccess("cl_task_master", "delete").allowed;
  const canEdit = canAccess("cl_task_master", "edit").allowed;
  /** Active / Deactive — authorize (approve) permission only. */
  const canToggleActive = canAccess("cl_task_master", "authorize").allowed;
  const viewAccess = canAccess("cl_task_master", "view");
  const editAccess = canAccess("cl_task_master", "edit");

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [togglingId, setTogglingId] = useState(null);

  const [params, setParams] = useState({
    pageSize: 1000,
    taskType: "all",
    activeFilter: "all",
    sortKey: "cl_task_id",
    sortDir: "desc",
  });

  const { tempSearch, setTempSearch, appliedSearch, applySearchFromInput, resetSearch } = useAppliedListSearch();
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [cloneItem, setCloneItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

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
      const response = await clTaskService.getAll({
        page: 1,
        limit: params.pageSize,
        sortBy: "cl_task_id",
        order: "DESC",
        ...(appliedSearch ? { search: appliedSearch } : {}),
      });
      const body = response.data;
      const nested = body?.data;
      const list = Array.isArray(nested)
        ? nested
        : (nested?.data ?? nested?.items ?? []);
      setAllRows(Array.isArray(list) ? list : []);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err.response?.data?.message || err?.message || "Failed to load CL tasks");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [canView, params.pageSize, appliedSearch]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filteredRows = useMemo(() => {
    let data = filterRowsByViewDays(allRows, viewAccess.days);
    if (params.taskType !== "all") {
      data = data.filter((r) => String(r.task_type) === params.taskType);
    }
    if (params.activeFilter === "active") {
      data = data.filter((r) => isActiveFlag(r.approved ?? r.is_active));
    } else if (params.activeFilter === "inactive") {
      data = data.filter((r) => !isActiveFlag(r.approved ?? r.is_active));
    }
    if (selectedDepartment) {
      data = data.filter((r) => Number(r.department_id) === Number(selectedDepartment));
    }
    if (selectedDesignation) {
      data = data.filter((r) => Number(r.designation_id) === Number(selectedDesignation));
    }
    if (selectedPerson) {
      data = data.filter((r) => Number(r.person_id) === Number(selectedPerson));
    }
    const q = String(tempSearch || "").trim();
    if (q) {
      data = applyClientSearch(data, tempSearch, { skipSort: !!params.sortKey });
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [
    allRows,
    tempSearch,
    params.sortKey,
    params.sortDir,
    params.taskType,
    params.activeFilter,
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
    () => filteredRows.find((t) => String(t.cl_task_id) === String(selected)) || null,
    [filteredRows, selected],
  );

  const getSelectedRow = useCallback(
    () => filteredRows.find((t) => String(t.cl_task_id) === String(selected)),
    [filteredRows, selected],
  );

  const openNewModal = useCallback(() => {
    if (!canAdd) return;
    setEditItem(null);
    setCloneItem(null);
    setModalOpen(true);
  }, [canAdd]);

  const openEditModal = useCallback((row) => {
    if (!canEdit || !row) return;
    if (editTimeBlockedByAccess(row, editAccess)) {
      toast.info(`Edit time limit exceeded (${editAccess.days} days)`);
      return;
    }
    setCloneItem(null);
    setEditItem(row);
    setModalOpen(true);
  }, [canEdit, editAccess]);

  const openCloneModal = useCallback((row) => {
    if (!canAdd || !row) return;
    setEditItem(null);
    setCloneItem(row);
    setModalOpen(true);
  }, [canAdd]);

  const openDeleteModal = useCallback((row) => {
    if (!canDelete || !row) return;
    setDeleteItem({ ...row, id: row.cl_task_id });
  }, [canDelete]);

  const { tableHotkeyProps } = useListDrawerHotkeys({
    module: "cl_task_master",
    modalOpen: modalOpen || !!deleteItem,
    selectedId: selected,
    getSelectedRow,
    openAdd: canAdd ? openNewModal : undefined,
    openEdit: canEdit ? openEditModal : undefined,
    openDelete: canDelete ? openDeleteModal : undefined,
    canDeleteSelection: useCallback(() => !!selected && canDelete, [selected, canDelete]),
  });

  const handleFilterApply = (data = {}) => {
    if (data.searchSubmit) {
      applySearchFromInput();
    }
    setSelectedDepartment(data.department_id || "");
    setSelectedDesignation(data.designation_id || "");
    setSelectedPerson(data.person_id || "");
    setParams((prev) => ({
      ...prev,
      taskType: data.taskType || prev.taskType,
      activeFilter: data.activeFilter || prev.activeFilter,
    }));
    setDisplayLimit(100);
    setSelected(null);
  };

  const handleReset = () => {
    resetSearch();
    clearFilters();
    setParams({
      pageSize: 1000,
      taskType: "all",
      activeFilter: "all",
      sortKey: "cl_task_id",
      sortDir: "desc",
    });
    setDisplayLimit(100);
    setSelected(null);
  };

  const toggleActive = async (row) => {
    if (!canToggleActive || !row?.cl_task_id) {
      toast.error("You do not have permission to activate / deactivate CL Task Master");
      return;
    }
    setTogglingId(row.cl_task_id);
    try {
      const next = !isActiveFlag(row.approved ?? row.is_active);
      await clTaskService.setActive(row.cl_task_id, next);
      toast.success(next ? "CL Task Master activated" : "CL Task Master deactivated — new cycles stopped");
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update status");
    } finally {
      setTogglingId(null);
    }
  };

  const extraFilters = useMemo(
    () => [
      {
        label: "Type",
        key: "taskType",
        value: params.taskType,
        variant: "quick",
        className: "w-[7rem] shrink-0",
        options: [
          { label: "All Types", value: "all" },
          { label: "Open", value: "open" },
          { label: "Frequently", value: "frequently" },
        ],
      },
      {
        label: "Status",
        key: "activeFilter",
        value: params.activeFilter,
        variant: "quick",
        className: "w-[6.5rem] shrink-0",
        options: [
          { label: "All", value: "all" },
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
      {
        label: "Department",
        key: "department_id",
        value: selectedDepartment || "",
        variant: "quick",
        className: "min-w-[9.5rem] md:w-[11rem] shrink-0",
        options: [
          { label: "All Departments", value: "" },
          ...departmentsLists.map((d) => ({ label: d.name, value: String(d.id) })),
        ],
      },
      {
        label: "Designation",
        key: "designation_id",
        value: selectedDesignation || "",
        variant: "quick",
        className: "min-w-[9.5rem] md:w-[11rem] shrink-0",
        options: [
          { label: "All Designations", value: "" },
          ...designationsLists.map((d) => ({ label: d.name, value: String(d.id) })),
        ],
      },
      {
        label: "Person",
        key: "person_id",
        value: selectedPerson || "",
        variant: "quick",
        className: "min-w-[9.5rem] md:w-[11rem] shrink-0",
        options: [
          { label: "All Persons", value: "" },
          ...personOptions.map((p) => ({ label: p.name, value: String(p.id) })),
        ],
      },
    ],
    [
      params.taskType,
      params.activeFilter,
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
        "ID",
        "cl_task_id",
        (v) => <span className="font-mono text-indigo-600 font-bold text-[10px]">{v}</span>,
        { fixed: true, width: "70px" },
      ],
      [
        "Title",
        "title",
        (v, row) => {
          const desc = stripHtml(row.description) || stripHtml(row.sop_description);
          return (
            <div className="flex flex-col leading-tight py-0.5 min-w-0 max-w-full">
              <span className="font-bold text-slate-800 uppercase text-[11px] tracking-tight truncate" title={v}>
                {v || "—"}
              </span>
            </div>
          );
        },
        {
          fixed: true,
          width: "200px",
          // Card title wrapper forces whitespace-normal on children — use clamps here.
          cardRender: (v, row) => {
            const desc = stripHtml(row.description) || stripHtml(row.sop_description);
            return (
              <div className="flex flex-col gap-0.5 min-w-0 max-w-full normal-case">
                <span
                  className="font-bold text-slate-800 text-[13px] leading-snug line-clamp-2 break-words"
                  title={v || ""}
                >
                  {v || "—"}
                </span>
                {desc ? (
                  <span className="text-[11px] text-slate-500 italic leading-snug line-clamp-2 break-words font-medium" title={desc}>
                    {desc}
                  </span>
                ) : null}
              </div>
            );
          },
        },
      ],
      [
        "Type",
        "task_type",
        (v, row) => (
          <span className="text-[10px] font-bold text-slate-600 uppercase whitespace-nowrap" title={formatTypeLabel(v, row.recurrence_type)}>
            {formatTypeLabel(v, row.recurrence_type)}
          </span>
        ),
        {
          width: "110px",
          cardRender: (v, row) => (
            <span className="text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">
              {formatTypeLabel(v, row.recurrence_type)}
            </span>
          ),
        },
      ],
      [
        "Status",
        "approved",
        (v, row) => {
          const ok = isActiveFlag(v ?? row.is_active);
          return (
            <span
              className={`px-2 py-0.5 text-[9px] font-black uppercase border ${
                ok
                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}
            >
              {ok ? "● ACTIVE" : "○ INACTIVE"}
            </span>
          );
        },
        { width: "100px" },
      ],
      [
        "Subs",
        "instance_count",
        (v) => <span className="font-bold text-slate-700 text-[11px] tabular-nums">{v ?? 0}</span>,
        { width: "70px", align: "center" },
      ],
      [
        "Due Time",
        "due_time",
        (v, row) =>
          row.task_type === "frequently" && v ? (
            <span className="text-[10px] font-bold text-indigo-600 uppercase">
              {formatDueTimeLabel(v)}
            </span>
          ) : (
            <span className="text-[10px] text-slate-400">—</span>
          ),
        { width: "100px" },
      ],
      [
        "Next cycle",
        "next_occurrence",
        (v, row) =>
          row.task_type === "frequently" ? (
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] text-slate-600 font-medium tabular-nums">
                {formatScheduledDate(v) || "—"}
              </span>
              {Number(row.day_offset) > 0 ? (
                <span className="text-[9px] text-indigo-500 font-semibold">+{row.day_offset}d offset</span>
              ) : null}
            </div>
          ) : (
            <span className="text-[10px] text-slate-400">—</span>
          ),
        { width: "120px" },
      ],
      [
        "Weightage",
        "weightage",
        (v, row) => <span className="font-black text-slate-700 text-[11px]">{v ?? row.wastage ?? "—"}</span>,
        { width: "90px", align: "center" },
      ],
      [
        "Department",
        "department_name",
        (v) => <span className="text-[10px] font-bold text-slate-600 uppercase">{v || "—"}</span>,
        { width: "120px" },
      ],
      [
        "Person",
        "person_name",
        (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>,
        { width: "130px" },
      ],
      [
        "Verifier",
        "verification_user_name",
        (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>,
        { width: "130px" },
      ],
      [
        "Created by",
        "created_by_name",
        (v, row) => (
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-semibold text-slate-700 truncate" title={v || ""}>
              {v || "—"}
            </span>
            <span className="text-[9px] text-slate-400">{formatDateTime(row.created_at)}</span>
          </div>
        ),
        { width: "130px" },
      ],
      [
        "Updated by",
        "updated_by_name",
        (v, row) => (
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-semibold text-slate-700 truncate" title={v || ""}>
              {v || "—"}
            </span>
            <span className="text-[9px] text-slate-400">
              {row.updated_by_name || row.updated_by ? formatDateTime(row.updated_at) : "—"}
            </span>
          </div>
        ),
        { width: "130px" },
      ],
    ],
    [],
  );

  const { exporting, handleExport, exportDisabled } = useListPageExport({
    moduleName: "CL Task Master",
    rows: filteredRows,
    headers: HEADERS,
  });

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
                <ActionButton
                  module="cl_task_master"
                  action="add"
                  label="New"
                  icon={Plus}
                  onClick={openNewModal}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />

                <ActionButton
                  module="cl_task_master"
                  action="add"
                  variant="outline"
                  label="Clone"
                  icon={Copy}
                  disabled={!selectedRecord}
                  onClick={() => openCloneModal(selectedRecord)}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                  title="Copy selected row — edit details then create as new"
                />

                <ActionButton
                  module="cl_task_master"
                  action="edit"
                  variant="outline"
                  label="Edit"
                  icon={Edit3}
                  disabled={!selectedRecord}
                  record={selectedRecord}
                  onClick={() => openEditModal(selectedRecord)}
                  className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none shrink-0"
                />

                {canToggleActive ? (
                  <button
                    type="button"
                    disabled={!selectedRecord || togglingId === selectedRecord?.cl_task_id}
                    onClick={() => selectedRecord && toggleActive(selectedRecord)}
                    title="Active / Deactive (approve permission)"
                    className="flex items-center justify-center gap-2 px-4 h-9 text-[11px] font-bold uppercase rounded-none transition-colors duration-200 border bg-white border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-none shrink-0"
                  >
                    <Power size={16} strokeWidth={2} />
                    <span>
                      {selectedRecord && isActiveFlag(selectedRecord.approved ?? selectedRecord.is_active)
                        ? "Deactive"
                        : "Active"}
                    </span>
                  </button>
                ) : null}

                <ActionButton
                  module="cl_task_master"
                  action="delete"
                  variant="danger"
                  label="Delete"
                  icon={Trash2}
                  disabled={!selected}
                  onClick={() => selectedRecord && openDeleteModal(selectedRecord)}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none shrink-0"
                />

                <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1 shrink-0" />

                <button
                  type="button"
                  onClick={() => fetchTasks()}
                  className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase shadow-none shrink-0"
                >
                  <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
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
                Selected: {selectedRecord?.title || selectedRecord?.cl_task_id}
                {selectedRecord?.instance_count != null
                  ? ` · ${selectedRecord.instance_count} assigned task(s)`
                  : ""}
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
          <DataTable
            headers={HEADERS}
            data={items}
            loading={loading}
            viewMode={viewMode}
            allowCopy
            {...tableHotkeyProps}
            showSelection
            skeletonCount={100}
            emptyIcon={ClipboardList}
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
            getRowId={(item) => String(item.cl_task_id)}
            onRowDoubleClick={
              canEdit
                ? (row) => {
                    setSelected(String(row.cl_task_id));
                    openEditModal(row);
                  }
                : undefined
            }
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={{
              titleKey: "title",
              badgeIndices: [3],
              detailIndices: [2, 4, 5, 9],
              footerKey: "created_at",
            }}
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} CL Task Master
          </span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {modalOpen && (
        <ClTaskModal
          open={modalOpen}
          editItem={editItem}
          cloneItem={cloneItem}
          onClose={() => {
            setModalOpen(false);
            setEditItem(null);
            setCloneItem(null);
          }}
          onSuccess={() => {
            fetchTasks();
            setSelected(null);
          }}
        />
      )}

      {deleteItem && (
        <DeleteModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onSuccess={() => {
            fetchTasks();
            setSelected(null);
          }}
          service={clTaskService}
          entityLabel="CL Task Master"
          idKey="id"
          warningMessage="This deletes the master template and all of its assigned CL tasks."
        />
      )}
    </div>
  );
}

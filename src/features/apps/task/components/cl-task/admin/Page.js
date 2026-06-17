"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { LayoutGrid, List, Loader2, Minimize2, Maximize2 } from "lucide-react";
import { toast } from "react-toastify";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import {
  SearchBar,
  Pagination,
  DeleteModal,
  FilterButtonsRecurrence,
  SortIcon,
  EmptyState,
} from "@/features/apps/task/common";
import { clTaskService } from "@/features/apps/task/services/clTaskApi";
import { useClTaskFilters } from "@/features/apps/task/hooks/useClTaskFilters";
import { useViewMode } from "@/features/apps/task/hooks/useViewMode";
import ClTaskTopFilters from "./ClTaskTopFilters";
import ClTaskModal from "./ClTaskModal";
import ClTaskTableRow from "./ClTaskTableRow";
import ClTaskAdminCard from "./ClTaskAdminCard";

const TABLE_COLS = [
  { label: "#", key: "index" },
  { label: "Title", key: "title" },
  { label: "Type", key: "task_type" },
  { label: "Scheduled", key: "scheduled_date" },
  { label: "Wattage", key: "wastage" },
  { label: "Department", key: "department_name" },
  { label: "Designation", key: "designation_name" },
  { label: "Person", key: "person_name" },
  { label: "Verification", key: "verification_user_name" },
  { label: "End Date", key: "end_date_time" },
  { label: "Status", key: "status" },
  { label: "Score", key: "score" },
  { label: "Rejects", key: "reject_count" },
  { label: "Created At", key: "created_at" },
];

export default function ClTaskPage() {
  const canAccess = useCanAccess();
  const canView = canAccess("cl_task", "view").allowed;
  const canAdd = canAccess("cl_task", "add").allowed;
  const canDelete = canAccess("cl_task", "delete").allowed;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState("instance_id");
  const [sortDir, setSortDir] = useState("desc");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTask, setDeleteTask] = useState(null);
  const [viewMode, handleViewMode] = useViewMode("table");

  const tableContainerRef = useRef(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

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
    if (!canView) { setLoading(false); return; }
    setLoading(true);
    try {
      const params = {
        page,
        limit: pageSize,
        sortBy: sortKey,
        order: sortDir,
        search: search || undefined,
        department_id: selectedDepartment || undefined,
        designation_id: selectedDesignation || undefined,
        person_id: selectedPerson || undefined,
      };

      const response = await clTaskService.getAll(params);
      const body = response.data;
      const list = body.data?.data ?? [];
      const total = body.data?.total ?? 0;

      setTasks(Array.isArray(list) ? list : []);
      setTotalItems(total);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load CL tasks");
    } finally {
      setLoading(false);
    }
  }, [canView, page, pageSize, search, sortKey, sortDir, selectedDepartment, selectedDesignation, selectedPerson]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const handler = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleSort = (key) => {
    if (key === "index") return;
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const hasFilter = !!(selectedDepartment || selectedDesignation || selectedPerson || search);

  const handleReset = () => {
    setSearch("");
    setSortKey("instance_id");
    setSortDir("desc");
    setPage(1);
    clearFilters();
  };

  const toggleFullScreen = () => {
    if (!isFullScreen) {
      tableContainerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (!canView) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="font-medium">You do not have permission to view CL Tasks.</p>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 md:p-6 bg-slate-100 min-h-screen text-slate-800">
        <ClTaskTopFilters
          onAdd={() => setModalOpen(true)}
          canAdd={canAdd}
          departmentsLists={departmentsLists}
          designationsLists={designationsLists}
          personOptions={personOptions}
          selectedDepartment={selectedDepartment}
          selectedDesignation={selectedDesignation}
          selectedPerson={selectedPerson}
          onDepartmentChange={(id) => { setSelectedDepartment(id); setPage(1); }}
          onDesignationChange={(id) => { setSelectedDesignation(id); setPage(1); }}
          onPersonChange={(id) => { setSelectedPerson(id); setPage(1); }}
        />

        {/* Main card — same shell as Tasks page (no tabs) */}
        <div
          ref={tableContainerRef}
          className={`bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all duration-300 ${
            isFullScreen
              ? "fixed inset-0 z-[999] rounded-none h-screen w-screen"
              : ""
          }`}
        >
          <div className={`flex flex-col overflow-hidden ${isFullScreen ? "h-full" : ""}`}>
            {/* Toolbar */}
            <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0 bg-white z-[10]">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <SearchBar
                    value={search}
                    onChange={(val) => { setSearch(val); setPage(1); }}
                    placeholder="Search by title, description…"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2 sm:gap-3">
                  <FilterButtonsRecurrence onRefresh={fetchTasks} onReset={handleReset} />

                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white shrink-0 shadow-sm">
                    <button
                      type="button"
                      onClick={() => handleViewMode("table")}
                      className={`px-3 py-2.5 transition-all ${viewMode === "table" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
                      title="Table view"
                    >
                      <List size={15} />
                    </button>
                    <div className="w-px h-5 bg-slate-200" />
                    <button
                      type="button"
                      onClick={() => handleViewMode("card")}
                      className={`px-3 py-2.5 transition-all ${viewMode === "card" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}
                      title="Card view"
                    >
                      <LayoutGrid size={15} />
                    </button>
                    <div className="w-px h-5 bg-slate-200" />
                    <button
                      type="button"
                      onClick={toggleFullScreen}
                      className="px-3 py-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-all"
                      title={isFullScreen ? "Exit fullscreen" : "Fullscreen"}
                    >
                      {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Table view */}
            {viewMode === "table" ? (
              <div
                className={
                  isFullScreen
                    ? "flex-1 min-h-0 overflow-auto border-t border-slate-100"
                    : "overflow-auto border-t border-slate-100 h-[550px]"
                }
              >
                <table className="w-full text-sm min-w-[1100px] border-separate border-spacing-0">
                  <thead className="sticky top-0 z-[5] shadow-sm">
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="w-1 p-0 sticky left-0 z-[5] bg-slate-50 border-b border-slate-200" />
                      {TABLE_COLS.map(({ label, key }, i) => (
                        <th
                          key={key}
                          onClick={() => toggleSort(key)}
                          className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider select-none whitespace-nowrap border-b border-slate-200 ${
                            key !== "index" ? "cursor-pointer hover:text-slate-700 transition-colors" : ""
                          } ${
                            i === 0
                              ? "sticky left-[5px] z-[5] bg-slate-50 border-r"
                              : i === 1
                                ? "sticky left-[42px] z-[5] bg-slate-50 border-r min-w-[160px]"
                                : "bg-slate-50"
                          }`}
                        >
                          {label}
                          {key !== "index" && <SortIcon sortKey={sortKey} columnKey={key} sortDir={sortDir} />}
                        </th>
                      ))}
                      <th className="px-3 py-3 w-20 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sticky right-0 z-[5] bg-slate-50 border-l border-slate-200 border-b">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={TABLE_COLS.length + 2} className="py-16 text-center text-slate-400">
                          <Loader2 size={28} className="mx-auto mb-2 animate-spin opacity-40" />
                          <p className="text-sm">Loading CL tasks…</p>
                        </td>
                      </tr>
                    ) : tasks.length === 0 ? (
                      <tr>
                        <td colSpan={TABLE_COLS.length + 2} className="py-16 text-center">
                          <EmptyState activeTab="" hasFilter={hasFilter} onReset={handleReset} />
                        </td>
                      </tr>
                    ) : (
                      tasks.map((task, i) => (
                        <ClTaskTableRow
                          key={task.instance_id}
                          task={task}
                          index={(page - 1) * pageSize + i + 1}
                          onDelete={canDelete ? (t) => setDeleteTask({ ...t, id: t.instance_id }) : undefined}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                className={
                  isFullScreen
                    ? "flex-1 min-h-0 overflow-y-auto p-4 custom-scrollbar border-t border-slate-100"
                    : "overflow-y-auto p-4 custom-scrollbar border-t border-slate-100 min-h-[320px]"
                }
              >
                {loading ? (
                  <div className="py-16 text-center text-slate-400">
                    <Loader2 size={28} className="mx-auto mb-2 animate-spin opacity-40" />
                    <p className="text-sm">Loading CL tasks…</p>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="py-16 text-center">
                    <EmptyState activeTab="" hasFilter={hasFilter} onReset={handleReset} />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {tasks.map((task, i) => (
                      <ClTaskAdminCard
                        key={task.instance_id}
                        task={task}
                        index={(page - 1) * pageSize + i + 1}
                        onDelete={canDelete ? (t) => setDeleteTask({ ...t, id: t.instance_id }) : undefined}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex-shrink-0 mt-auto">
              <Pagination
                page={page}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageChange={setPage}
                onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              />
            </div>
          </div>
        </div>

        <DeleteModal
          item={deleteTask}
          onClose={() => setDeleteTask(null)}
          onSuccess={fetchTasks}
          service={clTaskService}
          entityLabel="CL Task"
        />
      </div>

      <ClTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchTasks}
      />
    </>
  );
}

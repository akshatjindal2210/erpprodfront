"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Check, Clock, LayoutGrid, List, Calendar } from "lucide-react";
import { toast } from "react-toastify";
import {
  recurringTaskService,
  taskService,
  DeleteModal,
  FilterButtonsRecurrence,
  BulkActionBar,
  StatCard,
  SearchBar,
  Pagination,
  useViewMode,
  useRecurringFilters,
} from "@/features/apps/task/common";
import RecurringTaskCard from "./RecurringTaskCard";
import RecurringTaskTableRow from "./RecurringTaskTableRow";
import ReportFilters from "../reports/ReportFilters";
import { useSelector } from "react-redux";
import RecurringTaskModal from "../tasks/RecurringTaskModal";

export default function RecurringTasksPage() {
  const currentUser = useSelector((state) => state.auth.user);
  const isSuperAdmin = currentUser?.type === "super_admin";
  const isAdmin      = currentUser?.type === "admin";

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [viewMode, handleViewMode] = useViewMode();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState("recurring_id");
  const [sortDir, setSortDir] = useState("asc");

  const { selectedDepartment, setSelectedDepartment, selectedUser, setSelectedUser, departmentsLists, filteredUsers, clearFilters } = useRecurringFilters(currentUser);

  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, today: 0 });
  const [selected, setSelected] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selfModal, setSelfModal] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [cloneTask, setCloneTask] = useState(null);
  const [deleteTask, setDeleteTask] = useState(null);

  // ── Flag to track if the user manually cleared the filters ──────────
  const isManuallyCleared = useRef(false);
  
  // ── Allow fetching only after initialization ─────────────────
  const isInitialized = useRef(false);

  // ── ONCE: Initialize selectedUser on mount ──────────
  useEffect(() => {
    if (isAdmin || isSuperAdmin) {
      // Admin: pre-select own name
      setSelectedUser(currentUser.id);
    }
    // Normal user: handled by useRecurringFilters hook
    isInitialized.current = true;
  }, []); // dependency array EMPTY - mount only

  // ── SINGLE FETCH: All data fetching logic ───────────────────────────────
  const fetchTasks = useCallback(async () => {
    if (!isInitialized.current) return;

    setLoading(true);
    try {
      const hasReportFilter = !!(selectedDepartment || selectedUser);

      const params = {
        page,
        limit: pageSize,
        sortBy: sortKey,
        order: sortDir,
        search: search || undefined,
        is_active: statusFilter !== "All"
          ? (statusFilter === "Active" ? 1 : 0)
          : undefined,
        ...(hasReportFilter && {
          report: true,
          department_id: selectedDepartment || undefined,
          user_id: selectedUser || undefined,
        }),
      };

      const response = await recurringTaskService.getAll(params);
      const body = response.data;
      const list  = body.data?.data ?? [];
      const total = body.data?.total ?? (Array.isArray(list) ? list.length : 0);

      setTasks(Array.isArray(list) ? list : []);
      setTotalItems(total);

      if (body.data?.stats) {
        setStats({
          total:    body.data.stats.total    || total,
          active:   body.data.stats.active   || 0,
          inactive: body.data.stats.inactive || 0,
          today:    body.data.stats.today    || 0,
        });
      } else {
        const activeCount   = list.filter(t => t.is_active === 1).length;
        const inactiveCount = list.filter(t => t.is_active === 0).length;
        const todayCount    = list.filter(t =>
          new Date(t.created_at).toDateString() === new Date().toDateString()
        ).length;
        setStats({ total, active: activeCount, inactive: inactiveCount, today: todayCount });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load recurring tasks");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter, sortKey, sortDir, selectedDepartment, selectedUser]);

  // ── FETCH trigger: Once selectedUser is ready ──────────────
  useEffect(() => {
    // Wait for selectedUser to be set for Admin/SuperAdmin
    if ((isAdmin || isSuperAdmin) && !isManuallyCleared.current && !selectedUser) return;
    
    fetchTasks();
  }, [fetchTasks]);

  // This useEffect has a problem:
  useEffect(() => {
    if (isAdmin || isSuperAdmin) {
      setSelectedUser(currentUser.id);  // setting value
    }
    isInitialized.current = true;
  }, []);

  // ── Clear selected user (fetch data for all users) ───────────────────
  const clearSelectedUser = () => {
    isManuallyCleared.current = true;
    setSelectedUser(null);
  };

  // ── Reset ─────────────────────────────────────────────────────────
  const handleReset = () => {
    setSearch("");
    setStatusFilter("All");
    setPage(1);
    setSortKey("recurring_id");
    setSortDir("asc");
    setSelectedDepartment(null);
    isManuallyCleared.current = true;
    setSelectedUser(null);
  };

  // ── Sorting ──────────────────────────────────────────────────────────────
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const SortIcon = ({ k }) => (
    <span className={`ml-1 text-[10px] ${sortKey === k ? "text-indigo-500" : "text-slate-300"}`}>
      {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  // ── Selection ─────────────────────────────────────────────────────────────
  const allSelected = tasks.length > 0 && tasks.every(t => selected.includes(t.recurring_id));
  const toggleAll = () => setSelected(allSelected ? selected.filter(id => !tasks.find(t => t.recurring_id === id)) : [...new Set([...selected, ...tasks.map(t => t.recurring_id)])]);
  const toggleOne = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  // ── Bulk Delete ──────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.length} selected recurring tasks?`)) return;
    try {
      await Promise.all(selected.map(id => recurringTaskService.delete(id)));
      toast.success(`${selected.length} recurring tasks deleted`);
      setSelected([]);
      fetchTasks();
    } catch { toast.error("Some deletions failed"); }
  };

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  const HEADERS = [
  ["#", "index"],
  ["Task Title", "title"],
  ["Recurrence", "recurrence"],   // now shows daily/weekly/monthly/yearly info
  ["Next Occurrence", "next_occurrence"], 
  ["End Date", "end_date"], 
  ["Active", "is_active"],
  ["Created At", "created_at"]];

  const parseWeekdays = (str) => {
    try { return JSON.parse(str || "[]").map(d => ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][d-1]).join(", "); }
    catch { return ""; }
  };

  // ── Toggle Active Status ─────────────────────────────────────────────────
  const handleToggle = async (recurringId) => {
    try {
      const response = await taskService.toggleStatus(recurringId);
      setTasks(prev => prev.map(t => t.recurring_id === recurringId ? { ...t, is_active: response.data.is_active } : t));
    } catch (error) {
      console.error("Toggle failed:", error);
      toast.error("Failed to toggle status");
    }
  };

  // ── Clone Task ──────────────────────────────────────────────────────────
  const handleClone = (task) => {
    const clonedTask = { ...task, status: "pending", completed_at: null, task_type: task.task_type === "self" ? "self" : "assigned" };
    setCloneTask(clonedTask);
    clonedTask.task_type === "self" ? setSelfModal(true) : setModalOpen(true);
  };

  // ── Edit Task ───────────────────────────────────────────────────────────
  const handleEditTask = async (task) => {
    try {
      // const res = await taskService.getById(task.task_id);
      // const data = res.data?.data;
      // if (!data) { toast.error("Task not found"); return; }
      setEditTask(task);
      task.task_type === "self" ? setSelfModal(true) : setModalOpen(true);
      // data.task_type === "self" ? setSelfModal(true) : setModalOpen(true);
    } catch (error) { console.error(error); toast.error("Failed to fetch task"); }
  };

  const handleDelete = (task) => setDeleteTask({ ...task, id: task.recurring_id });

  // ── JSX ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="p-4 md:p-6 bg-slate-100 min-h-screen">

        {/* Filters */}
        <ReportFilters
          currentUser={currentUser}
          departmentsLists={departmentsLists} 
          filteredUsers={filteredUsers}          
          teamMemberOptions={filteredUsers}      
          selectedDepartment={selectedDepartment}
          selectedUser={selectedUser} // now comes from the hook
          showTeamMemberDropdown={isAdmin || isSuperAdmin}
          showDepartmentDropdown={false}
          onDepartmentChange={(id) => { setSelectedDepartment(id); setPage(1); }}
          onUserChange={(id) => { setSelectedUser(id); setPage(1); }}
          onClearAll={() => clearFilters(() => {setPage(1); clearSelectedUser();})}
          title="Recurring Tasks"
          teamTitle="All Member"
          description="Recurring Task Management"
        />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard label="Total" value={stats.total} icon={Check} iconBg="bg-indigo-50" iconText="text-indigo-600" borderColor="border-indigo-100"/>
          <StatCard label="Active" value={stats.active} icon={Check} iconBg="bg-emerald-50" iconText="text-emerald-600" borderColor="border-emerald-100"/>
          <StatCard label="Inactive" value={stats.inactive} icon={Clock} iconBg="bg-amber-50" iconText="text-amber-600" borderColor="border-amber-100"/>
          <StatCard label="Created Today" value={stats.today} icon={Calendar} iconBg="bg-sky-50" iconText="text-sky-600" borderColor="border-sky-100"/>
        </div>

        {/* Toolbar */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm mb-4">
          <div className="px-5 py-4 border-b border-slate-100 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px] max-w-sm">
                <SearchBar value={search} onChange={val => { setSearch(val); setPage(1); }} placeholder="Search recurring tasks…"/>
              </div>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <FilterButtonsRecurrence onRefresh={fetchTasks} onReset={handleReset} accentColor="indigo"/>
                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <button onClick={() => handleViewMode("table")} className={`px-3 py-2.5 transition-all ${viewMode==="table"?"bg-indigo-600 text-white":"text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`} title="Table view"><List size={15}/></button>
                  <div className="w-px h-5 bg-slate-200"/>
                  <button onClick={() => handleViewMode("card")} className={`px-3 py-2.5 transition-all ${viewMode==="card"?"bg-indigo-600 text-white":"text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`} title="Card view"><LayoutGrid size={15}/></button>
                </div>
              </div>
            </div>

            <BulkActionBar count={selected.length} onBulkDelete={handleBulkDelete} onClearSelection={() => setSelected([])} accentColor="indigo" entity="recurring_tasks"/>
          </div>
        </div>

        {/* Table View */}
        {viewMode==="table" && (
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="px-4 py-3.5 w-10 sticky left-0 z-30 bg-slate-50">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 rounded border-slate-300 accent-indigo-600 cursor-pointer"/>
                  </th>
                  {HEADERS.map(([label,key],i)=>(
                    <th key={key} onClick={()=>toggleSort(key)} className={`px-4 py-3.5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer select-none whitespace-nowrap hover:text-slate-600 transition-colors ${i===0?"sticky left-[52px] z-30 bg-slate-50 border-r border-slate-200":"bg-slate-50"}`}>
                      {label}<SortIcon k={key}/>
                    </th>
                  ))}
                  <th className="px-4 py-3.5 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest sticky right-0 z-30 bg-slate-50 border-l border-slate-200">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? <tr><td colSpan={HEADERS.length+2} className="py-4 text-center">Loading...</td></tr>
                         : tasks.length===0 ? <tr><td colSpan={HEADERS.length+2} className="py-20 text-center text-slate-400">No recurring tasks found</td></tr>
                         : tasks.map((task,i)=>(
                            <RecurringTaskTableRow key={task.recurring_id} task={task} index={(page-1)*pageSize+i+1} isSelected={selected.includes(task.recurring_id)}
                              onToggle={toggleOne} onEdit={handleEditTask} onClone={handleClone} onDelete={handleDelete} parseWeekdays={parseWeekdays} handleToggle={handleToggle}/>
                         ))
                }
              </tbody>
            </table>
          </div>
        )}

        {/* Card View */}
        {viewMode==="card" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-4">
            {loading ? Array.from({length:8}).map((_,i)=><div key={i} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 animate-pulse"/>)
                     : tasks.map(task => <RecurringTaskCard key={task.recurring_id} task={task} isSelected={selected.includes(task.recurring_id)}
                         onToggle={toggleOne} onEdit={t=>{setEditTask(t); setModalOpen(true)}} onDelete={handleDelete} parseWeekdays={parseWeekdays}/>)}
          </div>
        )}

        {!loading && <Pagination page={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalItems} onPageChange={p=>setPage(p)} onPageSizeChange={s=>{setPageSize(s); setPage(1);}}/>}

        <DeleteModal item={deleteTask} onClose={()=>setDeleteTask(null)} onSuccess={fetchTasks} service={recurringTaskService} entityLabel="Recurring Task"/>
      </div>

      <RecurringTaskModal
        open={modalOpen || selfModal || !!cloneTask}
        onClose={()=>{ setModalOpen(false); setSelfModal(false); setCloneTask(null); }}
        onSuccess={()=>{ setModalOpen(false); setSelfModal(false); setCloneTask(null); fetchTasks(); }}
        editTask={cloneTask || editTask}
        taskType={(cloneTask || editTask)?.task_type ?? "assigned"}
        currentUser={currentUser}
      />
    </>
  );
}

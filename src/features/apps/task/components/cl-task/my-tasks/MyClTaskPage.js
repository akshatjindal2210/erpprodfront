"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Calendar, History, ArrowRight, Clock, AlertCircle, Inbox } from "lucide-react";
import { toast } from "react-toastify";
import { clTaskService } from "@/features/apps/task/services/clTaskApi";
import { stripHtml } from "@/features/apps/task/helpers/clTaskFormHelper";
import { canSubmitPreviousTask, getISTTimeLabel } from "@/features/apps/task/helpers/clTaskTimeHelper";
import { useViewMode } from "@/features/apps/task/hooks/useViewMode";
import MyClTaskPanel from "./MyClTaskPanel";
import ClTaskSubmitModal from "./ClTaskSubmitModal";

const TABS = [
  { key: "today", label: "Today", icon: Calendar },
  { key: "previous", label: "Previous", icon: History },
  { key: "future", label: "Upcoming", icon: ArrowRight },
];

function filterTasks(tasks, search) {
  if (!search.trim()) return tasks;
  const q = search.toLowerCase();
  return tasks.filter((t) => {
    const desc = stripHtml(t.description) || stripHtml(t.sop_description) || "";
    return t.title?.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
  });
}

export default function MyClTaskPage() {
  const [tab, setTab] = useState("today");
  const [dueTasks, setDueTasks] = useState([]);
  const [openTasks, setOpenTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loadingDue, setLoadingDue] = useState(true);
  const [loadingAll, setLoadingAll] = useState(true);
  const [canSubmitPrev, setCanSubmitPrev] = useState(true);
  const [submitTask, setSubmitTask] = useState(null);

  const [searchDue, setSearchDue] = useState("");
  const [searchOpen, setSearchOpen] = useState("");
  const [searchAll, setSearchAll] = useState("");

  const [viewMode, handleViewMode] = useViewMode("card");

  const fetchPanels = useCallback(async () => {
    setLoadingDue(true);
    try {
      const [dueRes, openRes, statsRes] = await Promise.all([
        clTaskService.getMy({ panel: "due", limit: 50 }),
        clTaskService.getMy({ panel: "open", limit: 50 }),
        clTaskService.getMy({ tab: "today", limit: 1 }),
      ]);
      setDueTasks(dueRes.data?.data?.data ?? []);
      setOpenTasks(openRes.data?.data?.data ?? []);
      const body = statsRes.data?.data;
      setCanSubmitPrev(body?.can_submit_previous ?? canSubmitPreviousTask());
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load tasks");
    } finally {
      setLoadingDue(false);
    }
  }, []);

  const fetchAllTasks = useCallback(async () => {
    setLoadingAll(true);
    try {
      const res = await clTaskService.getMy({ tab, limit: 50 });
      setAllTasks(res.data?.data?.data ?? []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load tasks");
    } finally {
      setLoadingAll(false);
    }
  }, [tab]);

  const refreshAll = useCallback(() => {
    fetchPanels();
    fetchAllTasks();
  }, [fetchPanels, fetchAllTasks]);

  useEffect(() => { fetchPanels(); }, [fetchPanels]);
  useEffect(() => { fetchAllTasks(); }, [fetchAllTasks]);

  const filteredDue = useMemo(() => filterTasks(dueTasks, searchDue), [dueTasks, searchDue]);
  const filteredOpen = useMemo(() => filterTasks(openTasks, searchOpen), [openTasks, searchOpen]);
  const filteredAll = useMemo(() => filterTasks(allTasks, searchAll), [allTasks, searchAll]);

  const allTasksAlert =
    tab === "previous" && !canSubmitPrev ? (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
        <AlertCircle size={16} />
        Previous tasks — complete before <strong className="mx-1">11:00 AM</strong> (IST: {getISTTimeLabel()})
      </div>
    ) : null;

  return (
    <div className="p-4 md:p-6 bg-slate-100 min-h-screen text-slate-800">
      {/* Header — title only, like admin top row */}
      <div className="mb-6">
        <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
          <span>Dashboard</span>
          <span>/</span>
          <span className="font-medium text-slate-500">CL Task</span>
          <span>/</span>
          <span className="font-medium text-slate-500">My Tasks</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">My CL Tasks</h1>
      </div>

      <MyClTaskPanel
        title="Due Today"
        icon={Clock}
        iconClass="text-amber-500"
        count={dueTasks.length}
        countClass="bg-amber-100 text-amber-700"
        search={searchDue}
        onSearchChange={setSearchDue}
        onRefresh={fetchPanels}
        onReset={() => setSearchDue("")}
        hasFilter={!!searchDue.trim()}
        viewMode={viewMode}
        onViewModeChange={handleViewMode}
        loading={loadingDue}
        tasks={filteredDue}
        variant="due"
        tab="today"
        onSubmit={setSubmitTask}
        emptyMessage="No tasks due today — you're all caught up!"
        tableHeight="h-[400px]"
      />

      <MyClTaskPanel
        title="Open Tasks"
        icon={Inbox}
        iconClass="text-indigo-500"
        count={openTasks.length}
        countClass="bg-indigo-100 text-indigo-700"
        subtitle="Submitted or sent back — stays here until completed"
        search={searchOpen}
        onSearchChange={setSearchOpen}
        onRefresh={fetchPanels}
        onReset={() => setSearchOpen("")}
        hasFilter={!!searchOpen.trim()}
        viewMode={viewMode}
        onViewModeChange={handleViewMode}
        loading={loadingDue}
        tasks={filteredOpen}
        variant="open"
        tab="today"
        onSubmit={setSubmitTask}
        emptyMessage="No open tasks"
        tableHeight="h-[400px]"
      />

      <MyClTaskPanel
        title="All Tasks"
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
        alert={allTasksAlert}
        search={searchAll}
        onSearchChange={setSearchAll}
        onRefresh={refreshAll}
        onReset={() => { setSearchAll(""); setTab("today"); }}
        hasFilter={!!searchAll.trim()}
        viewMode={viewMode}
        onViewModeChange={handleViewMode}
        loading={loadingAll}
        tasks={filteredAll}
        variant="all"
        tab={tab}
        onSubmit={setSubmitTask}
        emptyMessage="No tasks in this category"
        tableHeight="h-[480px]"
        className="mb-0"
      />

      <ClTaskSubmitModal
        task={submitTask}
        onClose={() => setSubmitTask(null)}
        onSuccess={() => {
          setSubmitTask(null);
          refreshAll();
        }}
      />
    </div>
  );
}

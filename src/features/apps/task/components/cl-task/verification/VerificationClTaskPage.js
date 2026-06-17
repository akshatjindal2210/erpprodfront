"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { LayoutGrid, List, Loader2, Minimize2, Maximize2 } from "lucide-react";
import { toast } from "react-toastify";
import { useCanAccess } from "@/core/hooks/useCanAccess";
import {
  SearchBar,
  FilterButtonsRecurrence,
  EmptyState,
} from "@/features/apps/task/common";
import { clTaskService } from "@/features/apps/task/services/clTaskApi";
import { stripHtml } from "@/features/apps/task/helpers/clTaskFormHelper";
import { useViewMode } from "@/features/apps/task/hooks/useViewMode";
import VerificationClTaskCard from "./VerificationClTaskCard";
import VerificationClTaskTableRow from "./VerificationClTaskTableRow";
import VerifyClTaskModal from "./VerifyClTaskModal";

const TABLE_COLS = ["#", "Title", "Type", "Person", "Department", "Scheduled", "Submitted", "Wattage", "Scoring"];

export default function VerificationClTaskPage() {
  const canAccess = useCanAccess();
  const canView = canAccess("cl_task_verification", "view").allowed;
  const canVerify = canAccess("cl_task_verification", "authorize").allowed
    || canAccess("cl_task_verification", "edit").allowed;

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifyTask, setVerifyTask] = useState(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, handleViewMode] = useViewMode("table");

  const tableContainerRef = useRef(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!canView) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await clTaskService.getVerification({ limit: 200 });
      setTasks(res.data?.data?.data ?? []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load verification tasks");
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const handler = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.toLowerCase();
    return tasks.filter((t) => {
      const desc = stripHtml(t.description) || stripHtml(t.sop_description) || "";
      return (
        t.title?.toLowerCase().includes(q) ||
        t.person_name?.toLowerCase().includes(q) ||
        t.department_name?.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q)
      );
    });
  }, [tasks, search]);

  const handleReset = () => setSearch("");

  const toggleFullScreen = () => {
    if (!isFullScreen) tableContainerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const hasFilter = !!search.trim();

  const handleVerify = async (task, payload) => {
    setSaving(true);
    try {
      await clTaskService.verify(task.instance_id, payload);
      toast.success(
        payload.action === "approve"
          ? `Task approved${payload.score ? ` · Score ${payload.score}/10` : ""}`
          : "Task rejected — sent back to person",
      );
      setVerifyTask(null);
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || "Verification failed");
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p className="font-medium">You do not have permission to view CL Verification.</p>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 md:p-6 bg-slate-100 min-h-screen text-slate-800">
        <div className="mb-6">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-400">
            <span>Dashboard</span>
            <span>/</span>
            <span className="font-medium text-slate-500">CL Task</span>
            <span>/</span>
            <span className="font-medium text-slate-500">Verification</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">CL Verification</h1>
        </div>

        <div
          ref={tableContainerRef}
          className={`bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col transition-all duration-300 ${
            isFullScreen ? "fixed inset-0 z-[999] rounded-none h-screen w-screen" : ""
          }`}
        >
          <div className={`flex flex-col overflow-hidden ${isFullScreen ? "h-full" : ""}`}>
            <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0 bg-white z-[10]">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <SearchBar
                    value={search}
                    onChange={setSearch}
                    placeholder="Search by title, person, description…"
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

            {viewMode === "table" ? (
              <div
                className={
                  isFullScreen
                    ? "flex-1 min-h-0 overflow-auto border-t border-slate-100"
                    : "overflow-auto border-t border-slate-100 h-[550px]"
                }
              >
                <table className="w-full text-sm min-w-[1050px] border-separate border-spacing-0">
                  <thead className="sticky top-0 z-[5] shadow-sm">
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="w-1 p-0 sticky left-0 z-[5] bg-slate-50 border-b border-slate-200" />
                      {TABLE_COLS.map((label, i) => (
                        <th
                          key={label}
                          className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap border-b border-slate-200 ${
                            i === 0
                              ? "sticky left-[5px] z-[5] bg-slate-50 border-r"
                              : i === 1
                                ? "sticky left-[42px] z-[5] bg-slate-50 border-r min-w-[160px]"
                                : "bg-slate-50"
                          }`}
                        >
                          {label}
                        </th>
                      ))}
                      <th className="px-3 py-3 w-24 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider sticky right-0 z-[5] bg-slate-50 border-l border-slate-200 border-b">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={TABLE_COLS.length + 2} className="py-16 text-center text-slate-400">
                          <Loader2 size={28} className="mx-auto mb-2 animate-spin opacity-40" />
                          <p className="text-sm">Loading verification tasks…</p>
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={TABLE_COLS.length + 2} className="py-16 text-center">
                          <EmptyState
                            activeTab=""
                            hasFilter={hasFilter}
                            onReset={handleReset}
                          />
                        </td>
                      </tr>
                    ) : (
                      filtered.map((task, i) => (
                        <VerificationClTaskTableRow
                          key={task.instance_id}
                          task={task}
                          index={i + 1}
                          onVerify={canVerify ? setVerifyTask : undefined}
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
                    <p className="text-sm">Loading verification tasks…</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 text-center">
                    <EmptyState activeTab="" hasFilter={hasFilter} onReset={handleReset} />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map((task) => (
                      <VerificationClTaskCard key={task.instance_id} task={task} onVerify={canVerify ? setVerifyTask : undefined} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <VerifyClTaskModal
        task={verifyTask}
        onClose={() => setVerifyTask(null)}
        onVerify={handleVerify}
        saving={saving}
      />
    </>
  );
}

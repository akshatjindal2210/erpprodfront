"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, ChevronDown, ChevronRight, BarChart3 } from "lucide-react";
import { toast } from "react-toastify";
import { reportPanelService, defaultReportDateRange } from "@/features/apps/task/services/reportApi";
import TaskReportFormModal from "./TaskReportFormModal";

function rowClass(task) {
  if (task.is_red_flag) return "bg-rose-100 border-rose-200 text-rose-900";
  if (task.done_verified) return "bg-emerald-50 border-emerald-100 text-emerald-900";
  if (task.not_done) return "bg-rose-50 border-rose-200 text-rose-800";
  return "bg-white border-slate-100 text-slate-700";
}

export default function ReportDayView({ filters }) {
  const defaults = defaultReportDateRange();
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [openDays, setOpenDays] = useState({});
  const [selectedTask, setSelectedTask] = useState(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportPanelService.getDaily({
        date_from: dateFrom,
        date_to: dateTo,
        department_id: filters?.selectedDepartment || undefined,
        designation_id: filters?.selectedDesignation || undefined,
        person_id: filters?.selectedPerson || undefined,
        search: filters?.search || undefined,
      });
      const payload = res.data?.data;
      setData(payload);
      const open = {};
      (payload?.days ?? []).forEach((d) => { open[d.date] = true; });
      setOpenDays(open);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load CL task report");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, filters]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const summary = data?.summary;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 block border border-slate-200 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-500">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 block border border-slate-200 rounded-xl px-3 py-2 text-sm" />
        </div>
        <button type="button" onClick={fetchReport}
          className="px-4 py-2 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
          Apply
        </button>
        <p className="text-[11px] text-slate-400 ml-auto">Default: last 7 days</p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total Tasks", value: summary.total_tasks, cls: "bg-slate-50 text-slate-700" },
            { label: "Done & Verified", value: summary.done_verified, cls: "bg-emerald-50 text-emerald-700" },
            { label: "Not Done", value: summary.not_done, cls: "bg-rose-50 text-rose-700" },
            { label: "Task Score", value: summary.compiled_task_score, cls: "bg-sky-50 text-sky-700" },
            { label: "Net MIS Score", value: summary.net_score, cls: "bg-indigo-50 text-indigo-700" },
          ].map(({ label, value, cls }) => (
            <div key={label} className={`rounded-xl border border-slate-100 p-3 ${cls}`}>
              <p className="text-[10px] font-bold uppercase opacity-70">{label}</p>
              <p className="text-xl font-bold mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-indigo-500" />
            <span className="text-sm font-semibold text-slate-700">Day-wise CL Task Report</span>
          </div>
          <div className="flex flex-wrap gap-3 text-[10px] font-medium text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-100 border border-emerald-200" /> Done & verified</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-50 border border-rose-200" /> Not done</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-100 border border-rose-300" /> Red flag</span>
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-slate-300" size={28} /></div>
        ) : !(data?.days?.length) ? (
          <p className="py-12 text-center text-sm text-slate-400">No CL tasks in selected range</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.days.map((day) => (
              <div key={day.date}>
                <button type="button" onClick={() => setOpenDays((p) => ({ ...p, [day.date]: !p[day.date] }))}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left">
                  <div className="flex items-center gap-2 min-w-0">
                    {openDays[day.date] ? <ChevronDown size={16} className="shrink-0" /> : <ChevronRight size={16} className="shrink-0" />}
                    <span className="font-semibold text-slate-800">{day.date}</span>
                    <span className="text-xs text-slate-400">({day.tasks.length} tasks)</span>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 shrink-0">Day score: {day.day_score}</span>
                </button>
                {openDays[day.date] && (
                  <div className="px-3 sm:px-4 pb-3 space-y-2">
                    {day.tasks.map((task) => (
                      <button
                        key={task.instance_id}
                        type="button"
                        onClick={() => setSelectedTask(task)}
                        className={`w-full text-left border rounded-xl px-3 py-2.5 transition-colors hover:brightness-95 ${rowClass(task)}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{task.title}</p>
                            <p className="text-[11px] opacity-80">{task.person_name} · {task.department_name ?? "—"}</p>
                          </div>
                          <div className="text-left sm:text-right shrink-0">
                            <p className="text-xs font-bold">Score: {task.effective_score}</p>
                            <p className="text-[10px] capitalize opacity-70">
                              {task.done_verified ? "Done ✓" : task.not_done ? "Not done" : task.status}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <TaskReportFormModal
        open={!!selectedTask}
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onSaved={fetchReport}
      />
    </div>
  );
}

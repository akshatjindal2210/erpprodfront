"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, Clock, Calendar, RefreshCw, ChevronRight, AlertCircle } from "lucide-react";
import reminderService from "@/apps/task/lib/services/reminderApi";
import { formatDateTime, maskTaskId } from "@/apps/task/lib/helpers/utilHelper";

const PRIORITY_BADGE = {
  high:   "bg-rose-50 text-rose-600 border-rose-200",
  medium: "bg-amber-50 text-amber-600 border-amber-200",
  low:    "bg-slate-50 text-slate-500 border-slate-200",
};

const PRIORITY_DOT = {
  high: "bg-rose-500", medium: "bg-amber-400", low: "bg-slate-400",
};

const STATUS_BADGE = {
  pending:     "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  on_hold:     "bg-orange-50 text-orange-700 border-orange-200",
  overdue:     "bg-rose-50 text-rose-700 border-rose-200",
};

function Sk({ className = "" }) {
  return <div className={`animate-pulse bg-slate-200 rounded-lg ${className}`} />;
}

export default function RemindersPage() {
  const router   = useRouter();
  const [reminders, setReminders] = useState([]);
  const [loading,   setLoading]   = useState(true);

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const res = await reminderService.getAll();
      setReminders(res.data?.data ?? []);
    } catch {
      setReminders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReminders(); }, []);

  // Group by date
  const grouped = reminders.reduce((acc, r) => {
    const date = new Date(r.reminder_date).toLocaleDateString("en-IN", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(r);
    return acc;
  }, {});

  const isToday = (dateStr) => {
    const d = new Date(dateStr);
    const t = new Date();
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  };

  const isTomorrow = (dateStr) => {
    const d = new Date(dateStr);
    const t = new Date();
    t.setDate(t.getDate() + 1);
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  };

  const getDateLabel = (reminder_date) => {
    if (isToday(reminder_date))    return { label: "Today",    color: "bg-rose-500" };
    if (isTomorrow(reminder_date)) return { label: "Tomorrow", color: "bg-amber-500" };
    return null;
  };

  return (
    <div className="p-4 md:p-6 bg-slate-100 min-h-screen">

      {/* ── Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <span>Dashboard</span><span>/</span>
            <span className="text-slate-500 font-medium">Reminders</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Bell size={20} className="text-amber-500" />
            Upcoming Reminders
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Tasks with reminders in the next 7 days</p>
        </div>
        <button onClick={fetchReminders} disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 rounded-xl transition-all disabled:opacity-50 shadow-sm">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ── Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total",    value: reminders.length,                                         color: "text-indigo-600", bg: "bg-indigo-50",  border: "border-indigo-100" },
          { label: "Today",    value: reminders.filter(r => isToday(r.reminder_date)).length,    color: "text-rose-600",   bg: "bg-rose-50",    border: "border-rose-100"   },
          { label: "Tomorrow", value: reminders.filter(r => isTomorrow(r.reminder_date)).length, color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-100"  },
        ].map(({ label, value, color, bg, border }) => (
          <div key={label} className={`bg-white border ${border} rounded-2xl p-4 shadow-sm flex items-center gap-3`}>
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <Bell size={16} className={color} />
            </div>
            <div>
              <div className={`text-2xl font-bold ${color}`}>{loading ? "—" : value}</div>
              <div className="text-xs text-slate-400">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
              <Sk className="h-4 w-32" />
              <Sk className="h-16 w-full" />
              <Sk className="h-16 w-full" />
            </div>
          ))}
        </div>
      ) : reminders.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-16 flex flex-col items-center text-slate-400">
          <Bell size={40} className="opacity-20 mb-3" />
          <p className="text-sm font-medium">No upcoming reminders</p>
          <p className="text-xs mt-1">All clear for the next 7 days!</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              {/* Date header */}
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={13} className="text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{dateLabel}</span>
                <span className="text-xs text-slate-300 ml-1">({items.length})</span>
                <div className="flex-1 h-px bg-slate-200 ml-2" />
              </div>

              {/* Reminder cards */}
              <div className="space-y-2">
                {items.map((r) => {
                  const badge = getDateLabel(r.reminder_date);
                  return (
                    <div key={r.id}
                      onClick={() => router.push(`/task/dashboard/tasks/${r.id}`)}
                      // onClick={() => {
                      //   const masked = maskTaskId(r.id);
                      //   router.push(`/task/dashboard/tasks/${masked}`);
                      // }}
                      className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-amber-200 transition-all cursor-pointer group">
                      <div className="flex items-start gap-3">

                        {/* Priority dot */}
                        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${PRIORITY_DOT[r.priority] ?? "bg-slate-400"}`} />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-sm font-semibold text-slate-700 group-hover:text-amber-700 transition-colors line-clamp-1">
                              {r.title}
                            </p>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {badge && (
                                <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${badge.color}`}>
                                  {badge.label}
                                </span>
                              )}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize font-medium ${PRIORITY_BADGE[r.priority] ?? PRIORITY_BADGE.low}`}>
                                {r.priority}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${STATUS_BADGE[r.status] ?? ""}`}>
                                {r.status?.replace("_", " ")}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-[11px]">
                            {/* Reminder time */}
                            <div className="flex items-center gap-1 text-amber-600 font-medium">
                              <Bell size={10} />
                              {/* {new Date(r.reminder_date).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })} */}
                              {formatDateTime(r.reminder_date)}
                            </div>

                            {/* Due date */}
                            {r.due_date && (
                              <div className="flex items-center gap-1 text-slate-400">
                                <Clock size={10} />
                                Due: {new Date(r.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              </div>
                            )}

                            {/* Assigned to */}
                            {r.assigned_to && (
                              <div className="flex items-center gap-1 text-slate-400">
                                <span>👤</span>
                                {r.assigned_to}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Arrow */}
                        <ChevronRight size={15} className="text-slate-300 group-hover:text-amber-400 flex-shrink-0 mt-0.5 transition-colors" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";
import { CheckSquare, Bell, Clock } from "lucide-react";
import { PRIORITY_BADGE, STATUS_BADGE_DASHBOARD } from "@/apps/task/lib/ui/common/Constants";
import Sk from "./Skeleton";
import SectionHeader from "./SectionHeader";

export default function UserAssignedTasks({ assignedTasks, reminders, loading }) {
  return (
    <div className="grid grid-cols-12 gap-4">

      {/* Assigned Tasks Table */}
      <div className="col-span-12 lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <CheckSquare size={13} className="text-violet-500" />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">My Assigned Tasks</span>
          <span className="ml-auto text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full">
            {assignedTasks?.length} tasks
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["#", "Title", "Priority", "Status", "Due Date"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [1,2,3,4].map(i => (
                  <tr key={i}><td colSpan={5} className="px-3 py-3"><Sk className="h-3 w-full" /></td></tr>
                ))
              ) : assignedTasks?.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-slate-400">No tasks assigned</td></tr>
              ) : assignedTasks?.map((t, i) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 text-slate-400 font-mono">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-700 max-w-[160px] truncate">{t.title}</td>
                  <td className="px-3 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded-full border capitalize font-medium ${PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE.low}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`px-1.5 py-0.5 rounded-full border capitalize ${STATUS_BADGE_DASHBOARD[t.status] ?? ""}`}>
                      {t.status?.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                    {t.due_date ? new Date(t.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming Reminders */}
      <div className="col-span-12 lg:col-span-5 bg-white border border-amber-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
            <Bell size={13} className="text-amber-500" />
          </div>
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Upcoming Reminders</span>
          <span className="ml-auto text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full">
            7 days
          </span>
        </div>
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Sk key={i} className="h-14 w-full" />)}</div>
        ) : reminders?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 text-slate-400">
            <Bell size={26} className="opacity-20 mb-2" />
            <span className="text-xs">No upcoming reminders</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {reminders?.map((t) => (
              <div key={t.id} className="p-3 rounded-xl bg-amber-50 border border-amber-100 hover:border-amber-200 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-slate-700 line-clamp-1 flex-1">{t.title}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 font-medium ${PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE.low}`}>
                    {t.priority}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <Clock size={10} className="text-amber-500" />
                  <span className="text-[10px] text-amber-600 font-medium">
                    {new Date(t.reminder_date).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// components/task/dashboard/TasksAndUsersRow.jsx
// Top Tasks Table + Recent Users Feed — ek row
"use client";
import { Star, Activity, Users } from "lucide-react";
import { PRIORITY_BADGE, STATUS_BADGE_DASHBOARD } from "@/features/apps/task/components/common/Constants";
import Sk from "./Skeleton";

export default function TasksAndUsersRow({ topTasks, recentUsers, loading }) {
  return (
    <div className="grid grid-cols-12 gap-4">

      {/* Top Tasks Table */}
      <div className="col-span-12 lg:col-span-7 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Star size={13} className="text-violet-500" />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Top 10 Tasks</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["#", "Title", "Assigned", "Priority", "Status", "Due"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i}><td colSpan={6} className="px-3 py-3"><Sk className="h-3 w-full" /></td></tr>
                ))
              ) : topTasks.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-slate-400">No tasks found</td></tr>
              ) : topTasks.map((t, i) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 text-slate-400 font-mono">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-700 max-w-[150px] truncate">{t.title}</td>
                  <td className="px-3 py-2.5 text-slate-400">{t.assigned_to ?? "—"}</td>
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

      {/* Recent Users Feed */}
      <div className="col-span-12 lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={13} className="text-indigo-500" />
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Recently Added Users</span>
          <span className="ml-auto text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full">
            {recentUsers.length} shown
          </span>
        </div>
        {loading ? (
          <div className="space-y-3">{[1,2,3,4,5].map(i => <Sk key={i} className="h-12 w-full" />)}</div>
        ) : recentUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 text-slate-400">
            <Users size={26} className="opacity-20 mb-2" />
            <span className="text-xs">No recent users</span>
          </div>
        ) : (
          <div className="space-y-2">
            {recentUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <span className="text-xs font-bold text-white">{u.name?.[0]?.toUpperCase() ?? "?"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{u.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">@{u.username} · {u.department || "No dept"}</p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border capitalize font-medium ${STATUS_BADGE_DASHBOARD[u.status] ?? ""}`}>
                    {u.status}
                  </span>
                  <span className="text-[10px] text-slate-300">
                    {new Date(u.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
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

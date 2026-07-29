// components/task/dashboard/DeptAndRemindersRow.jsx
// Dept Bar Chart + User Status + Reminders — ek row
"use client";
import { Building2, Users, Bell } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { PRIORITY_BADGE, STATUS_BADGE_DASHBOARD } from "@/apps/task/lib/ui/common/Constants";
import Sk from "./Skeleton";
import SectionHeader from "./SectionHeader";

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default function DeptAndRemindersRow({ usersByDept, usersByStatus, reminderTasks, totalUsers, totalDepts, loading }) {
  const deptBarData = (usersByDept ?? []).map(d => ({
    name:  d.department?.length > 12 ? d.department.slice(0, 12) + "…" : d.department,
    users: Number(d.user_count),
  }));

  return (
    <div className="grid grid-cols-12 gap-4">

      {/* Dept Horizontal Bar */}
      <div className="col-span-12 lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <SectionHeader icon={Building2} color="text-blue-500" title="Users by Department" badge={`${totalDepts} depts`} />
        {loading ? <Sk className="h-44 w-full" /> : deptBarData.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-xs text-slate-400">No departments</div>
        ) : (
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={deptBarData} layout="vertical" barSize={12}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={75} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="users" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* User Status Progress Bars */}
      <div className="col-span-12 lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <SectionHeader icon={Users} color="text-indigo-500" title="User Status" />
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Sk key={i} className="h-8 w-full" />)}</div>
        ) : usersByStatus.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-xs text-slate-400">No data</div>
        ) : usersByStatus.map((s) => (
          <div key={s.status} className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-600 capitalize">{s.status}</span>
              <span className="text-xs text-slate-400">{s.count} ({pct(s.count, totalUsers)}%)</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${
                s.status === "active" ? "bg-emerald-500" :
                s.status === "suspended" ? "bg-rose-500" : "bg-slate-400"
              }`} style={{ width: `${pct(s.count, totalUsers)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Reminders */}
      <div className="col-span-12 lg:col-span-4 bg-white border border-amber-200 rounded-2xl p-4 shadow-sm">
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
        ) : reminderTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-36 text-slate-400">
            <Bell size={26} className="opacity-20 mb-2" />
            <span className="text-xs">No upcoming reminders</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
            {reminderTasks.map((t) => (
              <div key={t.id} className="p-3 rounded-xl bg-amber-50 border border-amber-100 hover:border-amber-200 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-xs font-semibold text-slate-700 line-clamp-1 flex-1">{t.title}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 font-medium ${PRIORITY_BADGE[t.priority] ?? PRIORITY_BADGE.low}`}>
                    {t.priority}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border capitalize ${STATUS_BADGE_DASHBOARD[t.status] ?? ""}`}>
                    {t.status?.replace("_", " ")}
                  </span>
                  <span className="text-[10px] text-amber-600 font-medium">
                    🔔 {new Date(t.reminder_date).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {t.assigned_to && <p className="text-[10px] text-slate-400 mt-1">👤 {t.assigned_to}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

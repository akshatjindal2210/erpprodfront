// components/task/dashboard/TaskChartRow.jsx
// Task Bar Chart + User Pie + Progress Rings — ek row
"use client";
import { ListTodo, Users, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { PIE_COLORS } from "@/apps/task/lib/ui/common/Constants";
import Sk from "./Skeleton";
import Ring from "./Ring";
import SectionHeader from "./SectionHeader";

export default function TaskChartRow({ tasks, userPieData, loading }) {
  const taskBarData = [
    { name: "Pending",  value: tasks.pending,    fill: "#f59e0b" },
    { name: "Active",   value: tasks.inProgress, fill: "#6366f1" },
    { name: "Done",     value: tasks.completed,  fill: "#10b981" },
    { name: "Hold",     value: tasks.onHold,     fill: "#f97316" },
    { name: "Overdue",  value: tasks.overdue,    fill: "#f43f5e" },
  ];

  return (
    <div className="grid grid-cols-12 gap-4">

      {/* Task Bar Chart */}
      <div className="col-span-12 lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <SectionHeader icon={ListTodo} color="text-violet-500" title="Task Status Breakdown" badge={`${tasks.total} total`} />
        {loading ? <Sk className="h-44 w-full" /> : (
          <ResponsiveContainer width="100%" height={170}>
            <BarChart data={taskBarData} barSize={30}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={20} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {taskBarData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* User Pie */}
      <div className="col-span-12 lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <SectionHeader icon={Users} color="text-indigo-500" title="User Distribution" />
        {loading ? <Sk className="h-44 w-full" /> : userPieData.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-xs text-slate-400">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={userPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={68}
                paddingAngle={3} dataKey="value">
                {userPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e8f0" }} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Progress Rings */}
      <div className="col-span-12 lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <SectionHeader icon={TrendingUp} color="text-emerald-500" title="Task Progress" />
        {loading ? (
          <div className="grid grid-cols-2 gap-3 mt-2">{[1,2,3,4].map(i => <Sk key={i} className="h-20" />)}</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 mt-1">
            <Ring value={tasks.completed}  max={tasks.total} color="#10b981" label="Completed"   />
            <Ring value={tasks.inProgress} max={tasks.total} color="#6366f1" label="In Progress" />
            <Ring value={tasks.pending}    max={tasks.total} color="#f59e0b" label="Pending"     />
            <Ring value={tasks.overdue}    max={tasks.total} color="#f43f5e" label="Overdue"     />
          </div>
        )}
        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-center">
          <div>
            <div className="text-sm font-bold text-rose-600">{tasks.highPriority}</div>
            <div className="text-[10px] text-slate-400">High Priority</div>
          </div>
          <div>
            <div className="text-sm font-bold text-teal-600">{tasks.completedToday}</div>
            <div className="text-[10px] text-slate-400">Done Today</div>
          </div>
          <div>
            <div className="text-sm font-bold text-orange-500">{tasks.onHold}</div>
            <div className="text-[10px] text-slate-400">On Hold</div>
          </div>
        </div>
      </div>

    </div>
  );
}

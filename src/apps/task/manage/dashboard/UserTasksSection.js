// components/task/dashboard/UserTasksSection.jsx
// User dashboard — Task stat cards
"use client";
import { ListTodo, Clock, CheckCircle, AlertOctagon, RefreshCw } from "lucide-react";
import StatCard from "./StatCard";

export default function UserTasksSection({ tasks, loading }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">My Tasks</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard loading={loading} label="Total Tasks"  value={tasks.total}          sub="All my tasks"         icon={ListTodo}    iconBg="bg-violet-50"  iconText="text-violet-600"  border="border-violet-100"  />
        <StatCard loading={loading} label="Pending"      value={tasks.pending}        sub="Not started"          icon={Clock}       iconBg="bg-amber-50"   iconText="text-amber-500"   border="border-amber-100"   />
        <StatCard loading={loading} label="Completed"    value={tasks.completed}      sub={`${tasks.completedToday} today`} icon={CheckCircle} iconBg="bg-emerald-50" iconText="text-emerald-600" border="border-emerald-100" />
        <StatCard loading={loading} label="Overdue"      value={tasks.overdue}        sub="Past due date"        icon={AlertOctagon}iconBg="bg-rose-50"    iconText="text-rose-600"    border="border-rose-100"    />
      </div>
    </div>
  );
}
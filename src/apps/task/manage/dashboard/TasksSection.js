// components/task/dashboard/TasksSection.jsx
"use client";
import { ListTodo, Clock, RefreshCw, CheckCircle, Pause, AlertOctagon, Star } from "lucide-react";
import StatCard from "./StatCard";

export default function TasksSection({ tasks, loading }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Tasks Overview</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard loading={loading} label="Total Tasks"  value={tasks.total}          sub="All tasks"               icon={ListTodo}    iconBg="bg-violet-50"  iconText="text-violet-600"  border="border-violet-100"  />
        <StatCard loading={loading} label="Pending"      value={tasks.pending}        sub="Not started"             icon={Clock}       iconBg="bg-amber-50"   iconText="text-amber-500"   border="border-amber-100"   />
        <StatCard loading={loading} label="In Progress"  value={tasks.inProgress}     sub="Currently active"        icon={RefreshCw}   iconBg="bg-blue-50"    iconText="text-blue-500"    border="border-blue-100"    />
        <StatCard loading={loading} label="Completed"    value={tasks.completed}      sub={`${tasks.completedToday} today`} icon={CheckCircle} iconBg="bg-emerald-50" iconText="text-emerald-600" border="border-emerald-100" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
        <StatCard loading={loading} label="On Hold"      value={tasks.onHold}         sub="Paused"                  icon={Pause}       iconBg="bg-orange-50"  iconText="text-orange-500"  border="border-orange-100"  />
        <StatCard loading={loading} label="Overdue"      value={tasks.overdue}        sub="Past due date"           icon={AlertOctagon}iconBg="bg-rose-50"    iconText="text-rose-600"    border="border-rose-100"    />
        <StatCard loading={loading} label="High Priority"value={tasks.highPriority}   sub="Needs attention"         icon={Star}        iconBg="bg-rose-50"    iconText="text-rose-500"    border="border-rose-100"    />
        <StatCard loading={loading} label="Done Today"   value={tasks.completedToday} sub="Today's progress"        icon={CheckCircle} iconBg="bg-teal-50"    iconText="text-teal-600"    border="border-teal-100"    />
      </div>
    </div>
  );
}
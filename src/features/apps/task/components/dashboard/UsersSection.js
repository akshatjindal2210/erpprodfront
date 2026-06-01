// components/task/dashboard/UsersSection.jsx
"use client";
import { Shield, UserCheck, UserX, AlertTriangle } from "lucide-react";
import StatCard from "./StatCard";

export default function UsersSection({ rootUsers, loading }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Users</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard loading={loading} label="Total Admins" value={rootUsers.total}     sub="All admin accounts" icon={Shield}        iconBg="bg-violet-50"  iconText="text-violet-600"  border="border-violet-100"  />
        <StatCard loading={loading} label="Active"       value={rootUsers.active}    sub="Currently enabled"  icon={UserCheck}     iconBg="bg-emerald-50" iconText="text-emerald-600" border="border-emerald-100" />
        <StatCard loading={loading} label="Inactive"     value={rootUsers.inactive}  sub="Access disabled"    icon={UserX}         iconBg="bg-slate-100"  iconText="text-slate-500"   border="border-slate-200"   />
        <StatCard loading={loading} label="Suspended"    value={rootUsers.suspended} sub="Requires review"    icon={AlertTriangle} iconBg="bg-rose-50"    iconText="text-rose-600"    border="border-rose-100"    />
      </div>
    </div>
  );
}
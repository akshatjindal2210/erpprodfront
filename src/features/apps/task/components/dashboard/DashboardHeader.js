// components/task/dashboard/DashboardHeader.jsx
"use client";
import { RefreshCw } from "lucide-react";

export default function DashboardHeader({ loading, lastSync, onRefresh, userRole }) {
  const getTitle = () => {
    switch (userRole?.toLowerCase()) {
      case "super_admin": return "Super Admin Dashboard";
      case "admin": return "Admin Dashboard";
      case "executive_assistant":
      case "team": return "Team Dashboard";
      default: return "User Dashboard";
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-0.5">
          <span>Dashboard</span><span>/</span>
          <span className="text-slate-500 font-medium">Overview</span>
        </div>
        <h1 className="text-xl font-bold text-slate-800 tracking-tight">{getTitle()}</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Last synced {lastSync.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 rounded-xl transition-all disabled:opacity-50 shadow-sm"
      >
        <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        {loading ? "Syncing…" : "Refresh"}
      </button>
    </div>
  );
}
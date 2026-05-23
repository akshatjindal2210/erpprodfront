import React from "react";
import { ChevronRight, Home, Calendar } from "lucide-react";

function PageHeading({ head1 = "Dashboard", head2 = "Users", head3 = "User Management" }) {
  
  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'short', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
          <div className="flex items-center gap-1">
            <Home size={12} className="opacity-70" />
            <span>{head1}</span>
          </div>
          <ChevronRight size={10} className="text-slate-300" />
          <span className="text-slate-600 font-medium">{head2}</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
          {head3}
        </h1>
      </div>

      <div className="hidden sm:flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
          <Calendar size={14} />
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">System Date</span>
          <span className="text-[11px] font-bold text-slate-700">{today}</span>
        </div>
      </div>
    </div>
  );
}

export default PageHeading;
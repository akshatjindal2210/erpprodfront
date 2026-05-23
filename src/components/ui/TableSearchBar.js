"use client";
import { Search, X } from "lucide-react";

export default function TableSearchBar({ value, onChange, placeholder = "Search…" }) {
  return (
    <div className="relative flex-1 w-full">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white border border-slate-300 rounded-none pl-9 pr-8 h-9 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-slate-500 transition-all"
      />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
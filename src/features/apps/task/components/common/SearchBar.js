import { Search, X } from "lucide-react";

export default function SearchBar({ value, onChange, placeholder = "Search…" }) {
  return (
    <div className="relative flex-1 min-w-0 max-w-md">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 bg-white border border-slate-300 rounded-none pl-8 pr-8 text-[12px] text-slate-700 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 transition-all"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
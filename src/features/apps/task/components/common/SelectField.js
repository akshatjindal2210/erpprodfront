import { ChevronDown } from "lucide-react";
import { useMemo } from "react";
import { sortStringsAsc } from "@/features/apps/task/helpers/sortOptions";

function SelectField({ label, value, onChange, options, placeholder, error, selectCls }) {

  const defaultStyles = "w-full appearance-none bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all pr-9";
  const errorStyles = "border-rose-300 bg-rose-50/30 text-rose-600 focus:border-rose-400 focus:ring-rose-100";

  const sortedOptions = useMemo(() => sortStringsAsc(options), [options]);

  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          // className={`${selectCls} ${error ? "border-rose-300 bg-rose-50/30" : ""}`}
          className={`${selectCls || defaultStyles} ${error ? errorStyles : ""}`}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {sortedOptions.map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

export default SelectField;
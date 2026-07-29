import { ChevronDown, AlertCircle } from "lucide-react";
import { sortFilterOptionsAsc } from "@/platform/utils/form/sortSelectOptions";

function SelectField({ label, value, onChange, options = [], labelMap, placeholder, error, selectCls, required, dataField, labelClassName, ...props }) {
  const sortedOptions = sortFilterOptionsAsc(options);
  
  const baseStyles = "w-full appearance-none bg-white border rounded-lg px-3 py-2 text-sm text-slate-800 outline-none transition-all pr-9 h-10 flex items-center";
  const stateStyles = error ? "border-rose-300 bg-rose-50/30 text-rose-600 focus:border-rose-400 focus:ring-2 focus:ring-rose-100" : "border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="relative w-full space-y-1" data-field={dataField || undefined}>
      
      {label && (
        <label className={labelClassName || "block text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-0.5"}>
          {label}
          {required && <span className="text-rose-500 ml-1 text-sm">*</span>}
        </label>
      )}
      
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          required={required}
          className={`${baseStyles} ${stateStyles} ${selectCls || ""}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled selected hidden={required}>{placeholder}
            </option>
          )}
          
          {sortedOptions.map((opt) => {
            const displayLabel = labelMap && labelMap[opt] ? labelMap[opt] : opt.toString().charAt(0).toUpperCase() + opt.toString().slice(1).toLowerCase();

            return (
              <option key={opt} value={opt}>
                {displayLabel}
              </option>
            );
          })}
        </select>
        
        <div className="absolute right-3 top-0 bottom-0 flex items-center pointer-events-none text-slate-400">
          <ChevronDown size={14} />
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-1 text-xs text-rose-500 mt-1">
          <AlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

export default SelectField;
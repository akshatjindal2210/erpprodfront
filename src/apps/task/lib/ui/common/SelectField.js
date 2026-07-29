import { ChevronDown } from "lucide-react";
import { useMemo } from "react";
import { sortStringsAsc } from "@/apps/task/lib/helpers/sortOptions";
import { OK_INPUT, ERR_INPUT, FORM_LABEL_CLASS } from "@/ui/common/Constants";

/** Native select — same h-9 / rounded-lg density as IMS SearchableSelect. */
function SelectField({ label, value, onChange, options, placeholder, error, selectCls }) {
  const defaultStyles = `${OK_INPUT} appearance-none pr-9`;
  const errorStyles = ERR_INPUT;

  const sortedOptions = useMemo(() => sortStringsAsc(options), [options]);

  return (
    <div className="space-y-1 w-full min-w-0">
      {label ? (
        <label className={`block ${FORM_LABEL_CLASS}`}>
          {label}
        </label>
      ) : null}
      <div className="relative w-full min-w-0">
        <select
          value={value}
          onChange={onChange}
          className={`${selectCls || defaultStyles} ${error ? errorStyles : ""}`}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {sortedOptions.map((o) => (
            <option key={o} value={o}>
              {o.charAt(0).toUpperCase() + o.slice(1)}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
      </div>
    </div>
  );
}

export default SelectField;

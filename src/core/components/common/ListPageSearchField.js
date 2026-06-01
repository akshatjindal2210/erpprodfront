"use client";

/** Matches list toolbar search styling used across DateRangeFilter and master pages. */
export const LIST_PAGE_SEARCH_LABEL_CLASS =
  "text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-tight italic";

export const LIST_PAGE_SEARCH_INPUT_CLASS =
  "w-full pl-3 pr-4 h-9 bg-white border border-slate-300 text-[12px] focus:outline-none focus:border-slate-500 transition-all rounded-none font-medium text-slate-700";

/** Default: capped width on standalone toolbars. Pass `w-full min-w-0` (e.g. from DateRangeFilter) when the field should grow/shrink inside a flex/grid row. */
export const LIST_PAGE_SEARCH_CONTAINER_CLASS =
  "w-full min-w-0 max-w-[16rem] space-y-1";

/**
 * Shared quick-filter text field for list pages (client-side filter as you type).
 */
export default function ListPageSearchField({
  label = "Search",
  placeholder = "Search...",
  value,
  onChange,
  className = "",
  containerClassName = LIST_PAGE_SEARCH_CONTAINER_CLASS,
  inputClassName = "",
  disabled = false,
}) {
  return (
    <div className={`${containerClassName} ${className}`.trim()}>
      <label className={LIST_PAGE_SEARCH_LABEL_CLASS}>{label}</label>
      <div className="relative group">
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`${LIST_PAGE_SEARCH_INPUT_CLASS} ${inputClassName}`.trim()}
        />
      </div>
    </div>
  );
}

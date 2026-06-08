"use client";

/** Shared label for list-page filter strip fields. */
export const LIST_PAGE_SEARCH_LABEL_CLASS =
  "text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-tight italic";

/**
 * Filter value / placeholder — compact 12px typography via globals.css
 * under `[data-list-page-filter-strip]`.
 */
export const LIST_PAGE_FILTER_VALUE_CLASS = "list-page-filter-value";
export const LIST_PAGE_FILTER_PLACEHOLDER_CLASS = "list-page-filter-placeholder";

/** Compact control shell — h-8 on phone, h-9 on desktop. */
export const LIST_PAGE_FILTER_BOX_CLASS =
  "list-page-filter-control h-8 md:h-9 w-full min-w-0 rounded-none border border-slate-300 bg-white px-2 md:px-3 transition-all focus-within:border-slate-500 focus:border-slate-500";

export const LIST_PAGE_FILTER_FIELD_WRAP_CLASS = "flex min-w-0 flex-col gap-0.5 md:gap-1";

/** Reset / Search row in DateRangeFilter. */
export const LIST_PAGE_FILTER_ACTION_BTN_CLASS =
  "flex h-8 md:h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-none px-2 md:px-3 text-[10px] md:text-[11px] font-bold uppercase tracking-wide transition-all active:scale-[0.98]";

export const LIST_PAGE_SEARCH_INPUT_CLASS = [
  "w-full min-w-0",
  LIST_PAGE_FILTER_BOX_CLASS,
  LIST_PAGE_FILTER_VALUE_CLASS,
  "placeholder:text-slate-400 focus:outline-none",
].join(" ");

/** Default: capped width on standalone toolbars. Pass `w-full min-w-0` (e.g. from DateRangeFilter) when the field should grow/shrink inside a flex/grid row. */
export const LIST_PAGE_SEARCH_CONTAINER_CLASS =
  "w-full min-w-0 max-w-[16rem] space-y-1";

/** Native `<select>` in filter strips — matches search/date field sizing and color. */
export const LIST_PAGE_FILTER_SELECT_CLASS = [
  LIST_PAGE_FILTER_BOX_CLASS,
  LIST_PAGE_FILTER_VALUE_CLASS,
  "cursor-pointer appearance-none outline-none pr-7 md:pr-8",
].join(" ");

/** Visible date text (DD/MM/YYYY). */
export function listPageFilterDisplayTextClass(hasValue) {
  return hasValue ? LIST_PAGE_FILTER_VALUE_CLASS : LIST_PAGE_FILTER_PLACEHOLDER_CLASS;
}

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

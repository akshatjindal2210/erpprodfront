"use client";
import { useState, useEffect } from "react";
import { RotateCcw, Send } from "lucide-react";
import FilterDateInput from "@/core/components/common/FilterDateInput";
import ListPageSearchField, {
  LIST_PAGE_SEARCH_LABEL_CLASS,
  LIST_PAGE_FILTER_SELECT_CLASS,
  LIST_PAGE_FILTER_FIELD_WRAP_CLASS,
  LIST_PAGE_FILTER_ACTION_BTN_CLASS,
} from "@/core/components/common/ListPageSearchField";
import { useMobileFilterStrip } from "@/core/components/common/ListPageFilterStrip";
import { sortFilterOptionsAsc } from "@/core/utils/sortSelectOptions";

export default function DateRangeFilter({
  fromDate: externalFromDate,
  toDate: externalToDate,
  onApply,
  onReset,
  showDate = true,
  extraFilters = [],
  /** When true with no date pickers: extra dropdowns apply on change and Reset/Search are hidden. */
  instantClientExtras = false,
  /** When true (with date pickers): extra dropdowns call onApply immediately on change. */
  applyExtrasOnChange = false,
  searchValue,
  onSearchChange,
  onSearchEnter,
  /** When false, Enter in the search field does not run Apply (client-side search only). */
  applyOnSearchEnter = true,
  searchPlaceholder = "Search...",
  searchLabel = "Search",
  minDate,
  maxDate,
  /** Extra dropdown keys rendered before From/To date (e.g. month). */
  extraFiltersBeforeDate = [],
  /** When true, date pickers are visible but not editable (e.g. journey search mode). */
  dateDisabled = false,
  /** Called when an extra dropdown value changes (before Search). */
  onExtraFilterChange,
}) {
  const [localFrom, setLocalFrom] = useState(externalFromDate || "");
  const [localTo, setLocalTo] = useState(externalToDate || "");
  const [localExtras, setLocalExtras] = useState({});
  const mobileFilterStrip = useMobileFilterStrip();

  const extraFilterCount = Array.isArray(extraFilters) ? extraFilters.length : 0;
  const showInstantExtras = Boolean(instantClientExtras && !showDate);
  /** Date ranges or server-backed extra filters keep Apply/Reset; client-only extras do not. */
  const showActionButtons = Boolean(showDate) || (extraFilterCount > 0 && !showInstantExtras);

  useEffect(() => {
    setLocalFrom((prev) => {
      const next = externalFromDate || "";
      return prev === next ? prev : next;
    });
    setLocalTo((prev) => {
      const next = externalToDate || "";
      return prev === next ? prev : next;
    });
  }, [externalFromDate, externalToDate]);

  useEffect(() => {
    if (!Array.isArray(extraFilters) || extraFilters.length === 0) return;
    setLocalExtras((prev) => {
      let changed = false;
      const next = { ...prev };
      extraFilters.forEach((f) => {
        if (f.type === "text" || !f.key) return;
        if (f.value !== undefined && f.value !== null && prev[f.key] !== f.value) {
          next[f.key] = f.value;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [extraFilters]);

  const handleApply = () => {
    onApply?.({ fromDate: localFrom, toDate: localTo, ...localExtras, searchSubmit: true });
    mobileFilterStrip?.collapseMobile?.();
  };

  const handleInternalReset = () => {
    setLocalFrom(externalFromDate || "");
    setLocalTo(externalToDate || "");
    setLocalExtras({});
    onReset?.();
    mobileFilterStrip?.collapseMobile?.();
  };

  /** Phone: 2 filters per row, tight spacing. */
  const filterGridClass =
    "grid w-full min-w-0 items-end gap-x-1.5 gap-y-1 max-md:grid-cols-2 md:gap-x-3 md:gap-y-2 md:[grid-template-columns:repeat(auto-fill,minmax(min(100%,11.25rem),1fr))]";

  const actionsLabelSpacer = (
    <span
      className={`${LIST_PAGE_SEARCH_LABEL_CLASS} max-md:hidden block min-h-[0.875rem] md:min-h-[1.125rem] shrink-0 select-none leading-tight opacity-0`}
      aria-hidden
    >
      {"\u00a0"}
    </span>
  );

  const beforeDateKeys = new Set((Array.isArray(extraFiltersBeforeDate) ? extraFiltersBeforeDate : []).map(String));
  const filtersBeforeDate = extraFilters.filter((f) => beforeDateKeys.has(f.key));
  const filtersAfterDate = extraFilters.filter((f) => !beforeDateKeys.has(f.key));

  const renderExtraFilter = (filter, index) =>
    filter.type === "text" ? (
      <div key={index} className="min-w-0">
        <ListPageSearchField
          label={filter.label}
          placeholder={filter.placeholder ?? ""}
          value={filter.value}
          onChange={filter.onChange}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              filter.onEnter?.();
              handleApply();
            }
          }}
          containerClassName="w-full min-w-0 space-y-0 md:space-y-1"
        />
      </div>
    ) : (
      <div key={index} className={LIST_PAGE_FILTER_FIELD_WRAP_CLASS}>
        <label className={`${LIST_PAGE_SEARCH_LABEL_CLASS} max-md:hidden`}>{filter.label}</label>
        <select
          value={localExtras[filter.key] ?? filter.value ?? ""}
          disabled={Boolean(filter.disabled)}
          onChange={(e) => {
            if (filter.disabled) return;
            const v = e.target.value;
            const nextExtras = { ...localExtras, [filter.key]: v };
            setLocalExtras(nextExtras);
            onExtraFilterChange?.(filter.key, v, nextExtras);
            if (showInstantExtras || applyExtrasOnChange) {
              onApply?.({ fromDate: localFrom, toDate: localTo, ...nextExtras });
              if (showInstantExtras) mobileFilterStrip?.collapseMobile?.();
            }
          }}
          className={`${LIST_PAGE_FILTER_SELECT_CLASS}${filter.disabled ? " opacity-50 cursor-not-allowed" : ""}`}
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")',
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 0.5rem center",
            backgroundSize: "0.875rem",
          }}
        >
          {(filter.preserveOrder ? filter.options : sortFilterOptionsAsc(filter.options)).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );

  return (
    <div className={filterGridClass}>
      {onSearchChange !== undefined && (
        <div className="min-w-0">
          <ListPageSearchField
            label={searchLabel}
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={onSearchChange}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (applyOnSearchEnter) handleApply();
                onSearchEnter?.();
              }
            }}
            containerClassName="w-full min-w-0 space-y-0 md:space-y-1"
          />
        </div>
      )}

      {filtersBeforeDate.map((filter, index) => renderExtraFilter(filter, `before-${index}`))}

      {showDate && (
        <>
          <div className={dateDisabled ? "pointer-events-none opacity-50" : ""}>
            <FilterDateInput
              label="From Date"
              valueYmd={localFrom}
              onChangeYmd={setLocalFrom}
              disabled={dateDisabled}
              minYmd={minDate}
              maxYmd={localTo || maxDate}
              onEnter={handleApply}
              aria-label="From date"
            />
          </div>

          <div className={dateDisabled ? "pointer-events-none opacity-50" : ""}>
            <FilterDateInput
              label="To Date"
              valueYmd={localTo}
              onChangeYmd={setLocalTo}
              disabled={dateDisabled}
              minYmd={localFrom || minDate}
              maxYmd={maxDate}
              onEnter={handleApply}
              aria-label="To date"
            />
          </div>
        </>
      )}

      {extraFilterCount > 0 && filtersAfterDate.map((filter, index) => renderExtraFilter(filter, `after-${index}`))}

      {showActionButtons && (
        <div className={`${LIST_PAGE_FILTER_FIELD_WRAP_CLASS} max-md:col-span-2`}>
          {actionsLabelSpacer}
          <div className="flex min-h-8 md:min-h-9 flex-row flex-nowrap gap-1 md:gap-2">
            <button
              type="button"
              onClick={handleInternalReset}
              className={`${LIST_PAGE_FILTER_ACTION_BTN_CLASS} border border-slate-300 bg-white text-slate-600 hover:bg-slate-50`}
            >
              <RotateCcw size={12} className="md:hidden" />
              <RotateCcw size={14} className="hidden md:block" />
              Reset
            </button>
            <button
              type="button"
              onClick={handleApply}
              className={`${LIST_PAGE_FILTER_ACTION_BTN_CLASS} bg-slate-800 text-white shadow-sm hover:bg-black`}
            >
              <Send size={12} className="md:hidden" />
              <Send size={14} className="hidden md:block" />
              Search
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

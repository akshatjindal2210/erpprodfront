"use client";
import { useState, useEffect, useRef } from "react";
import { RotateCcw, Send } from "lucide-react";
import ListPageSearchField, {
  LIST_PAGE_SEARCH_LABEL_CLASS,
  LIST_PAGE_FILTER_BOX_CLASS,
  LIST_PAGE_FILTER_SELECT_CLASS,
  LIST_PAGE_FILTER_FIELD_WRAP_CLASS,
  LIST_PAGE_FILTER_ACTION_BTN_CLASS,
  listPageFilterDisplayTextClass,
} from "@/core/components/common/ListPageSearchField";
import { sortFilterOptionsAsc } from "@/core/utils/sortSelectOptions";

const formatDisplayDate = (value) => {
  if (!value) return "DD/MM/YYYY";
  const [yyyy, mm, dd] = String(value).split("-");
  if (!yyyy || !mm || !dd) return "DD/MM/YYYY";
  return `${dd}/${mm}/${yyyy}`;
};

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
  searchPlaceholder = "Search...",
  searchLabel = "Search",
  minDate,
  maxDate
}) {
  const [localFrom, setLocalFrom] = useState(externalFromDate || "");
  const [localTo, setLocalTo] = useState(externalToDate || "");
  const [localExtras, setLocalExtras] = useState({});
  const fromInputRef = useRef(null);
  const toInputRef = useRef(null);

  const extraFilterCount = Array.isArray(extraFilters) ? extraFilters.length : 0;
  const showInstantExtras = Boolean(instantClientExtras && !showDate);
  /** Date ranges or server-backed extra filters keep Apply/Reset; client-only extras do not. */
  const showActionButtons = Boolean(showDate) || (extraFilterCount > 0 && !showInstantExtras);

  // ── KEY FIX: Sync state with props using functional updates to avoid cascading renders ──
  useEffect(() => {
    setLocalFrom(prev => {
      const next = externalFromDate || "";
      return prev === next ? prev : next;
    });
    setLocalTo(prev => {
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
        if (f.value !== undefined && f.value !== null && prev[f.key] !== f.value) {
          next[f.key] = f.value;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [extraFilters]);

  const handleApply = () => {
    onApply?.({ fromDate: localFrom, toDate: localTo, ...localExtras });
  };

  const handleInternalReset = () => {
    setLocalFrom(externalFromDate || "");
    setLocalTo(externalToDate || "");
    setLocalExtras({});
    onReset?.();
  };

  const openDatePicker = (inputRef) => {
    const el = inputRef?.current;
    if (!el) return;
    el.focus();
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
      } catch {
        // ignore if browser blocks programmatic picker open
      }
    }
  };

  /** Phone: 2 filters per row, compact spacing. */
  const filterGridClass =
    "grid w-full min-w-0 items-end gap-x-2 gap-y-1.5 max-md:grid-cols-2 md:gap-x-3 md:gap-y-2 md:[grid-template-columns:repeat(auto-fill,minmax(min(100%,11.25rem),1fr))]";

  const actionsLabelSpacer = (
    <span
      className={`${LIST_PAGE_SEARCH_LABEL_CLASS} block min-h-[0.875rem] md:min-h-[1.125rem] shrink-0 select-none leading-tight opacity-0`}
      aria-hidden
    >
      {"\u00a0"}
    </span>
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
            containerClassName="w-full min-w-0 space-y-0.5 md:space-y-1"
          />
        </div>
      )}

      {showDate && (
        <>
          <div className={LIST_PAGE_FILTER_FIELD_WRAP_CLASS}>
            <label className={LIST_PAGE_SEARCH_LABEL_CLASS}>From Date</label>
            <div
              className={`relative flex min-w-0 cursor-pointer items-center ${LIST_PAGE_FILTER_BOX_CLASS}`}
              onClick={() => openDatePicker(fromInputRef)}
            >
              <span className={`pointer-events-none block w-full min-w-0 truncate ${listPageFilterDisplayTextClass(localFrom)}`}>
                {formatDisplayDate(localFrom)}
              </span>
              <input
                ref={fromInputRef}
                type="date"
                value={localFrom}
                min={minDate || undefined}
                max={localTo || maxDate || undefined}
                onChange={(e) => setLocalFrom(e.target.value)}
                aria-label="From date"
                className="absolute inset-0 z-10 h-full w-full cursor-pointer border-0 bg-transparent opacity-0 text-transparent"
              />
            </div>
          </div>

          <div className={LIST_PAGE_FILTER_FIELD_WRAP_CLASS}>
            <label className={LIST_PAGE_SEARCH_LABEL_CLASS}>To Date</label>
            <div
              className={`relative flex min-w-0 cursor-pointer items-center ${LIST_PAGE_FILTER_BOX_CLASS}`}
              onClick={() => openDatePicker(toInputRef)}
            >
              <span className={`pointer-events-none block w-full min-w-0 truncate ${listPageFilterDisplayTextClass(localTo)}`}>
                {formatDisplayDate(localTo)}
              </span>
              <input
                ref={toInputRef}
                type="date"
                value={localTo}
                min={localFrom || minDate || undefined}
                max={maxDate || undefined}
                onChange={(e) => setLocalTo(e.target.value)}
                aria-label="To date"
                className="absolute inset-0 z-10 h-full w-full cursor-pointer border-0 bg-transparent opacity-0 text-transparent"
              />
            </div>
          </div>
        </>
      )}

      {extraFilterCount > 0 &&
        extraFilters.map((filter, index) => (
          <div key={index} className={LIST_PAGE_FILTER_FIELD_WRAP_CLASS}>
            <label className={LIST_PAGE_SEARCH_LABEL_CLASS}>{filter.label}</label>
            <select
              value={localExtras[filter.key] ?? filter.value ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setLocalExtras((prev) => {
                  const next = { ...prev, [filter.key]: v };
                  if (showInstantExtras || applyExtrasOnChange) {
                    onApply?.({ fromDate: localFrom, toDate: localTo, ...next });
                  }
                  return next;
                });
              }}
              className={LIST_PAGE_FILTER_SELECT_CLASS}
              style={{
                backgroundImage:
                  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")',
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 0.5rem center",
                backgroundSize: "0.875rem",
              }}
            >
              {sortFilterOptionsAsc(filter.options).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}

      {showActionButtons && (
        <div className={LIST_PAGE_FILTER_FIELD_WRAP_CLASS}>
          {actionsLabelSpacer}
          <div className="flex min-h-8 md:min-h-9 flex-row flex-nowrap gap-1.5 md:gap-2">
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


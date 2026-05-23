"use client";
import { useState, useEffect, useRef } from "react";
import { RotateCcw, Send } from "lucide-react";
import ListPageSearchField, { LIST_PAGE_SEARCH_LABEL_CLASS } from "@/components/common/ListPageSearchField";

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

  useEffect(() => {
    setLocalFrom(externalFromDate || "");
    setLocalTo(externalToDate || "");
  }, [externalFromDate, externalToDate]);

  useEffect(() => {
    if (!Array.isArray(extraFilters) || extraFilters.length === 0) return;
    setLocalExtras((prev) => {
      const next = { ...prev };
      extraFilters.forEach((f) => {
        if (f.value !== undefined && f.value !== null) next[f.key] = f.value;
      });
      return next;
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

  /** One grid: auto-wrap to next row; invisible label row on actions so controls align with labeled fields. */
  const filterGridClass =
    "grid w-full min-w-0 items-end gap-x-3 gap-y-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,11.25rem),1fr))]";

  const actionsLabelSpacer = (
    <span
      className={`${LIST_PAGE_SEARCH_LABEL_CLASS} block min-h-[1.125rem] shrink-0 select-none leading-tight opacity-0`}
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
            containerClassName="w-full min-w-0 space-y-1"
          />
        </div>
      )}

      {showDate && (
        <>
          <div className="flex min-w-0 flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-tight italic">
              From Date
            </label>
            <div
              className="relative flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-none border border-slate-300 bg-white px-2 transition-all focus-within:border-slate-500 md:px-3"
              onClick={() => openDatePicker(fromInputRef)}
            >
              <span
                className={`pointer-events-none text-[12px] font-medium md:hidden ${localFrom ? "text-slate-700" : "text-slate-400"}`}
              >
                {formatDisplayDate(localFrom)}
              </span>
              <input
                ref={fromInputRef}
                type="date"
                value={localFrom}
                min={minDate || undefined}
                max={localTo || maxDate || undefined}
                onChange={(e) => setLocalFrom(e.target.value)}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 md:static md:inset-auto md:z-auto md:h-auto md:w-full md:cursor-default md:opacity-100 md:bg-transparent md:text-[12px] md:font-medium md:outline-none text-slate-700"
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-tight italic">
              To Date
            </label>
            <div
              className="relative flex h-9 min-w-0 cursor-pointer items-center gap-2 rounded-none border border-slate-300 bg-white px-2 transition-all focus-within:border-slate-500 md:px-3"
              onClick={() => openDatePicker(toInputRef)}
            >
              <span
                className={`pointer-events-none text-[12px] font-medium md:hidden ${localTo ? "text-slate-700" : "text-slate-400"}`}
              >
                {formatDisplayDate(localTo)}
              </span>
              <input
                ref={toInputRef}
                type="date"
                value={localTo}
                min={localFrom || minDate || undefined}
                max={maxDate || undefined}
                onChange={(e) => setLocalTo(e.target.value)}
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 md:static md:inset-auto md:z-auto md:h-auto md:w-full md:cursor-default md:opacity-100 md:bg-transparent md:text-[12px] md:font-medium md:outline-none text-slate-700"
              />
            </div>
          </div>
        </>
      )}

      {extraFilterCount > 0 &&
        extraFilters.map((filter, index) => (
          <div key={index} className="flex min-w-0 flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-tight italic">
              {filter.label}
            </label>
            <select
              value={localExtras[filter.key] ?? filter.value ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setLocalExtras((prev) => ({ ...prev, [filter.key]: v }));
                if (showInstantExtras) {
                  onApply?.({
                    fromDate: localFrom,
                    toDate: localTo,
                    ...localExtras,
                    [filter.key]: v,
                  });
                }
              }}
              className="h-9 w-full min-w-0 cursor-pointer appearance-none rounded-none border border-slate-300 bg-white px-3 text-[12px] font-medium text-slate-700 outline-none focus:border-slate-500"
              style={{
                backgroundImage:
                  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")',
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 0.75rem center",
                backgroundSize: "1rem",
              }}
            >
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}

      {showActionButtons && (
        <div className="flex min-w-0 flex-col gap-1">
          {actionsLabelSpacer}
          <div className="flex min-h-9 flex-row flex-nowrap gap-2">
            <button
              type="button"
              onClick={handleInternalReset}
              className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-none border border-slate-300 bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-slate-600 transition-all hover:bg-slate-50 active:scale-95"
            >
              <RotateCcw size={14} /> Reset
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-none bg-slate-800 px-3 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-black active:scale-95"
            >
              <Send size={14} /> Search
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

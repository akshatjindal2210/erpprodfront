"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { RotateCcw, Send, SlidersHorizontal } from "lucide-react";
import FilterDateInput from "@/core/components/common/FilterDateInput";
import ListPageSearchField, { listPageFilterLabelClass, LIST_PAGE_FILTER_VALUE_CLASS, LIST_PAGE_FILTER_FIELD_WRAP_CLASS, LIST_PAGE_FILTER_ACTION_BTN_CLASS, listPageFilterBoxClass } from "@/core/components/common/ListPageSearchField";
import { useMobileFilterStrip } from "@/core/components/common/ListPageFilterStrip";
import { sortFilterOptionsAsc } from "@/core/utils/sortSelectOptions";
import SearchableSelect from "@/core/components/common/SearchableSelect";
import Drawer from "@/core/components/ui/Drawer";

const FILTER_ALL_ID = "__filter_all__";
const EMPTY_FILTERS = [];

function isAllFilterOption(opt) {
  if (opt == null || typeof opt !== "object") return false;
  const v = opt.value;
  if (v === "" || v == null) return true;
  if (String(v).trim().toLowerCase() === "all") return true;
  const label = String(opt.label ?? "").trim().toLowerCase();
  return label === "all" || label.startsWith("all ");
}

function isFilterValueActive(v) {
  if (v == null || v === "") return false;
  return String(v).trim().toLowerCase() !== "all";
}

function StaticSearchableFilter({
  filter,
  value,
  disabled,
  onValueChange,
}) {
  const options = useMemo(() => {
    const raw = Array.isArray(filter.options) ? filter.options : [];
    const sorted = filter.preserveOrder ? raw : sortFilterOptionsAsc(raw);
    return sorted.map((opt) => {
      if (isAllFilterOption(opt)) {
        return {
          label: opt.label,
          value: FILTER_ALL_ID,
          rawValue: opt.value === undefined || opt.value === null ? "" : opt.value,
        };
      }
      return {
        label: opt.label,
        value: String(opt.value),
        rawValue: opt.value,
      };
    });
  }, [filter.options, filter.preserveOrder]);

  const selectValue = useMemo(() => {
    if (value === "" || value == null || String(value).trim().toLowerCase() === "all") {
      return FILTER_ALL_ID;
    }
    return String(value);
  }, [value]);

  const fetchService = useCallback(
    async ({ search = "", page = 1, limit = 50 } = {}) => {
      const q = String(search || "").trim().toLowerCase();
      const filtered = q
        ? options.filter((opt) => String(opt?.label ?? "").toLowerCase().includes(q))
        : options;
      const start = Math.max(0, (Number(page) - 1) * Number(limit || 50));
      const slice = filtered.slice(start, start + Number(limit || 50));
      return { data: slice, total: filtered.length };
    },
    [options],
  );

  const getByIdService = useCallback(
    async (id) => {
      if (id === undefined || id === null) return null;
      return options.find((opt) => String(opt.value) === String(id)) || null;
    },
    [options],
  );

  return (
    <SearchableSelect
      key={`${filter.key}-${options.length}`}
      variant="toolbar"
      filterVariant={filter.variant === "quick" ? "quick" : "server"}
      className="w-full min-w-0"
      label={filter.label}
      placeholder={filter.placeholder || `Search ${filter.label || ""}…`}
      value={selectValue}
      onChange={(id) => {
        if (id == null || id === "" || id === FILTER_ALL_ID) {
          const allOpt = options.find((o) => o.value === FILTER_ALL_ID);
          onValueChange(allOpt ? allOpt.rawValue : "");
          return;
        }
        const match = options.find((o) => String(o.value) === String(id));
        onValueChange(match ? match.rawValue : id);
      }}
      fetchService={fetchService}
      getByIdService={getByIdService}
      dataKey="value"
      labelKey="label"
      disabled={disabled}
      emptyMessage="No results found"
    />
  );
}

export default function DateRangeFilter({
  fromDate: externalFromDate,
  toDate: externalToDate,
  onApply,
  onReset,
  showDate = true,
  extraFilters = [],
  /**
   * Secondary filters (e.g. Status / Priority / Category) — opened via a side panel
   * so the main strip stays focused on search + primary scopes.
   */
  moreFilters = [],
  moreFiltersTitle = "More filters",
  /** When true with no date pickers: extra dropdowns apply on change and Reset/Search are hidden. */
  instantClientExtras = false,
  /** When true (with date pickers): extra dropdowns call onApply immediately on change. */
  applyExtrasOnChange = false,
  /**
   * When false, hide the Search/Apply button (client-only filters — typing + dropdowns filter loaded rows).
   * Reset remains. Dates/extras still apply via onChange when applyExtrasOnChange / client mode.
   */
  showSearchButton = true,
  searchValue,
  onSearchChange,
  onSearchEnter,
  /** When false, Enter in the search field does not run Apply (client-side search only). */
  applyOnSearchEnter = true,
  searchPlaceholder = "Search...",
  searchLabel = "Search",
  /**
   * `quick` = indigo — filters rows already loaded (default for CL / list pages).
   * `server` = white — only when Search hits API / DB.
   */
  searchVariant = "quick",
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
  const [moreOpen, setMoreOpen] = useState(false);
  const mobileFilterStrip = useMobileFilterStrip();

  const primaryFilters = Array.isArray(extraFilters) ? extraFilters : EMPTY_FILTERS;
  const secondaryFilters = Array.isArray(moreFilters) ? moreFilters : EMPTY_FILTERS;
  const allDropdownFilters = useMemo(
    () => [...primaryFilters, ...secondaryFilters],
    [primaryFilters, secondaryFilters],
  );

  const extraFilterCount = primaryFilters.length + secondaryFilters.length;
  const moreActiveCount = secondaryFilters.filter((f) =>
    isFilterValueActive(localExtras[f.key] ?? f.value),
  ).length;
  const showInstantExtras = Boolean(instantClientExtras && !showDate);
  const allowSearchButton = showSearchButton !== false;
  const hasSearchField = onSearchChange !== undefined;
  /** Date ranges or server-backed extra filters keep Apply/Reset; client-only extras do not. */
  const showActionButtons = Boolean(showDate) || (extraFilterCount > 0 && !showInstantExtras);
  /**
   * Action row: hide entirely for instantClientExtras.
   * Otherwise show Reset whenever there are dates/extras/search; Search when allowSearchButton.
   */
  const showResetButton =
    !showInstantExtras &&
    (showActionButtons || hasSearchField || (!allowSearchButton && typeof onReset === "function"));
  const showSearchAction = !showInstantExtras && allowSearchButton && (showActionButtons || hasSearchField);
  /** Instant-apply dates when Search is hidden OR extras already apply on change (client filters). */
  const applyDatesOnChange = Boolean(showDate && (!allowSearchButton || applyExtrasOnChange));

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
    if (allDropdownFilters.length === 0) return;
    setLocalExtras((prev) => {
      let changed = false;
      const next = { ...prev };
      allDropdownFilters.forEach((f) => {
        if (f.type === "text" || !f.key) return;
        if (f.value !== undefined && f.value !== null && prev[f.key] !== f.value) {
          next[f.key] = f.value;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [allDropdownFilters]);

  const emitApply = (patch = {}, { searchSubmit = false } = {}) => {
    onApply?.({
      fromDate: localFrom,
      toDate: localTo,
      ...localExtras,
      ...patch,
      ...(searchSubmit ? { searchSubmit: true } : {}),
    });
  };

  const handleApply = () => {
    emitApply({}, { searchSubmit: true });
    mobileFilterStrip?.collapseMobile?.();
    setMoreOpen(false);
  };

  const handleInternalReset = () => {
    setLocalFrom(externalFromDate || "");
    setLocalTo(externalToDate || "");
    setLocalExtras({});
    onReset?.();
    mobileFilterStrip?.collapseMobile?.();
    setMoreOpen(false);
  };

  const applyExtraValue = (filter, v) => {
    if (filter.disabled) return;
    const nextExtras = { ...localExtras, [filter.key]: v };
    setLocalExtras(nextExtras);
    onExtraFilterChange?.(filter.key, v, nextExtras);
    if (showInstantExtras || applyExtrasOnChange) {
      onApply?.({ fromDate: localFrom, toDate: localTo, ...nextExtras });
      if (showInstantExtras) mobileFilterStrip?.collapseMobile?.();
    }
  };

  const clearMoreFilters = () => {
    const cleared = { ...localExtras };
    secondaryFilters.forEach((f) => {
      if (!f.key) return;
      const allOpt = (f.options || []).find((o) => isAllFilterOption(o));
      cleared[f.key] = allOpt ? (allOpt.value === undefined || allOpt.value === null ? "" : allOpt.value) : "All";
    });
    setLocalExtras(cleared);
    if (showInstantExtras || applyExtrasOnChange) {
      onApply?.({ fromDate: localFrom, toDate: localTo, ...cleared });
    }
  };

  /** Phone: two columns. Desktop: flex so short filters stay compact and the next control sits beside them. */
  const filterGridClass =
    "flex w-full min-w-0 flex-wrap items-end gap-x-1.5 gap-y-1 max-md:[&>*]:basis-[calc(50%-0.375rem)] max-md:[&>*]:grow md:gap-x-2.5 md:gap-y-2";

  const actionsLabelSpacer = (
    <span
      className={`${listPageFilterLabelClass("server")} max-md:hidden block min-h-[0.875rem] md:min-h-[1.125rem] shrink-0 select-none leading-tight opacity-0`}
      aria-hidden
    >
      {"\u00a0"}
    </span>
  );

  const beforeDateKeys = new Set((Array.isArray(extraFiltersBeforeDate) ? extraFiltersBeforeDate : []).map(String));
  const filtersBeforeDate = primaryFilters.filter((f) => beforeDateKeys.has(f.key));
  const filtersAfterDate = primaryFilters.filter((f) => !beforeDateKeys.has(f.key));

  const renderExtraFilter = (filter, index, { stacked = false } = {}) =>
    filter.type === "text" ? (
      <div key={index} className={stacked ? "w-full min-w-0" : "min-w-0"}>
        <ListPageSearchField
          label={filter.label}
          placeholder={filter.placeholder ?? ""}
          value={filter.value}
          onChange={filter.onChange}
          variant={filter.variant || "server"}
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
    ) : filter.searchable ? (
      <div
        key={index}
        className={`${LIST_PAGE_FILTER_FIELD_WRAP_CLASS} ${
          stacked
            ? "w-full min-w-0"
            : filter.className || "md:min-w-[12rem] md:flex-1 md:max-w-[16rem]"
        }`.trim()}
      >
        <StaticSearchableFilter
          filter={filter}
          value={localExtras[filter.key] ?? filter.value ?? ""}
          disabled={Boolean(filter.disabled)}
          onValueChange={(v) => applyExtraValue(filter, v)}
        />
      </div>
    ) : (
      <div
        key={index}
        className={`${LIST_PAGE_FILTER_FIELD_WRAP_CLASS} ${
          stacked
            ? "w-full min-w-0"
            : filter.className || "md:min-w-[10.5rem] md:flex-1 md:max-w-[14rem]"
        }`.trim()}
      >
        <label className={`${listPageFilterLabelClass(filter.variant === "quick" ? "quick" : "server")} ${stacked ? "" : "max-md:hidden"}`}>
          {filter.label}
        </label>
        <select
          value={localExtras[filter.key] ?? filter.value ?? ""}
          disabled={Boolean(filter.disabled)}
          onChange={(e) => applyExtraValue(filter, e.target.value)}
          className={`${
            [
              listPageFilterBoxClass(filter.variant === "quick" ? "quick" : "server"),
              LIST_PAGE_FILTER_VALUE_CLASS,
              "cursor-pointer appearance-none outline-none pr-7 md:pr-8",
            ].join(" ")
          }${filter.disabled ? " opacity-50 cursor-not-allowed" : ""}`}
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")',
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 0.5rem center",
            backgroundSize: "0.875rem",
          }}
        >
          {(filter.preserveOrder ? filter.options : sortFilterOptionsAsc(filter.options)).map((opt) => (
            <option key={String(opt.value)} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );

  return (
    <>
      <div className={filterGridClass}>
        {onSearchChange !== undefined && (
          <div className="min-w-0 w-full max-md:basis-full md:w-[16rem] md:shrink-0 md:grow-0">
            <ListPageSearchField
              label={searchLabel}
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={onSearchChange}
              variant={searchVariant === "quick" ? "quick" : "server"}
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
            <div className={`md:w-[10.5rem] md:shrink-0 ${dateDisabled ? "pointer-events-none opacity-50" : ""}`}>
              <FilterDateInput
                label="From Date"
                valueYmd={localFrom}
                onChangeYmd={(v) => {
                  setLocalFrom(v);
                  if (applyDatesOnChange) emitApply({ fromDate: v, toDate: localTo });
                }}
                disabled={dateDisabled}
                minYmd={minDate}
                maxYmd={localTo || maxDate}
                onEnter={allowSearchButton ? handleApply : undefined}
                aria-label="From date"
              />
            </div>

            <div className={`md:w-[10.5rem] md:shrink-0 ${dateDisabled ? "pointer-events-none opacity-50" : ""}`}>
              <FilterDateInput
                label="To Date"
                valueYmd={localTo}
                onChangeYmd={(v) => {
                  setLocalTo(v);
                  if (applyDatesOnChange) emitApply({ fromDate: localFrom, toDate: v });
                }}
                disabled={dateDisabled}
                minYmd={localFrom || minDate}
                maxYmd={maxDate}
                onEnter={allowSearchButton ? handleApply : undefined}
                aria-label="To date"
              />
            </div>
          </>
        )}

        {filtersAfterDate.map((filter, index) => renderExtraFilter(filter, `after-${index}`))}

        {(secondaryFilters.length > 0 || showResetButton) && (
          <div className={`${LIST_PAGE_FILTER_FIELD_WRAP_CLASS} max-md:basis-full md:w-auto md:shrink-0 md:grow-0`}>
            {actionsLabelSpacer}
            <div className="flex min-h-8 md:min-h-9 flex-row flex-nowrap gap-1 md:gap-2">
              {secondaryFilters.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  className={`${LIST_PAGE_FILTER_ACTION_BTN_CLASS} border ${
                    moreActiveCount > 0
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  aria-expanded={moreOpen}
                  title="More filters: status, priority, category"
                >
                  <SlidersHorizontal size={12} className="md:hidden shrink-0" />
                  <SlidersHorizontal size={14} className="hidden md:block shrink-0" />
                  More
                  {moreActiveCount > 0 ? (
                    <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-black text-white">
                      {moreActiveCount}
                    </span>
                  ) : null}
                </button>
              ) : null}
              {showResetButton ? (
                <>
                  <button
                    type="button"
                    onClick={handleInternalReset}
                    className={`${LIST_PAGE_FILTER_ACTION_BTN_CLASS} border border-slate-300 bg-white text-slate-600 hover:bg-slate-50${showSearchAction ? "" : " flex-1"}`}
                  >
                    <RotateCcw size={12} className="md:hidden" />
                    <RotateCcw size={14} className="hidden md:block" />
                    Reset
                  </button>
                  {showSearchAction ? (
                    <button
                      type="button"
                      onClick={handleApply}
                      className={`${LIST_PAGE_FILTER_ACTION_BTN_CLASS} bg-slate-800 text-white shadow-sm hover:bg-black`}
                    >
                      <Send size={12} className="md:hidden" />
                      <Send size={14} className="hidden md:block" />
                      Search
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {secondaryFilters.length > 0 && (
        <Drawer
          isOpen={moreOpen}
          onClose={() => setMoreOpen(false)}
          onSubmit={handleApply}
          title={moreFiltersTitle}
          maxWidth="max-w-sm"
          footer={
            <div className="flex w-full items-center gap-2">
              <button
                type="button"
                onClick={clearMoreFilters}
                disabled={moreActiveCount === 0}
                className={`${LIST_PAGE_FILTER_ACTION_BTN_CLASS} flex-1 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none`}
              >
                <RotateCcw size={14} />
                Clear
              </button>
              <button
                type="button"
                onClick={handleApply}
                className={`${LIST_PAGE_FILTER_ACTION_BTN_CLASS} flex-1 bg-slate-800 text-white hover:bg-black`}
              >
                <Send size={14} />
                {showSearchAction ? "Apply" : "Done"}
              </button>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            {secondaryFilters.map((filter, index) =>
              renderExtraFilter(filter, `more-${index}`, { stacked: true }),
            )}
          </div>
        </Drawer>
      )}
    </>
  );
}

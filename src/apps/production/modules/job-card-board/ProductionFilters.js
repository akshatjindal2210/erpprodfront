"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";

/** URL sentinel: every checkbox unchecked (show nothing). All selected → omit param. */
export const FILTER_NONE = "__none__";

function parseCsvIds(raw) {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** All selected → []; none selected → [FILTER_NONE]; else selected ids. */
function checkboxToIds(value, options) {
  if (!options.length) return [];
  const selected = options
    .filter((o) => {
      const v = value?.[o.value];
      if (v !== undefined) return v !== false;
      const s = value?.[String(o.value)];
      if (s !== undefined) return s !== false;
      return !value || Object.keys(value).length === 0;
    })
    .map((o) => String(o.value));
  if (selected.length === options.length) return [];
  if (selected.length === 0) return [FILTER_NONE];
  return selected;
}

function idsToCheckbox(ids, options) {
  if (!ids.length) return Object.fromEntries(options.map((o) => [String(o.value), true]));
  if (ids.length === 1 && ids[0] === FILTER_NONE) {
    return Object.fromEntries(options.map((o) => [String(o.value), false]));
  }
  const set = new Set(ids.map(String));
  return Object.fromEntries(options.map((o) => [String(o.value), set.has(String(o.value))]));
}

export function useProductionFilterIds() {
  const searchParams = useSearchParams();
  const process = searchParams.get("process") || "";
  const machine = searchParams.get("machine") || "";
  const shift = searchParams.get("shift") || "";
  const statusFromUrl = searchParams.get("status") || "all";
  return useMemo(
    () => ({
      processIds: parseCsvIds(process),
      machineIds: parseCsvIds(machine),
      shiftIds: parseCsvIds(shift),
      statusFromUrl,
    }),
    [process, machine, shift, statusFromUrl]
  );
}

/**
 * Shared filters for Board, Calendar, Planning Table.
 * URL: ?process=1,2&machine=3,4&status=Running&shift=1,2
 * Planning Table: showDate + min/max = IMS From/To (Search applies → parent refetches).
 */
export default function ProductionFilters({
  processOptions = [],
  machineOptions = [],
  search = "",
  onSearchChange,
  searchLabel = "Search",
  searchPlaceholder = "Search job card, item, process…",
  statusFilter = "all",
  statusOptions = [],
  onStatusChange,
  /** Calendar only — show Shift multi-select */
  showShiftFilter = false,
  /** Settings → Shifts codes (empty = hide shift filter). */
  shifts = [],
  /** Planning Table — plan start From/To (IMS server filter) */
  showDate = false,
  fromDate = "",
  toDate = "",
  minDate = "",
  maxDate = "",
  onDateChange,
  onDateReset,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const processIds = useMemo(() => parseCsvIds(searchParams.get("process")), [searchParams]);
  const machineIds = useMemo(() => parseCsvIds(searchParams.get("machine")), [searchParams]);
  const shiftIds = useMemo(() => parseCsvIds(searchParams.get("shift")), [searchParams]);

  const shiftOptions = useMemo(
    () =>
      (Array.isArray(shifts) ? shifts : []).map((s) => ({
        label: s.code || s.label || s.short || String(s.id),
        value: String(s.id),
      })),
    [shifts]
  );

  const processValue = useMemo(() => idsToCheckbox(processIds, processOptions), [processIds, processOptions]);
  const machineValue = useMemo(() => idsToCheckbox(machineIds, machineOptions), [machineIds, machineOptions]);
  const shiftValue = useMemo(() => idsToCheckbox(shiftIds, shiftOptions), [shiftIds, shiftOptions]);

  const writeParams = useCallback(
    (nextProcessIds, nextMachineIds, nextStatus, nextShiftIds) => {
      const q = new URLSearchParams(searchParams.toString());
      if (nextProcessIds.length) q.set("process", nextProcessIds.join(","));
      else q.delete("process");
      if (nextMachineIds.length) q.set("machine", nextMachineIds.join(","));
      else q.delete("machine");
      if (nextStatus && nextStatus !== "all") q.set("status", nextStatus);
      else q.delete("status");
      if (showShiftFilter && nextShiftIds?.length) q.set("shift", nextShiftIds.join(","));
      else q.delete("shift");
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams, showShiftFilter]
  );

  const extraFilters = useMemo(() => {
    const list = [];
    if (statusOptions.length) {
      list.push({
        label: "Status",
        key: "status",
        value: statusFilter,
        options: statusOptions,
        preserveOrder: true,
        variant: "quick",
        className: "md:min-w-[9rem] md:max-w-[11rem]",
      });
    }
    if (processOptions.length) {
      list.push({
        type: "checkboxGroup",
        key: "processIncludes",
        label: "Process",
        variant: "quick",
        options: processOptions,
        value: processValue,
        allLabel: "All processes",
        className: "md:min-w-[12rem] md:max-w-[16rem]",
      });
    }
    if (machineOptions.length) {
      list.push({
        type: "checkboxGroup",
        key: "machineIncludes",
        label: "Machine",
        variant: "quick",
        options: machineOptions,
        value: machineValue,
        allLabel: "All machines",
        className: "md:min-w-[12rem] md:max-w-[16rem]",
      });
    }
    if (showShiftFilter && shiftOptions.length) {
      list.push({
        type: "checkboxGroup",
        key: "shiftIncludes",
        label: "Shift",
        variant: "quick",
        options: shiftOptions,
        value: shiftValue,
        allLabel: "All shifts",
        className: "md:min-w-[9rem] md:max-w-[11rem]",
      });
    }
    return list;
  }, [
    statusOptions,
    statusFilter,
    processOptions,
    machineOptions,
    processValue,
    machineValue,
    showShiftFilter,
    shiftOptions,
    shiftValue,
  ]);

  const activeChips = useMemo(() => {
    const chips = [];
    if (statusFilter && statusFilter !== "all") {
      chips.push({
        key: "status",
        label: `Status: ${statusFilter}`,
        clear: () => {
          onStatusChange?.("all");
          writeParams(processIds, machineIds, "all", shiftIds);
        },
      });
    }
    if (processIds.length) {
      const isNone = processIds.length === 1 && processIds[0] === FILTER_NONE;
      const names = isNone
        ? ["None"]
        : processIds
            .map((id) => processOptions.find((o) => String(o.value) === String(id))?.label || id)
            .slice(0, 2);
      const extra = !isNone && processIds.length > 2 ? ` +${processIds.length - 2}` : "";
      chips.push({
        key: "process",
        label: `Process: ${names.join(", ")}${extra}`,
        clear: () => writeParams([], machineIds, statusFilter, shiftIds),
      });
    }
    if (machineIds.length) {
      const isNone = machineIds.length === 1 && machineIds[0] === FILTER_NONE;
      const names = isNone
        ? ["None"]
        : machineIds
            .map((id) => machineOptions.find((o) => String(o.value) === String(id))?.label || id)
            .slice(0, 2);
      const extra = !isNone && machineIds.length > 2 ? ` +${machineIds.length - 2}` : "";
      chips.push({
        key: "machine",
        label: `Machine: ${names.join(", ")}${extra}`,
        clear: () => writeParams(processIds, [], statusFilter, shiftIds),
      });
    }
    if (showShiftFilter && shiftIds.length) {
      const isNone = shiftIds.length === 1 && shiftIds[0] === FILTER_NONE;
      chips.push({
        key: "shift",
        label: isNone ? "Shift: None" : `Shift: ${shiftIds.map((id) => `S${id}`).join(", ")}`,
        clear: () => writeParams(processIds, machineIds, statusFilter, []),
      });
    }
    // Date stays in From/To only (IMS) — do not chip it under Active.
    if (search.trim()) {
      chips.push({
        key: "search",
        label: `Search: “${search.trim().slice(0, 24)}${search.trim().length > 24 ? "…" : ""}”`,
        clear: () => onSearchChange?.(""),
      });
    }
    return chips;
  }, [
    statusFilter,
    processIds,
    machineIds,
    shiftIds,
    search,
    processOptions,
    machineOptions,
    showShiftFilter,
    onStatusChange,
    onSearchChange,
    writeParams,
  ]);

  const clearAll = () => {
    onSearchChange?.("");
    onStatusChange?.("all");
    writeParams([], [], "all", []);
    if (showDate) {
      if (onDateReset) onDateReset();
      else onDateChange?.("", "");
    }
  };

  return (
    <div className="border-b border-slate-200 bg-white">
      <ListPageFilterStrip>
        <DateRangeFilter
          showDate={showDate}
          fromDate={showDate ? fromDate : ""}
          toDate={showDate ? toDate : ""}
          minDate={showDate ? minDate || undefined : undefined}
          maxDate={showDate ? maxDate || undefined : undefined}
          instantClientExtras={!showDate}
          applyExtrasOnChange={showDate}
          /* Dates: Search button hits API. Typed search = quick (indigo) on loaded rows. */
          showSearchButton={showDate}
          applyOnSearchEnter={false}
          searchVariant="quick"
          searchValue={search}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
          searchLabel={searchLabel}
          extraFilters={extraFilters}
          onApply={(data) => {
            const nextStatus = data.status || "all";
            onStatusChange?.(nextStatus);
            if (showDate) {
              onDateChange?.(String(data.fromDate || "").slice(0, 10), String(data.toDate || "").slice(0, 10));
            }
            writeParams(
              checkboxToIds(data.processIncludes ?? processValue, processOptions),
              checkboxToIds(data.machineIncludes ?? machineValue, machineOptions),
              nextStatus,
              showShiftFilter ? checkboxToIds(data.shiftIncludes ?? shiftValue, shiftOptions) : []
            );
          }}
          onReset={clearAll}
        />
      </ListPageFilterStrip>

      {activeChips.length ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 bg-slate-50/80 px-2.5 py-1.5">
          <span className="text-[8px] font-black uppercase tracking-wide text-slate-400">Active</span>
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              className="inline-flex max-w-[16rem] items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-800 hover:bg-indigo-100"
              title="Clear this filter"
            >
              <span className="truncate">{chip.label}</span>
              <X size={10} className="shrink-0 opacity-70" />
            </button>
          ))}
          <button
            type="button"
            className="ml-auto text-[9px] font-bold uppercase tracking-wide text-slate-500 hover:text-rose-600"
            onClick={clearAll}
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}

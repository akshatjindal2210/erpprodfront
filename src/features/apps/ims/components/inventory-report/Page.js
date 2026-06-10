"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import DataTable from "@/core/components/ui/DataTable";
import ViewToggle from "@/core/components/ui/ViewToggle";
import { ListPageToolbar, ListPageToolbarLayout, LIST_PAGE_ACTION_CLASS } from "@/core/components/common/ListPageToolbar";
import SearchableSelect from "@/core/components/common/SearchableSelect";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import { useViewMode } from "@/core/hooks/useViewMode";
import { inventoryReportService } from "@/features/apps/ims/services/inventoryReport";
import { sortSelectRowsAsc } from "@/core/utils/sortSelectOptions";
import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";
import { formatDate, formatDocDate } from "@/core/utils/utilHelper";

const PAGE_SIZE = 100;
const FILTER_DEBOUNCE_MS = 350;

const EMPTY_FILTERS = {
  item_dcodes: [],
  customer_codes: [],
  location_ids: [],
  packing_numbers: [],
};

const EMPTY_TOTALS = {
  fg_stock_qty: 0,
  in_store_qty: 0,
  packing_area_qty: 0,
  out_qty: 0,
};

const FILTER_FIELD_TO_LIST = {
  item_dcodes: "items",
  customer_codes: "customers",
  location_ids: "locations",
  packing_numbers: "packings",
};

function filterLabelWithCount(label, count) {
  return `${label} (${Number(count) || 0})`;
}

function normalizeMultiFilterIds(value) {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.map((v) => String(v).trim()).filter(Boolean))];
}

function toApiFilters(filters) {
  const o = {};
  const items = normalizeMultiFilterIds(filters.item_dcodes);
  const customers = normalizeMultiFilterIds(filters.customer_codes);
  const locations = normalizeMultiFilterIds(filters.location_ids);
  const packings = normalizeMultiFilterIds(filters.packing_numbers);
  if (items.length) o.item_dcodes = items;
  if (customers.length) o.customer_codes = customers;
  if (locations.length) o.location_ids = locations;
  if (packings.length) o.packing_numbers = packings;
  return o;
}

/** Dropdown options: apply other filters but not the field being edited (multi-select can add more). */
function toApiFiltersForOptions(filters, excludeKey) {
  const o = {};
  const items = normalizeMultiFilterIds(filters.item_dcodes);
  const customers = normalizeMultiFilterIds(filters.customer_codes);
  const locations = normalizeMultiFilterIds(filters.location_ids);
  const packings = normalizeMultiFilterIds(filters.packing_numbers);
  if (items.length && excludeKey !== "item_dcodes") o.item_dcodes = items;
  if (customers.length && excludeKey !== "customer_codes") o.customer_codes = customers;
  if (locations.length && excludeKey !== "location_ids") o.location_ids = locations;
  if (packings.length && excludeKey !== "packing_numbers") o.packing_numbers = packings;
  return o;
}

function normalizeFilterOptions(data) {
  const d = data || {};
  return {
    items: Array.isArray(d.items) ? d.items : [],
    customers: Array.isArray(d.customers) ? d.customers : [],
    locations: Array.isArray(d.locations) ? d.locations : [],
    packings: Array.isArray(d.packings) ? d.packings : [],
  };
}

function optionsCacheKey(fieldKey, filters) {
  return `${fieldKey}:${JSON.stringify(toApiFiltersForOptions(filters, fieldKey))}`;
}

export default function InventoryReportPage() {
  const [rows, setRows] = useState([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotals, setServerTotals] = useState(EMPTY_TOTALS);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewMode, handleViewMode] = useViewMode();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterOptions, setFilterOptions] = useState({
    items: [],
    customers: [],
    locations: [],
    packings: [],
  });
  const filterOptionsRef = useRef(filterOptions);

  const commitFilterOptions = useCallback((updater) => {
    setFilterOptions((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      filterOptionsRef.current = next;
      return next;
    });
  }, []);

  const [params, setParams] = useState({
    sortKey: "packing_number",
    sortDir: "desc",
  });

  const pageRef = useRef(1);
  const loadGenRef = useRef(0);
  const filterOptionsGenRef = useRef(0);
  const optionsCacheRef = useRef(new Map());
  const filtersRef = useRef(filters);
  const isFirstReportLoadRef = useRef(true);
  const isFirstOptionsLoadRef = useRef(true);
  const optionsInFlightRef = useRef(new Set());
  const optionsLoadPromisesRef = useRef(new Map());
  const optionsBundlePromiseRef = useRef(null);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const waitForOptionsInFlight = useCallback((cacheKey) => {
    return new Promise((resolve) => {
      const tick = () => {
        if (!optionsInFlightRef.current.has(cacheKey)) {
          resolve();
          return;
        }
        setTimeout(tick, 30);
      };
      tick();
    });
  }, []);

  const loadFilterOptionsForField = useCallback(async (fieldKey) => {
    const currentFilters = filtersRef.current;
    const cacheKey = optionsCacheKey(fieldKey, currentFilters);
    const listKey = FILTER_FIELD_TO_LIST[fieldKey];

    const cached = optionsCacheRef.current.get(cacheKey);
    if (cached && listKey) {
      commitFilterOptions((prev) => ({ ...prev, [listKey]: cached }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      return;
    }

    const pending = optionsLoadPromisesRef.current.get(cacheKey);
    if (pending) return pending;

    if (optionsInFlightRef.current.has(cacheKey)) {
      await waitForOptionsInFlight(cacheKey);
      const cachedAfterWait = optionsCacheRef.current.get(cacheKey);
      if (cachedAfterWait && listKey) {
        commitFilterOptions((prev) => ({ ...prev, [listKey]: cachedAfterWait }));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      return;
    }

    const loadPromise = (async () => {
      optionsInFlightRef.current.add(cacheKey);
      const gen = ++filterOptionsGenRef.current;
      try {
        const res = await inventoryReportService.getFilterOptions(
          toApiFiltersForOptions(currentFilters, fieldKey),
          [listKey]
        );
        if (gen !== filterOptionsGenRef.current) return;
        if (!res?.success || !listKey) return;

        const normalized = normalizeFilterOptions(res.data);
        const list = normalized[listKey] || [];
        optionsCacheRef.current.set(cacheKey, list);
        commitFilterOptions((prev) => ({ ...prev, [listKey]: list }));
        await new Promise((resolve) => setTimeout(resolve, 0));
      } catch {
        /* dropdowns optional */
      } finally {
        optionsInFlightRef.current.delete(cacheKey);
        optionsLoadPromisesRef.current.delete(cacheKey);
      }
    })();

    optionsLoadPromisesRef.current.set(cacheKey, loadPromise);
    return loadPromise;
  }, [waitForOptionsInFlight, commitFilterOptions]);

  const loadReport = useCallback(
    async ({ pageNum = 1, append = false } = {}) => {
      const gen = ++loadGenRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      const apiFilters = toApiFilters(filtersRef.current);
      try {
        const body = await inventoryReportService.getReport({
          page: pageNum,
          limit: PAGE_SIZE,
          sortBy: params.sortKey,
          order: params.sortDir.toUpperCase(),
          filters: apiFilters,
          includeTotals: pageNum === 1,
        });
        if (gen !== loadGenRef.current) return;

        if (!body?.success) {
          throw new Error(body?.message || "Report failed");
        }

        const chunk = Array.isArray(body.data) ? body.data : [];
        setRows((prev) => (append ? [...prev, ...chunk] : chunk));
        setServerTotal(Number(body.total ?? chunk.length));
        if (body.totals && pageNum === 1) {
          setServerTotals({
            fg_stock_qty: Number(body.totals.fg_stock_qty) || 0,
            in_store_qty: Number(body.totals.in_store_qty) || 0,
            packing_area_qty: Number(body.totals.packing_area_qty) || 0,
            out_qty: Number(body.totals.out_qty) || 0,
          });
        }
        pageRef.current = pageNum;

        if (!append && !chunk.length) {
          toast.info("No inventory entries found for the current filters.");
        }
      } catch (err) {
        if (gen !== loadGenRef.current) return;
        toast.error(err?.message || "Report load failed");
        if (!append) {
          setRows([]);
          setServerTotal(0);
          setServerTotals(EMPTY_TOTALS);
        }
      } finally {
        if (gen === loadGenRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [params.sortKey, params.sortDir]
  );

  useEffect(() => {
    const delay = isFirstReportLoadRef.current ? 0 : FILTER_DEBOUNCE_MS;
    isFirstReportLoadRef.current = false;

    const timer = setTimeout(() => {
      void loadReport({ pageNum: 1, append: false });
    }, delay);

    return () => clearTimeout(timer);
  }, [filters, params.sortKey, params.sortDir, loadReport]);

  /** One API round-trip for all label counts (backend runs the 4 queries in parallel). */
  const loadFilterOptionsAll = useCallback(async () => {
    if (optionsBundlePromiseRef.current) return optionsBundlePromiseRef.current;

    const loadPromise = (async () => {
      const gen = ++filterOptionsGenRef.current;
      try {
        const res = await inventoryReportService.getFilterOptions(toApiFilters(filtersRef.current));
        if (gen !== filterOptionsGenRef.current) return;
        if (!res?.success) return;
        commitFilterOptions(() => normalizeFilterOptions(res.data));
      } catch {
        /* dropdowns optional */
      } finally {
        optionsBundlePromiseRef.current = null;
      }
    })();

    optionsBundlePromiseRef.current = loadPromise;
    return loadPromise;
  }, [commitFilterOptions]);

  useEffect(() => {
    const delay = isFirstOptionsLoadRef.current ? 0 : 100;
    isFirstOptionsLoadRef.current = false;
    const timer = setTimeout(() => {
      void loadFilterOptionsAll();
    }, delay);
    return () => clearTimeout(timer);
  }, [filters, loadFilterOptionsAll]);

  const filterLabels = useMemo(
    () => ({
      item: filterLabelWithCount("Item", filterOptions.items.length),
      customer: filterLabelWithCount("Customer", filterOptions.customers.length),
      location: filterLabelWithCount("Store location", filterOptions.locations.length),
      packing: filterLabelWithCount("Packing Entry", filterOptions.packings.length),
    }),
    [filterOptions]
  );

  const handleRefresh = useCallback(() => {
    optionsCacheRef.current.clear();
    optionsBundlePromiseRef.current = null;
    void loadFilterOptionsAll();
    void loadReport({ pageNum: 1, append: false });
  }, [loadReport, loadFilterOptionsAll]);

  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || rows.length >= serverTotal) return;
    void loadReport({ pageNum: pageRef.current + 1, append: true });
  }, [loading, loadingMore, rows.length, serverTotal, loadReport]);

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
  };

  const HEADERS = useMemo(() => {
    const txt = (label, key, width = "140px") => [
      label,
      key,
      (v) => <span className="text-[11px] text-slate-700 font-medium">{v ?? "—"}</span>,
      { width },
    ];
    const num = (label, key) => [
      label,
      key,
      (v) => (
        <span className="text-[11px] font-semibold text-slate-800 tabular-nums">
          {v != null && v !== "" ? Number(v).toLocaleString() : "0"}
        </span>
      ),
      { width: "110px" },
    ];
    return [
      [
        "Packing Entry",
        "packing_number",
        (v) => <span className="text-[11px] text-slate-700 font-medium">{v ?? "—"}</span>,
        { fixed: true, width: "130px" },
      ],
      ["Date", "doc_dt", (v) => <span className="text-slate-600 font-bold text-[10px] uppercase">{formatDocDate(v) || "—"}</span>, { width: "100px" }],
      txt("Item Code", "item_code", "120px"),
      txt("Item Details", "item_desc", "220px"),
      txt("Customer", "customer_name", "200px"),
      txt("Location Details", "location_details", "220px"),
      num("Total Stock", "fg_stock_qty"),
      num("In Store", "in_store_qty"),
      num("Packing Area", "packing_area_qty"),
    ];
  }, []);

  const hasActiveFilters = useMemo(
    () =>
      (filters.item_dcodes?.length ?? 0) > 0 ||
      (filters.customer_codes?.length ?? 0) > 0 ||
      (filters.location_ids?.length ?? 0) > 0 ||
      (filters.packing_numbers?.length ?? 0) > 0,
    [filters]
  );

  const formatQty = (n) => {
    const x = Number(n);
    return (Number.isFinite(x) ? x : 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const makeFetchService = useCallback((listKey, labelKey, subLabelKey = "") => {
    return async ({ search = "", page = 1, limit = 50 } = {}) => {
      const list = filterOptionsRef.current[listKey] || [];
      const q = String(search || "").trim().toLowerCase();
      const filtered = q
        ? list.filter((row) => {
            const a = String(row?.[labelKey] || "").toLowerCase();
            const b = subLabelKey ? String(row?.[subLabelKey] || "").toLowerCase() : "";
            return a.includes(q) || b.includes(q);
          })
        : list;
      const sorted = sortSelectRowsAsc(filtered, labelKey, subLabelKey ? [subLabelKey] : []);
      const start = (Math.max(1, Number(page) || 1) - 1) * (Number(limit) || 50);
      return { data: sorted.slice(start, start + (Number(limit) || 50)) };
    };
  }, []);

  const makeGetByIdService = useCallback((listKey) => {
    return async (id) => {
      const list = filterOptionsRef.current[listKey] || [];
      const match = list.find((row) => String(row?.id) === String(id));
      return { data: match || null };
    };
  }, []);

  const itemFetchService = useMemo(
    () => makeFetchService("items", "item_code", "item_desc"),
    [makeFetchService]
  );
  const customerFetchService = useMemo(
    () => makeFetchService("customers", "acc_name"),
    [makeFetchService]
  );
  const locationFetchService = useMemo(
    () => makeFetchService("locations", "location_no"),
    [makeFetchService]
  );
  const packingFetchService = useMemo(
    () => makeFetchService("packings", "packing_number"),
    [makeFetchService]
  );

  const itemGetById = useMemo(() => makeGetByIdService("items"), [makeGetByIdService]);
  const customerGetById = useMemo(() => makeGetByIdService("customers"), [makeGetByIdService]);
  const locationGetById = useMemo(() => makeGetByIdService("locations"), [makeGetByIdService]);
  const packingGetById = useMemo(() => makeGetByIdService("packings"), [makeGetByIdService]);

  const prefetchItemOptions = useCallback(() => loadFilterOptionsForField("item_dcodes"), [loadFilterOptionsForField]);
  const prefetchCustomerOptions = useCallback(
    () => loadFilterOptionsForField("customer_codes"),
    [loadFilterOptionsForField]
  );
  const prefetchLocationOptions = useCallback(
    () => loadFilterOptionsForField("location_ids"),
    [loadFilterOptionsForField]
  );
  const prefetchPackingOptions = useCallback(
    () => loadFilterOptionsForField("packing_numbers"),
    [loadFilterOptionsForField]
  );

  const setMultiFilter = useCallback((key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: normalizeMultiFilterIds(value),
    }));
  }, []);

  return (
    <div className={IMS_LIST_PAGE_SHELL}>
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <ListPageToolbar>
          <ListPageToolbarLayout
            actions={
              <>
              <div className="flex items-center gap-2 min-w-0 shrink-0 md:max-w-xs lg:max-w-sm">
                <BarChart3 size={18} className="text-indigo-600 shrink-0 hidden sm:block" />
                <div className="min-w-0 hidden md:block">
                  <h1 className="text-sm font-bold text-slate-800 leading-tight">Inventory Report</h1>
                  <p className="text-[10px] text-slate-500 font-medium truncate">
                    Total Stock = In Store + Packing Area
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className={`${LIST_PAGE_ACTION_CLASS} px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 disabled:opacity-50`}
                title="Reload report from server"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                <span className="hidden xs:inline">Refresh</span>
              </button>
              </>
            }
            viewToggle={<ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />}
          />
        </ListPageToolbar>

        <ListPageFilterStrip className="space-y-2">
          <div className="grid w-full min-w-0 grid-cols-2 items-end gap-2 md:gap-3 lg:grid-cols-4 lg:gap-3">
            <div className="min-w-0 w-full">
              <SearchableSelect
                multiple
                compactMulti
                showAllOption
                variant="toolbar"
                className="w-full min-w-0"
                label={filterLabels.item}
                placeholder="Search items..."
                value={filters.item_dcodes}
                onChange={(ids) => setMultiFilter("item_dcodes", ids)}
                onDropdownOpen={prefetchItemOptions}
                onDropdownIntent={prefetchItemOptions}
                fetchService={itemFetchService}
                getByIdService={itemGetById}
                dataKey="id"
                labelKey="item_code"
                subLabelKey="item_desc"
              />
            </div>
            <div className="min-w-0 w-full">
              <SearchableSelect
                multiple
                compactMulti
                showAllOption
                variant="toolbar"
                className="w-full min-w-0"
                label={filterLabels.customer}
                placeholder="Search customers..."
                value={filters.customer_codes}
                onChange={(ids) => setMultiFilter("customer_codes", ids)}
                onDropdownOpen={prefetchCustomerOptions}
                onDropdownIntent={prefetchCustomerOptions}
                fetchService={customerFetchService}
                getByIdService={customerGetById}
                dataKey="id"
                labelKey="acc_name"
                labelOnlyDisplay
              />
            </div>
            <div className="min-w-0 w-full">
              <SearchableSelect
                multiple
                compactMulti
                showAllOption
                variant="toolbar"
                className="w-full min-w-0"
                label={filterLabels.location}
                placeholder="Search locations..."
                value={filters.location_ids}
                onChange={(ids) => setMultiFilter("location_ids", ids)}
                onDropdownOpen={prefetchLocationOptions}
                onDropdownIntent={prefetchLocationOptions}
                fetchService={locationFetchService}
                getByIdService={locationGetById}
                dataKey="id"
                labelKey="location_no"
              />
            </div>
            <div className="min-w-0 w-full">
              <SearchableSelect
                multiple
                compactMulti
                showAllOption
                variant="toolbar"
                className="w-full min-w-0"
                label={filterLabels.packing}
                placeholder="Search packings..."
                value={filters.packing_numbers}
                onChange={(ids) => setMultiFilter("packing_numbers", ids)}
                onDropdownOpen={prefetchPackingOptions}
                onDropdownIntent={prefetchPackingOptions}
                fetchService={packingFetchService}
                getByIdService={packingGetById}
                dataKey="id"
                labelKey="packing_number"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={handleReset}
              className="h-8 px-3 border border-slate-300 bg-white text-slate-700 text-[11px] font-semibold rounded-md hover:bg-slate-100 transition-colors"
            >
              Clear all filters
            </button>
          </div>
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS}
            data={rows}
            allowCopy={true}
            loading={loading || loadingMore}
            centerLoadingOverlay={!loadingMore}
            showSelection={false}
            viewMode={viewMode}
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            onSort={(key) =>
              setParams((p) => ({
                ...p,
                sortKey: key,
                sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
              }))
            }
            emptyIcon={BarChart3}
            emptyMessage={serverTotal ? "No rows on this page" : "No data yet"}
            emptySubMessage={
              serverTotal
                ? "Change or clear a filter, or click Refresh."
                : "Adjust filters or click Refresh to load inventory."
            }
            hasMore={rows.length < serverTotal}
            onLoadMore={handleLoadMore}
            totalItems={serverTotal}
            getRowId={(row, i) => String(row?.id ?? row?.packing_number ?? `r-${i}`)}
            cardConfig={{
              titleKey: "packing_number",
              badgeIndices: [6],
              detailKeys: [
                "doc_dt",
                "item_code",
                "item_desc",
                "customer_name",
                "location_details",
                "in_store_qty",
                "packing_area_qty",
              ],
              className: "rounded-none border border-slate-200 shadow-none",
            }}
          />
          <div className="shrink-0 border-t border-indigo-200 bg-indigo-50/80 px-2 py-1.5 sm:border-t-2 sm:px-3 sm:py-2.5">
            <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-wide sm:tracking-widest text-indigo-700 mb-1 sm:mb-2 leading-tight">
              {hasActiveFilters ? "Total (filtered)" : "Total (all)"}
              {!loading && serverTotal ? (
                <span className="block sm:inline font-normal text-slate-500 normal-case tracking-normal text-[7px] sm:text-[9px]">
                  {hasActiveFilters ? "Filters on · " : ""}
                  {rows.length.toLocaleString()} / {serverTotal.toLocaleString()} packing
                </span>
              ) : null}
            </p>
            <div className="grid grid-cols-3 gap-1 sm:gap-3">
              <div className="rounded-md sm:rounded-lg border border-slate-200 bg-white px-1.5 py-1 sm:px-3 sm:py-2 shadow-sm min-w-0">
                <p className="text-[7px] sm:text-[9px] font-bold uppercase text-slate-500 tracking-wide leading-tight">Total Stock</p>
                <p className="text-[9px] sm:text-lg font-black text-slate-800 tabular-nums leading-none whitespace-nowrap overflow-x-auto max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {formatQty(serverTotals.fg_stock_qty)}
                </p>
                <p className="hidden sm:block text-[8px] text-slate-400 font-medium mt-0.5">In store + packing area</p>
              </div>
              <div className="rounded-md sm:rounded-lg border border-emerald-200 bg-white px-1.5 py-1 sm:px-3 sm:py-2 shadow-sm min-w-0">
                <p className="text-[7px] sm:text-[9px] font-bold uppercase text-emerald-700 tracking-wide leading-tight">In Store</p>
                <p className="text-[9px] sm:text-lg font-black text-emerald-800 tabular-nums leading-none whitespace-nowrap overflow-x-auto max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {formatQty(serverTotals.in_store_qty)}
                </p>
                <p className="hidden sm:block text-[8px] text-slate-400 font-medium mt-0.5">On rack / shelf</p>
              </div>
              <div className="rounded-md sm:rounded-lg border border-amber-200 bg-white px-1.5 py-1 sm:px-3 sm:py-2 shadow-sm min-w-0">
                <p className="text-[7px] sm:text-[9px] font-bold uppercase text-amber-700 tracking-wide leading-tight">Packing Area</p>
                <p className="text-[9px] sm:text-lg font-black text-amber-800 tabular-nums leading-none whitespace-nowrap overflow-x-auto max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {formatQty(serverTotals.packing_area_qty)}
                </p>
                <p className="hidden sm:block text-[8px] text-slate-400 font-medium mt-0.5">Not on rack yet</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

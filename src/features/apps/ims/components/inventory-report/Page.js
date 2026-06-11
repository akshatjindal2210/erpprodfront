"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import DataTable from "@/core/components/ui/DataTable";
import { ListPageToolbar, ListPageToolbarLayout, LIST_PAGE_ACTION_CLASS } from "@/core/components/common/ListPageToolbar";
import SearchableSelect from "@/core/components/common/SearchableSelect";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useViewMode } from "@/core/hooks/useViewMode";
import { inventoryReportService } from "@/features/apps/ims/services/inventoryReport";
import { sortSelectRowsAsc } from "@/core/utils/sortSelectOptions";
import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";
import { applyInventoryView, buildCascadingFilterOptions } from "@/features/apps/ims/components/inventory-report/inventoryReportClient";
import { notifyListPageExportResult } from "@/core/utils/listPageExport";
import { exportInventoryReport, formatInventoryTableCell, INVENTORY_REPORT_TABLE_COLUMNS } from "@/features/apps/ims/components/inventory-report/inventoryReportExport";

const PAGE_SIZE = 100;

const EMPTY_FILTERS = {
  item_dcodes: [],
  customer_codes: [],
  location_ids: [],
  packing_numbers: [],
};

function filterLabelWithCount(label, count) {
  return `${label} (${Number(count) || 0})`;
}

function normalizeMultiFilterIds(value) {
  if (value == null) return [];
  const list = Array.isArray(value) ? value : [value];
  return [...new Set(list.map((v) => String(v).trim()).filter(Boolean))];
}

export default function InventoryReportPage() {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, handleViewMode] = useViewMode();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [params, setParams] = useState({
    sortKey: "packing_number",
    sortDir: "desc",
  });

  const loadGenRef = useRef(0);
  const [exporting, setExporting] = useState(false);

  const loadAllData = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setLoading(true);
    try {
      const body = await inventoryReportService.fetchAll();
      if (gen !== loadGenRef.current) return;

      if (!body?.success) {
        throw new Error(body?.message || "Report failed");
      }

      const rows = Array.isArray(body.data) ? body.data : [];
      setAllRows(rows);
      setDisplayCount(PAGE_SIZE);

      if (!rows.length) {
        toast.info("No inventory entries found.");
      }
    } catch (err) {
      if (gen !== loadGenRef.current) return;
      toast.error(err?.message || "Report load failed");
      setAllRows([]);
    } finally {
      if (gen === loadGenRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [filters, params.sortKey, params.sortDir]);

  const view = useMemo(
    () =>
      applyInventoryView(allRows, {
        filters,
        sortKey: params.sortKey,
        sortDir: params.sortDir,
      }),
    [allRows, filters, params.sortKey, params.sortDir]
  );

  const filterOptions = useMemo(
    () => buildCascadingFilterOptions(allRows, filters),
    [allRows, filters]
  );

  const filterOptionsRef = useRef(filterOptions);
  useEffect(() => {
    filterOptionsRef.current = filterOptions;
  }, [filterOptions]);

  const displayRows = useMemo(
    () => view.rows.slice(0, displayCount),
    [view.rows, displayCount]
  );

  const filterLabels = useMemo(
    () => ({
      item: filterLabelWithCount("Item", filterOptions.items.length),
      customer: filterLabelWithCount("Customer", filterOptions.customers.length),
      location: filterLabelWithCount("Store location", filterOptions.locations.length),
      packing: filterLabelWithCount("Packing Entry", filterOptions.packings.length),
    }),
    [filterOptions]
  );

  const handleExport = useCallback(
    async (format) => {
      if (!view.rows.length) {
        toast.info("No rows to export.");
        return;
      }
      setExporting(true);
      try {
        const { filename } = await exportInventoryReport({
          format,
          rows: view.rows,
          totals: view.totals,
          filters,
          filterOptions,
        });
        toast.success(notifyListPageExportResult(format, filename).message);
      } catch (err) {
        toast.error(err?.message || "Export failed.");
      } finally {
        setExporting(false);
      }
    },
    [view.rows, view.totals, filters, filterOptions]
  );

  const handleRefresh = useCallback(() => {
    void loadAllData();
  }, [loadAllData]);

  const handleLoadMore = useCallback(() => {
    if (displayCount >= view.total) return;
    setDisplayCount((c) => c + PAGE_SIZE);
  }, [displayCount, view.total]);

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
  };

  const HEADERS = useMemo(() => {
    return INVENTORY_REPORT_TABLE_COLUMNS.map(({ label, key, type }, index) => {
      const width =
        key === "packing_number"
          ? "130px"
          : key === "doc_dt"
            ? "100px"
            : key === "item_desc" || key === "customer_name" || key === "location_details"
              ? "220px"
              : key === "item_code"
                ? "120px"
                : "110px";
      const isNumber = type === "number";
      const isDate = type === "date";

      return [
        label,
        key,
        (v) => (
          <span
            className={`text-[11px] ${isNumber ? "font-semibold text-slate-800 tabular-nums" : isDate ? "text-slate-600 font-bold text-[10px] uppercase" : "text-slate-700 font-medium"}`}
          >
            {formatInventoryTableCell(type, v)}
          </span>
        ),
        { ...(index === 0 ? { fixed: true } : {}), width },
      ];
    });
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
            viewToggle={
              <ListPageExportToggle
                viewMode={viewMode}
                setMode={handleViewMode}
                exporting={exporting}
                disabled={loading || !view.total}
                onExport={handleExport}
              />
            }
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
            data={displayRows}
            allowCopy={true}
            loading={loading}
            centerLoadingOverlay={true}
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
            emptyMessage={allRows.length ? "No rows match filters" : "No data yet"}
            emptySubMessage={
              allRows.length
                ? "Change or clear a filter, or click Refresh."
                : "Click Refresh to load inventory from server."
            }
            hasMore={displayRows.length < view.total}
            onLoadMore={handleLoadMore}
            totalItems={view.total}
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
              {!loading && allRows.length ? (
                <span className="block sm:inline font-normal text-slate-500 normal-case tracking-normal text-[7px] sm:text-[9px]">
                  {hasActiveFilters ? "Filters on · " : ""}
                  {displayRows.length.toLocaleString()} / {view.total.toLocaleString()} packing
                </span>
              ) : null}
            </p>
            <div className="grid grid-cols-3 gap-1 sm:gap-3">
              <div className="rounded-md sm:rounded-lg border border-slate-200 bg-white px-1.5 py-1 sm:px-3 sm:py-2 shadow-sm min-w-0">
                <p className="text-[7px] sm:text-[9px] font-bold uppercase text-slate-500 tracking-wide leading-tight">Total Stock</p>
                <p className="text-[9px] sm:text-lg font-black text-slate-800 tabular-nums leading-none whitespace-nowrap overflow-x-auto max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {formatQty(view.totals.fg_stock_qty)}
                </p>
                <p className="hidden sm:block text-[8px] text-slate-400 font-medium mt-0.5">In store + packing area</p>
              </div>
              <div className="rounded-md sm:rounded-lg border border-emerald-200 bg-white px-1.5 py-1 sm:px-3 sm:py-2 shadow-sm min-w-0">
                <p className="text-[7px] sm:text-[9px] font-bold uppercase text-emerald-700 tracking-wide leading-tight">In Store</p>
                <p className="text-[9px] sm:text-lg font-black text-emerald-800 tabular-nums leading-none whitespace-nowrap overflow-x-auto max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {formatQty(view.totals.in_store_qty)}
                </p>
                <p className="hidden sm:block text-[8px] text-slate-400 font-medium mt-0.5">On rack / shelf</p>
              </div>
              <div className="rounded-md sm:rounded-lg border border-amber-200 bg-white px-1.5 py-1 sm:px-3 sm:py-2 shadow-sm min-w-0">
                <p className="text-[7px] sm:text-[9px] font-bold uppercase text-amber-700 tracking-wide leading-tight">Packing Area</p>
                <p className="text-[9px] sm:text-lg font-black text-amber-800 tabular-nums leading-none whitespace-nowrap overflow-x-auto max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {formatQty(view.totals.packing_area_qty)}
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

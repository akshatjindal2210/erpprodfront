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
import { fetchAllListPages, sortRowsByKey } from "@/features/apps/ims/helpers/clientListSearch";
import { sortSelectRowsAsc } from "@/core/utils/sortSelectOptions";
import { IMS_LIST_PAGE_SHELL } from "@/features/apps/ims/helpers/listPageShellClasses";
import {
  buildInventoryFilterOptionsFromRows,
  computeInventoryTotals,
  EMPTY_FILTERS,
  filterInventoryRows,
  hasActiveInventoryFilters,
  normalizeMultiFilterIds,
} from "@/features/apps/ims/components/inventory-report/inventoryReportClient";
import { notifyListPageExportResult } from "@/core/utils/listPageExport";
import { exportInventoryReport, formatInventoryTableCell, INVENTORY_REPORT_TABLE_COLUMNS } from "@/features/apps/ims/components/inventory-report/inventoryReportExport";

/** Backend fetch chunk (hidden from user). */
const FETCH_PAGE_SIZE = 1000;
/** Table scroll — render more rows on scroll (no server call). */
const TABLE_RENDER_CHUNK = 150;

function filterLabelWithCount(label, count) {
  return `${label} (${Number(count) || 0})`;
}

export default function InventoryReportPage() {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [displayLimit, setDisplayLimit] = useState(TABLE_RENDER_CHUNK);
  const [params, setParams] = useState({
    sortKey: "packing_number",
    sortDir: "desc",
  });
  const [exporting, setExporting] = useState(false);

  const loadGenRef = useRef(0);

  const allItemOptions = useMemo(() => {
    const byCode = new Map();
    for (const row of allRows) {
      const id = String(row?.item_dcode ?? row?.item_code ?? "").trim();
      const itemCode = String(row?.item_code ?? row?.item_dcode ?? id).trim();
      if (!id || id === "—" || !itemCode || itemCode === "—") continue;
      const key = itemCode.toUpperCase();
      if (!byCode.has(key)) {
        byCode.set(key, { id, item_code: itemCode, item_desc: row?.item_desc ?? null });
      }
    }
    return sortSelectRowsAsc([...byCode.values()], "item_code", ["item_desc"]);
  }, [allRows]);

  const filterOptions = useMemo(
    () => buildInventoryFilterOptionsFromRows(allRows, filters),
    [allRows, filters]
  );

  const filteredRows = useMemo(
    () => filterInventoryRows(allRows, filters, allItemOptions),
    [allRows, filters, allItemOptions]
  );

  const sortedRows = useMemo(
    () => sortRowsByKey(filteredRows, params.sortKey, params.sortDir),
    [filteredRows, params.sortKey, params.sortDir]
  );

  const displayRows = useMemo(
    () => sortedRows.slice(0, displayLimit),
    [sortedRows, displayLimit]
  );

  const totals = useMemo(() => computeInventoryTotals(filteredRows), [filteredRows]);
  const hasActiveFilters = useMemo(() => hasActiveInventoryFilters(filters), [filters]);
  const tableHasMore = displayRows.length < sortedRows.length;

  const loadAllRows = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setLoading(true);
    setAllRows([]);
    setDisplayLimit(TABLE_RENDER_CHUNK);

    try {
      const { data } = await fetchAllListPages(
        async (page, limit) => {
          const body = await inventoryReportService.list({
            page,
            limit,
            filters: {},
            sortKey: "packing_number",
            sortDir: "desc",
            includeTotals: false,
          });
          return { data: body?.data ?? [], total: body?.total ?? 0 };
        },
        FETCH_PAGE_SIZE,
        50000
      );

      if (gen !== loadGenRef.current) return;

      const rows = Array.isArray(data) ? data : [];
      setAllRows(rows);
      if (!rows.length) toast.info("No inventory entries found.");
    } catch (err) {
      if (gen !== loadGenRef.current) return;
      toast.error(err?.message || "Report load failed");
      setAllRows([]);
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllRows();
  }, [loadAllRows]);

  const handleRefresh = useCallback(() => {
    void loadAllRows();
  }, [loadAllRows]);

  const handleLoadMore = useCallback(() => {
    if (tableHasMore) setDisplayLimit((n) => n + TABLE_RENDER_CHUNK);
  }, [tableHasMore]);

  const handleExport = useCallback(
    async (format) => {
      if (!sortedRows.length) {
        toast.info("No rows to export.");
        return;
      }
      setExporting(true);
      try {
        const { filename } = await exportInventoryReport({
          format,
          rows: sortedRows,
          totals,
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
    [sortedRows, totals, filters, filterOptions]
  );

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setDisplayLimit(TABLE_RENDER_CHUNK);
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
            className={`text-[11px] ${isNumber ? "font-semibold text-slate-800 tabular-nums" : isDate ? "text-slate-600 font-semibold tabular-nums" : "text-slate-700 font-medium"}`}
          >
            {formatInventoryTableCell(type, v)}
          </span>
        ),
        { ...(index === 0 ? { fixed: true } : {}), width },
      ];
    });
  }, []);

  const formatQty = (n) => {
    const x = Number(n);
    return (Number.isFinite(x) ? x : 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const makeFetchService = useCallback(
    (listKey, labelKey, subLabelKey = "") => {
      return async ({ search = "", page: optPage = 1, limit = 50 } = {}) => {
        const list = filterOptions[listKey] || [];
        const q = String(search || "").trim().toLowerCase();
        const filtered = q
          ? list.filter((row) => {
              const a = String(row?.[labelKey] || "").toLowerCase();
              const b = subLabelKey ? String(row?.[subLabelKey] || "").toLowerCase() : "";
              return a.includes(q) || b.includes(q);
            })
          : list;
        const sorted = sortSelectRowsAsc(filtered, labelKey, subLabelKey ? [subLabelKey] : []);
        const start = (Math.max(1, Number(optPage) || 1) - 1) * (Number(limit) || 50);
        return { data: sorted.slice(start, start + (Number(limit) || 50)) };
      };
    },
    [filterOptions]
  );

  const makeGetByIdService = useCallback(
    (listKey) => {
      return async (id) => {
        const list = filterOptions[listKey] || [];
        const match = list.find((row) => String(row?.id) === String(id));
        return { data: match || null };
      };
    },
    [filterOptions]
  );

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
    setDisplayLimit(TABLE_RENDER_CHUNK);
    setFilters((prev) => ({
      ...prev,
      [key]: normalizeMultiFilterIds(value),
    }));
  }, []);

  const filterLabels = useMemo(
    () => ({
      item: filterLabelWithCount("Item", filterOptions.items.length),
      customer: filterLabelWithCount("Customer", filterOptions.customers.length),
      location: filterLabelWithCount("Store location", filterOptions.locations.length),
      packing: filterLabelWithCount("Packing Entry", filterOptions.packings.length),
    }),
    [filterOptions]
  );

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
                  title="Reload full report from server"
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
                disabled={loading || !sortedRows.length}
                onExport={handleExport}
              />
            }
          />
        </ListPageToolbar>

        <ListPageFilterStrip className="space-y-2">
          <div className="grid w-full min-w-0 grid-cols-2 items-end gap-2 md:gap-3 lg:grid-cols-4 lg:gap-3">
            <div className="min-w-0 w-full">
              <SearchableSelect
                key={`inv-item-${filterOptions.items.length}-${allRows.length}`}
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
                disabled={loading}
              />
            </div>
            <div className="min-w-0 w-full">
              <SearchableSelect
                key={`inv-customer-${filterOptions.customers.length}-${allRows.length}`}
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
                disabled={loading}
              />
            </div>
            <div className="min-w-0 w-full">
              <SearchableSelect
                key={`inv-location-${filterOptions.locations.length}-${allRows.length}`}
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
                disabled={loading}
              />
            </div>
            <div className="min-w-0 w-full">
              <SearchableSelect
                key={`inv-packing-${filterOptions.packings.length}-${allRows.length}`}
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
                disabled={loading}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="h-8 px-3 border border-slate-300 bg-white text-slate-700 text-[11px] font-semibold rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50"
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
            suppressLoadingFooterRow={true}
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
            emptyMessage={hasActiveFilters ? "No rows match filters" : "No data yet"}
            emptySubMessage={
              hasActiveFilters
                ? "Change or clear a filter, or click Refresh."
                : "Click Refresh if the report is empty."
            }
            hasMore={tableHasMore}
            onLoadMore={handleLoadMore}
            totalItems={sortedRows.length}
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
                "qc_hold_qty",
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
                  {sortedRows.length.toLocaleString()} rows
                </span>
              ) : null}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-3">
              <div className="rounded-md sm:rounded-lg border border-slate-200 bg-white px-1.5 py-1 sm:px-3 sm:py-2 shadow-sm min-w-0">
                <p className="text-[7px] sm:text-[9px] font-bold uppercase text-slate-500 tracking-wide leading-tight">Total Stock</p>
                <p className="text-[9px] sm:text-lg font-black text-slate-800 tabular-nums leading-none whitespace-nowrap overflow-x-auto max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {formatQty(totals.fg_stock_qty)}
                </p>
                <p className="hidden sm:block text-[8px] text-slate-400 font-medium mt-0.5">In store + packing area</p>
              </div>
              <div className="rounded-md sm:rounded-lg border border-emerald-200 bg-white px-1.5 py-1 sm:px-3 sm:py-2 shadow-sm min-w-0">
                <p className="text-[7px] sm:text-[9px] font-bold uppercase text-emerald-700 tracking-wide leading-tight">In Store</p>
                <p className="text-[9px] sm:text-lg font-black text-emerald-800 tabular-nums leading-none whitespace-nowrap overflow-x-auto max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {formatQty(totals.in_store_qty)}
                </p>
                <p className="hidden sm:block text-[8px] text-slate-400 font-medium mt-0.5">On rack / shelf</p>
              </div>
              <div className="rounded-md sm:rounded-lg border border-amber-200 bg-white px-1.5 py-1 sm:px-3 sm:py-2 shadow-sm min-w-0">
                <p className="text-[7px] sm:text-[9px] font-bold uppercase text-amber-700 tracking-wide leading-tight">Packing Area</p>
                <p className="text-[9px] sm:text-lg font-black text-amber-800 tabular-nums leading-none whitespace-nowrap overflow-x-auto max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {formatQty(totals.packing_area_qty)}
                </p>
                <p className="hidden sm:block text-[8px] text-slate-400 font-medium mt-0.5">Not on rack yet</p>
              </div>
              <div className="rounded-md sm:rounded-lg border border-rose-200 bg-white px-1.5 py-1 sm:px-3 sm:py-2 shadow-sm min-w-0">
                <p className="text-[7px] sm:text-[9px] font-bold uppercase text-rose-700 tracking-wide leading-tight">QC Hold Area</p>
                <p className="text-[9px] sm:text-lg font-black text-rose-800 tabular-nums leading-none whitespace-nowrap overflow-x-auto max-w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {formatQty(totals.qc_hold_qty)}
                </p>
                <p className="hidden sm:block text-[8px] text-slate-400 font-medium mt-0.5">On QC hold</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

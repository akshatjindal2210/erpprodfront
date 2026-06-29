"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useDeferredValue, startTransition } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import DataTable from "@/core/components/ui/DataTable";
import { ListPageToolbar, ListPageToolbarLayout, LIST_PAGE_ACTION_CLASS } from "@/core/components/common/ListPageToolbar";
import SearchableSelect from "@/core/components/common/SearchableSelect";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import ListPageExportToggle from "@/core/components/common/ListPageExportToggle";
import { useViewMode } from "@/core/hooks/useViewMode";
import { erpStockReportService } from "@/features/apps/ims/services/erpStockReport";
import { IMS_LIST_PAGE_SHELL, IMS_TABLE_CELL_DATE, IMS_TABLE_CELL_NUMBER, IMS_TABLE_CELL_TEXT } from "@/features/apps/ims/helpers/listPageShellClasses";
import { notifyListPageExportResult } from "@/core/utils/listPageExport";
import { sortSelectRowsAsc } from "@/core/utils/sortSelectOptions";
import { ERP_STOCK_REPORT_TABLE_COLUMNS, exportErpStockReport, formatErpStockTableCell, erpStockRowClassName, stockDiffCellClass } from "@/features/apps/ims/components/erp-stock-report/erpStockReportExport";
import { EMPTY_FILTERS, buildErpStockBaseMeta, buildErpStockFilterOptions, deriveErpStockView, hasActiveErpStockFilters,
  readErpStockReportSessionCache, writeErpStockReportSessionCache } from "@/features/apps/ims/components/erp-stock-report/erpStockReportClient";
import { normalizeMultiFilterIds } from "@/features/apps/ims/components/inventory-report/inventoryReportClient";

const LOAD_LIMIT = 10000;
const TABLE_RENDER_CHUNK = 100;

function filterLabel(label, count) {
  return `${label} (${Number(count) || 0})`;
}

function tableCellClass(type) {
  if (type === "number") return IMS_TABLE_CELL_NUMBER;
  if (type === "date") return IMS_TABLE_CELL_DATE;
  return IMS_TABLE_CELL_TEXT;
}

const MISMATCH_FILTER_DEFS = [
  { id: "all", label: "All rows" },
  { id: "any", label: "All mismatch" },
  { id: "red", label: "DB > ERP" },
  { id: "yellow", label: "ERP > DB" },
];

function mismatchCountForId(id, rowCount, mismatchStats) {
  if (id === "all") return rowCount;
  if (id === "any") return mismatchStats.mismatch;
  if (id === "red") return mismatchStats.red;
  if (id === "yellow") return mismatchStats.yellow;
  return 0;
}

function formatQty(n) {
  const x = Number(n);
  return (Number.isFinite(x) ? x : 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function ErpStockReportPage() {
  const initialCache = useMemo(() => readErpStockReportSessionCache(), []);
  const [allRows, setAllRows] = useState(() => initialCache?.rows ?? []);
  const [loading, setLoading] = useState(() => !initialCache?.rows?.length);
  const [backgroundRefreshing, setBackgroundRefreshing] = useState(() => Boolean(initialCache?.rows?.length));
  const [viewMode, handleViewMode] = useViewMode();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const deferredFilters = useDeferredValue(filters);
  const [displayLimit, setDisplayLimit] = useState(TABLE_RENDER_CHUNK);
  const [params, setParams] = useState({ sortKey: "packing_number", sortDir: "desc" });
  const [exporting, setExporting] = useState(false);
  const loadGenRef = useRef(0);
  const allRowsRef = useRef(allRows);
  allRowsRef.current = allRows;

  const baseMeta = useMemo(() => buildErpStockBaseMeta(allRows), [allRows]);

  const filterOptions = useMemo(
    () => buildErpStockFilterOptions(allRows, deferredFilters, baseMeta),
    [allRows, deferredFilters, baseMeta]
  );

  const { sortedRows, totals } = useMemo(
    () =>
      deriveErpStockView(
        allRows,
        deferredFilters,
        baseMeta.itemOptions,
        params.sortKey,
        params.sortDir
      ),
    [allRows, deferredFilters, baseMeta.itemOptions, params.sortKey, params.sortDir]
  );

  const displayRows = useMemo(
    () => sortedRows.slice(0, displayLimit),
    [sortedRows, displayLimit]
  );

  const mismatchStats = baseMeta.mismatchStats;
  const hasActiveFilters = useMemo(() => hasActiveErpStockFilters(deferredFilters), [deferredFilters]);
  const filtersPending = filters !== deferredFilters;
  const tableHasMore = displayRows.length < sortedRows.length;

  const loadAllRows = useCallback(async ({ refresh = false } = {}) => {
    const gen = ++loadGenRef.current;
    const hasVisibleRows = allRowsRef.current.length > 0;
    const cached = !refresh ? readErpStockReportSessionCache() : null;
    const hasCachedRows = Boolean(cached?.rows?.length);

    if (refresh) {
      if (!hasVisibleRows) {
        setLoading(true);
        setAllRows([]);
        setDisplayLimit(TABLE_RENDER_CHUNK);
      } else {
        setBackgroundRefreshing(true);
      }
    } else if (hasCachedRows) {
      setAllRows(cached.rows);
      setLoading(false);
      setBackgroundRefreshing(true);
    } else {
      setLoading(true);
      setAllRows([]);
      setDisplayLimit(TABLE_RENDER_CHUNK);
      setBackgroundRefreshing(false);
    }

    try {
      const body = await erpStockReportService.list({
        page: 1,
        limit: LOAD_LIMIT,
        sortKey: "packing_number",
        sortDir: "desc",
        refresh,
        refreshErp: refresh,
      });

      if (gen !== loadGenRef.current) return;

      const rows = Array.isArray(body?.data) ? body.data : [];
      setAllRows(rows);
      if (rows.length) writeErpStockReportSessionCache(rows, body?.total);
      if (!rows.length) toast.info("No ERP stock comparison rows found.");
      else if (Number(body?.total) > rows.length) {
        toast.info(`Showing first ${rows.length.toLocaleString()} of ${Number(body.total).toLocaleString()} rows.`);
      }
    } catch (err) {
      if (gen !== loadGenRef.current) return;
      if (!hasVisibleRows && !hasCachedRows) {
        toast.error(err?.message || "Report load failed");
        setAllRows([]);
      } else {
        toast.warn(err?.message || "Could not refresh — showing previous data.");
      }
    } finally {
      if (gen === loadGenRef.current) {
        setLoading(false);
        setBackgroundRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadAllRows();
  }, [loadAllRows]);

  const mismatchOptions = useMemo(
    () =>
      MISMATCH_FILTER_DEFS.map(({ id, label }) => ({
        id,
        label:
          !loading && allRows.length
            ? `${label} (${mismatchCountForId(id, allRows.length, mismatchStats).toLocaleString()})`
            : label,
      })),
    [allRows.length, mismatchStats, loading]
  );

  const mismatchFetchService = useCallback(
    async ({ search = "" } = {}) => {
      const q = String(search || "").trim().toLowerCase();
      const list = q
        ? mismatchOptions.filter((o) => o.label.toLowerCase().includes(q))
        : mismatchOptions;
      return { data: list };
    },
    [mismatchOptions]
  );

  const mismatchGetById = useCallback(
    async (id) => {
      const match = mismatchOptions.find((o) => String(o.id) === String(id));
      return { data: match || null };
    },
    [mismatchOptions]
  );

  const makeFetchService = useCallback(
    (listKey, labelKey, subLabelKey = "") =>
      async ({ search = "", page: optPage = 1, limit = 50 } = {}) => {
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
      },
    [filterOptions]
  );

  const makeGetByIdService = useCallback(
    (listKey) => async (id) => {
      const match = (filterOptions[listKey] || []).find((row) => String(row?.id) === String(id));
      return { data: match || null };
    },
    [filterOptions]
  );

  const itemFetchService = useMemo(
    () => makeFetchService("items", "item_code", "item_desc"),
    [makeFetchService]
  );
  const packingFetchService = useMemo(
    () => makeFetchService("packings", "packing_number"),
    [makeFetchService]
  );
  const itemGetById = useMemo(() => makeGetByIdService("items"), [makeGetByIdService]);
  const packingGetById = useMemo(() => makeGetByIdService("packings"), [makeGetByIdService]);

  const setMultiFilter = useCallback((key, value) => {
    startTransition(() => {
      setDisplayLimit(TABLE_RENDER_CHUNK);
      setFilters((prev) => ({ ...prev, [key]: normalizeMultiFilterIds(value) }));
    });
  }, []);

  const setMismatchFilter = useCallback((mismatch) => {
    startTransition(() => {
      setDisplayLimit(TABLE_RENDER_CHUNK);
      setFilters((prev) => ({ ...prev, mismatch: mismatch || "" }));
    });
  }, []);

  const handleExport = useCallback(
    async (format) => {
      if (!sortedRows.length) {
        toast.info("No rows to export.");
        return;
      }
      setExporting(true);
      try {
        const { filename } = await exportErpStockReport({ format, rows: sortedRows });
        toast.success(notifyListPageExportResult(format, filename).message);
      } catch (err) {
        toast.error(err?.message || "Export failed.");
      } finally {
        setExporting(false);
      }
    },
    [sortedRows]
  );

  const HEADERS = useMemo(
    () =>
      ERP_STOCK_REPORT_TABLE_COLUMNS.map(({ label, key, type }, index) => [
        label,
        key,
        (v) => {
          if (type === "diff") {
            return (
              <span className={`text-[11px] tabular-nums ${stockDiffCellClass(v)}`}>
                {formatErpStockTableCell(type, v)}
              </span>
            );
          }
          return (
            <span className={tableCellClass(type)}>{formatErpStockTableCell(type, v)}</span>
          );
        },
        {
          ...(index === 0 ? { fixed: true } : {}),
          width:
            key === "item_desc"
              ? "200px"
              : type === "number" || type === "diff"
                ? "96px"
                : key === "packing_number"
                  ? "130px"
                  : key === "doc_dt"
                    ? "100px"
                    : "88px",
        },
      ]),
    []
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
                    <h1 className="text-sm font-bold text-slate-800 leading-tight">ERP Stock Report</h1>
                    <p className="text-[10px] text-slate-500 font-medium truncate">
                      Compare ERP FG stock with in-hand DB stock
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadAllRows({ refresh: true })}
                  disabled={loading || backgroundRefreshing}
                  className={`${LIST_PAGE_ACTION_CLASS} px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 disabled:opacity-50`}
                  title="Reload report from server"
                >
                  <RefreshCw size={14} className={loading || backgroundRefreshing ? "animate-spin" : ""} />
                  <span className="hidden xs:inline">
                    {backgroundRefreshing ? "Updating…" : "Refresh"}
                  </span>
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
          <div className="grid w-full min-w-0 grid-cols-1 items-end gap-2 sm:grid-cols-2 md:gap-3 lg:grid-cols-3 lg:gap-3">
            <div className="min-w-0 w-full">
              <SearchableSelect
                multiple
                compactMulti
                showAllOption
                variant="toolbar"
                className="w-full min-w-0"
                label={filterLabel("Item", filterOptions.items.length)}
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
                multiple
                compactMulti
                showAllOption
                variant="toolbar"
                className="w-full min-w-0"
                label={filterLabel("Packing Entry", filterOptions.packings.length)}
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
            <div className="min-w-0 w-full">
              <SearchableSelect
                variant="toolbar"
                className="w-full min-w-0"
                label="Mismatch"
                placeholder="All rows..."
                value={filters.mismatch || "all"}
                onChange={(id) => setMismatchFilter(id === "all" ? "" : id)}
                fetchService={mismatchFetchService}
                getByIdService={mismatchGetById}
                dataKey="id"
                labelKey="label"
                disabled={loading}
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 flex-wrap pt-1">
            {filtersPending ? (
              <span className="text-[10px] text-indigo-600 font-semibold animate-pulse mr-auto">
                Updating…
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => {
                startTransition(() => {
                  setFilters(EMPTY_FILTERS);
                  setDisplayLimit(TABLE_RENDER_CHUNK);
                });
              }}
              disabled={loading}
              className="h-8 px-3 border border-slate-300 bg-white text-slate-700 text-[11px] font-semibold rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50 shrink-0"
            >
              Clear all filters
            </button>
          </div>
        </ListPageFilterStrip>

        {/* 
        {!loading && allRows.length > 0 ? (
          <div className="px-3 py-1.5 border-b border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-slate-600">
            <span>
              <span className="text-slate-400 uppercase text-[9px] font-bold mr-1">Match</span>
              {mismatchStats.match.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300" />
              DB &gt; ERP: {mismatchStats.red.toLocaleString()}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-200" />
              ERP &gt; DB: {mismatchStats.yellow.toLocaleString()}
            </span>
          </div>
        ) : null}
        */}

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS}
            data={displayRows}
            loading={loading}
            centerLoadingOverlay
            suppressLoadingFooterRow
            viewMode={viewMode}
            allowCopy
            showSelection={false}
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            onSort={(key) =>
              startTransition(() =>
                setParams((p) => ({
                  sortKey: key,
                  sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                }))
              )
            }
            getRowId={(row, i) => `${row.packing_number}-${row.item_dcode}-${i}`}
            getRowClassName={erpStockRowClassName}
            onLoadMore={() => setDisplayLimit((n) => n + TABLE_RENDER_CHUNK)}
            hasMore={tableHasMore}
            totalItems={sortedRows.length}
            emptyIcon={BarChart3}
            emptyMessage={hasActiveFilters ? "No rows match filters" : "No comparison rows"}
            emptySubMessage={
              hasActiveFilters
                ? "Change or clear a filter, or click Refresh."
                : "ERP and in-hand stock match, or click Refresh."
            }
          />

          <div className="shrink-0 border-t border-indigo-200 bg-indigo-50/80 px-2 py-1.5 sm:border-t-2 sm:px-3 sm:py-2.5">
            <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-wide text-indigo-700 mb-1 sm:mb-2">
              {hasActiveFilters ? "Total (filtered)" : "Total (all)"}
              {!loading && allRows.length ? (
                <span className="block sm:inline font-normal text-slate-500 normal-case tracking-normal text-[7px] sm:text-[9px]">
                  {hasActiveFilters ? "Filters on · " : ""}
                  {sortedRows.length.toLocaleString()} rows
                </span>
              ) : null}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 sm:gap-3">
              <div className="rounded-md sm:rounded-lg border border-slate-200 bg-white px-1.5 py-1 sm:px-3 sm:py-2 shadow-sm min-w-0">
                <p className="text-[7px] sm:text-[9px] font-bold uppercase text-slate-500">ERP Stock</p>
                <p className="text-[9px] sm:text-lg font-black text-slate-800 tabular-nums">{formatQty(totals.erp_stock)}</p>
              </div>
              <div className="rounded-md sm:rounded-lg border border-emerald-200 bg-white px-1.5 py-1 sm:px-3 sm:py-2 shadow-sm min-w-0">
                <p className="text-[7px] sm:text-[9px] font-bold uppercase text-emerald-700">DB Stock</p>
                <p className="text-[9px] sm:text-lg font-black text-emerald-800 tabular-nums">{formatQty(totals.db_stock)}</p>
              </div>
              <div className="rounded-md sm:rounded-lg border border-indigo-200 bg-white px-1.5 py-1 sm:px-3 sm:py-2 shadow-sm min-w-0 col-span-2 sm:col-span-1">
                <p className="text-[7px] sm:text-[9px] font-bold uppercase text-indigo-700">Net Diff (DB − ERP)</p>
                <p className="text-[9px] sm:text-lg font-black text-indigo-800 tabular-nums">{formatQty(totals.stock_diff)}</p>
                <p className="hidden sm:block text-[8px] text-slate-400 font-medium mt-0.5">+ more in hand · − more in ERP</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

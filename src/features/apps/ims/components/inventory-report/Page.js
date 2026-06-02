"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import DataTable from "@/core/components/ui/DataTable";
import ViewToggle from "@/core/components/ui/ViewToggle";
import SearchableSelect from "@/core/components/common/SearchableSelect";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import { useViewMode } from "@/core/hooks/useViewMode";
import { inventoryReportService } from "@/features/apps/ims/services/inventoryReport";
import { sortSelectRowsAsc } from "@/core/utils/sortSelectOptions";

const PAGE_SIZE = 100;

const EMPTY_FILTERS = {
  item_dcodes: [],
  customer_codes: [],
  location_ids: [],
  packing_numbers: [],
};

const EMPTY_PICKERS = {
  item_dcodes: null,
  customer_codes: null,
  location_ids: null,
  packing_numbers: null,
};

const EMPTY_TOTALS = {
  fg_stock_qty: 0,
  in_store_qty: 0,
  packing_area_qty: 0,
  out_qty: 0,
};

function toApiFilters(filters) {
  const o = {};
  if (filters.item_dcodes?.length) o.item_dcodes = filters.item_dcodes;
  if (filters.customer_codes?.length) o.customer_codes = filters.customer_codes;
  if (filters.location_ids?.length) o.location_ids = filters.location_ids;
  if (filters.packing_numbers?.length) o.packing_numbers = filters.packing_numbers;
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

export default function InventoryReportPage() {
  const [rows, setRows] = useState([]);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverTotals, setServerTotals] = useState(EMPTY_TOTALS);
  const [loading, setLoading] = useState(false);
  const [viewMode, handleViewMode] = useViewMode();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [pickerValues, setPickerValues] = useState(EMPTY_PICKERS);
  const [filterOptions, setFilterOptions] = useState({
    items: [],
    customers: [],
    locations: [],
    packings: [],
  });

  const [params, setParams] = useState({
    sortKey: "packing_number",
    sortDir: "desc",
  });

  const pageRef = useRef(1);
  const loadGenRef = useRef(0);

  const loadFilterOptions = useCallback(async (apiFilters) => {
    try {
      const res = await inventoryReportService.getFilterOptions(apiFilters);
      if (res?.success) {
        setFilterOptions(normalizeFilterOptions(res.data));
      }
    } catch {
      /* dropdowns optional */
    }
  }, []);

  const loadReport = useCallback(
    async ({ pageNum = 1, append = false } = {}) => {
      const gen = ++loadGenRef.current;
      setLoading(true);
      const apiFilters = toApiFilters(filters);
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
        if (gen === loadGenRef.current) setLoading(false);
      }
    },
    [filters, params.sortKey, params.sortDir]
  );

  useEffect(() => {
    const apiFilters = toApiFilters(filters);
    void loadFilterOptions(apiFilters);
    void loadReport({ pageNum: 1, append: false });
  }, [filters, params.sortKey, params.sortDir, loadFilterOptions, loadReport]);

  const handleRefresh = useCallback(() => {
    void loadFilterOptions(toApiFilters(filters));
    void loadReport({ pageNum: 1, append: false });
  }, [filters, loadFilterOptions, loadReport]);

  const handleLoadMore = useCallback(() => {
    if (loading || rows.length >= serverTotal) return;
    void loadReport({ pageNum: pageRef.current + 1, append: true });
  }, [loading, rows.length, serverTotal, loadReport]);

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setPickerValues(EMPTY_PICKERS);
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
      txt("Packing Entry", "packing_number", "130px"),
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

  const makeFetchService = useCallback((list, labelKey, subLabelKey = "") => {
    return async ({ search = "", page = 1, limit = 50 } = {}) => {
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

  const makeGetByIdService = useCallback((list) => {
    return async (id) => {
      const match = list.find((row) => String(row?.id) === String(id));
      return { data: match || null };
    };
  }, []);

  const setSingleFilter = useCallback((key, value) => {
    const nextVal = value ? String(value) : null;
    setFilters((prev) => ({
      ...prev,
      [key]: nextVal ? [nextVal] : [],
    }));
    setPickerValues((prev) => ({ ...prev, [key]: nextVal }));
  }, []);

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <BarChart3 size={18} className="text-indigo-600 shrink-0" />
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-slate-800 leading-tight">
                  Inventory Report
                </h1>
                <p className="text-[10px] text-slate-500 font-medium truncate">
                  Total Stock = In Store + Packing Area. Loads {PAGE_SIZE} rows per page.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className="rounded-none h-9 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all disabled:opacity-50"
                title="Reload report from server"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
              <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
            </div>
          </div>
        </div>

        <ListPageFilterStrip className="space-y-2">
          <div className="grid w-full min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3">
            <div className="min-w-0 w-full">
              <SearchableSelect
                variant="toolbar"
                className="w-full min-w-0"
                label="Item"
                placeholder="Search item..."
                value={pickerValues.item_dcodes}
                onChange={(v) => setSingleFilter("item_dcodes", v)}
                fetchService={makeFetchService(filterOptions.items, "item_code", "item_desc")}
                getByIdService={makeGetByIdService(filterOptions.items)}
                dataKey="id"
                labelKey="item_code"
                subLabelKey="item_desc"
              />
            </div>
            <div className="min-w-0 w-full">
              <SearchableSelect
                variant="toolbar"
                className="w-full min-w-0"
                label="Customer"
                placeholder="Search customer..."
                value={pickerValues.customer_codes}
                onChange={(v) => setSingleFilter("customer_codes", v)}
                fetchService={makeFetchService(filterOptions.customers, "acc_name")}
                getByIdService={makeGetByIdService(filterOptions.customers)}
                dataKey="id"
                labelKey="acc_name"
              />
            </div>
            <div className="min-w-0 w-full">
              <SearchableSelect
                variant="toolbar"
                className="w-full min-w-0"
                label="Store location"
                placeholder="Search location..."
                value={pickerValues.location_ids}
                onChange={(v) => setSingleFilter("location_ids", v)}
                fetchService={makeFetchService(filterOptions.locations, "location_no")}
                getByIdService={makeGetByIdService(filterOptions.locations)}
                dataKey="id"
                labelKey="location_no"
              />
            </div>
            <div className="min-w-0 w-full">
              <SearchableSelect
                variant="toolbar"
                className="w-full min-w-0"
                label="Packing Entry"
                placeholder="Search packing..."
                value={pickerValues.packing_numbers}
                onChange={(v) => setSingleFilter("packing_numbers", v)}
                fetchService={makeFetchService(filterOptions.packings, "packing_number")}
                getByIdService={makeGetByIdService(filterOptions.packings)}
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
            loading={loading}
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
          />
          <div className="shrink-0 border-t-2 border-indigo-200 bg-indigo-50/80 px-3 py-2.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-700 mb-2">
              {hasActiveFilters ? "Total (filtered)" : "Total (all)"}
              {!loading && serverTotal ? (
                <span className="font-normal text-slate-500 normal-case tracking-normal">
                  {" "}
                  · showing {rows.length.toLocaleString()} of {serverTotal.toLocaleString()} packing
                  {hasActiveFilters ? " (filters on)" : ""}
                </span>
              ) : null}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <p className="text-[9px] font-bold uppercase text-slate-500 tracking-wide">Total Stock</p>
                <p className="text-lg font-black text-slate-800 tabular-nums">{formatQty(serverTotals.fg_stock_qty)}</p>
                <p className="text-[8px] text-slate-400 font-medium mt-0.5">In store + packing area</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2 shadow-sm">
                <p className="text-[9px] font-bold uppercase text-emerald-700 tracking-wide">In Store</p>
                <p className="text-lg font-black text-emerald-800 tabular-nums">{formatQty(serverTotals.in_store_qty)}</p>
                <p className="text-[8px] text-slate-400 font-medium mt-0.5">On rack / shelf</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 shadow-sm">
                <p className="text-[9px] font-bold uppercase text-amber-700 tracking-wide">Packing Area</p>
                <p className="text-lg font-black text-amber-800 tabular-nums">{formatQty(serverTotals.packing_area_qty)}</p>
                <p className="text-[8px] text-slate-400 font-medium mt-0.5">Not on rack yet</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

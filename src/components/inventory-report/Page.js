"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { toast } from "react-toastify";
import DataTable from "@/components/ui/DataTable";
import ViewToggle from "@/components/ui/ViewToggle";
import SearchableSelect from "@/components/common/SearchableSelect";
import ListPageFilterStrip from "@/components/common/ListPageFilterStrip";
import { useViewMode } from "@/hooks/useViewMode";
import { inventoryReportService } from "@/services/inventoryReport";
import { fetchAllListPages } from "@/helpers/clientListSearch";
import {
  applyInventoryView,
  buildFilterOptionsFromRows,
} from "./inventoryReportClient";

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

export default function InventoryReportPage() {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, handleViewMode] = useViewMode();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [pickerValues, setPickerValues] = useState(EMPTY_PICKERS);

  const [params, setParams] = useState({
    sortKey: "packing_number",
    sortDir: "desc",
  });

  const loadAllFromServer = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchAllListPages(
        async (page, limit) => {
          const body = await inventoryReportService.getReport({
            page,
            limit,
            sortBy: "packing_number",
            order: "DESC",
            filters: {},
          });
          if (!body?.success) {
            throw new Error(body?.message || "Report failed");
          }
          const rows = Array.isArray(body?.data) ? body.data : [];
          return {
            data: rows,
            total: Number(body?.total ?? rows.length),
          };
        },
        1000,
        50000
      );
      setAllRows(data);
      if (!data.length) {
        toast.info("No inventory entries found for the current filters.");
      }
    } catch (err) {
      toast.error(err?.message || "Report load failed");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllFromServer();
  }, [loadAllFromServer]);

  const filterOptions = useMemo(() => buildFilterOptionsFromRows(allRows), [allRows]);

  const { rows: items, totals, total: totalItems } = useMemo(
    () =>
      applyInventoryView(allRows, {
        filters,
        sortKey: params.sortKey,
        sortDir: params.sortDir,
      }),
    [allRows, filters, params.sortKey, params.sortDir]
  );

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
      // num("Out / Sold", "out_qty"), // hidden for now
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
      const start = (Math.max(1, Number(page) || 1) - 1) * (Number(limit) || 50);
      return { data: filtered.slice(start, start + (Number(limit) || 50)) };
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
                  Total Stock = In Store + Packing Area.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={loadAllFromServer}
                disabled={loading}
                className="rounded-none h-9 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all disabled:opacity-50"
                title="Reload all data from server"
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
            data={items}
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
            emptyMessage={allRows.length ? "No rows match filters" : "No data yet"}
            emptySubMessage={
              allRows.length
                ? "Change or clear a filter, or click Refresh to reload."
                : "Click Refresh to load inventory from the server."
            }
            hasMore={false}
            totalItems={totalItems}
            getRowId={(row, i) => String(row?.id ?? row?.packing_number ?? `r-${i}`)}
          />
          <div className="shrink-0 border-t-2 border-indigo-200 bg-indigo-50/80 px-3 py-2.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-700 mb-2">
              {hasActiveFilters ? "Total (filtered)" : "Total (all)"}
              {!loading && allRows.length ? (
                <span className="font-normal text-slate-500 normal-case tracking-normal">
                  {" "}
                  · {totalItems.toLocaleString()} row{totalItems === 1 ? "" : "s"}
                  {hasActiveFilters ? ` of ${allRows.length.toLocaleString()}` : ""}
                </span>
              ) : null}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <p className="text-[9px] font-bold uppercase text-slate-500 tracking-wide">Total Stock</p>
                <p className="text-lg font-black text-slate-800 tabular-nums">{formatQty(totals.fg_stock_qty)}</p>
                <p className="text-[8px] text-slate-400 font-medium mt-0.5">In store + packing area</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2 shadow-sm">
                <p className="text-[9px] font-bold uppercase text-emerald-700 tracking-wide">In Store</p>
                <p className="text-lg font-black text-emerald-800 tabular-nums">{formatQty(totals.in_store_qty)}</p>
                <p className="text-[8px] text-slate-400 font-medium mt-0.5">On rack / shelf</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-white px-3 py-2 shadow-sm">
                <p className="text-[9px] font-bold uppercase text-amber-700 tracking-wide">Packing Area</p>
                <p className="text-lg font-black text-amber-800 tabular-nums">{formatQty(totals.packing_area_qty)}</p>
                <p className="text-[8px] text-slate-400 font-medium mt-0.5">Not on rack yet</p>
              </div>
              {/* Out / Sold total — hidden for now
              <div className="rounded-lg border border-rose-200 bg-white px-3 py-2 shadow-sm">
                <p className="text-[9px] font-bold uppercase text-rose-700 tracking-wide">Out / Sold</p>
                <p className="text-lg font-black text-rose-800 tabular-nums">{formatQty(totals.out_qty)}</p>
                <p className="text-[8px] text-slate-400 font-medium mt-0.5">Dispatched or adjusted out</p>
              </div>
              */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

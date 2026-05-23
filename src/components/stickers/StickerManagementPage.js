"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Download, Box, RefreshCcw, Search, Filter, X, Sticker } from "lucide-react";
import { toast } from "react-toastify";

import dayjs from "dayjs";
import { useViewDateFilterDefaults } from "@/helpers/dateFilterDefaults";

import { formatDateTime } from "@/helpers/utilHelper";
import { labelStickerDownloadSource } from "@/global";
import { boxService } from "@/services/box";
import { useViewMode } from "@/hooks/useViewMode";
import ViewToggle from "@/components/ui/ViewToggle";
import DataTable from "@/components/ui/DataTable";
import DateRangeFilter from "../common/DateRangeFilter";
import ListPageFilterStrip from "@/components/common/ListPageFilterStrip";

import { useCanAccess } from "@/hooks/useCanAccess";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/helpers/clientListSearch";

export default function StickerManagementPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("sticker_download_logs", "view"), [canAccess]);

  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 1000,
    fromDate: dateFilterDefaults.from, toDate: dateFilterDefaults.to, sortKey: "last_downloaded_at", sortDir: "desc"
  });

  useEffect(() => {
    if (dateFilterDefaults.from || dateFilterDefaults.to) {
      setParams(prev => ({
        ...prev,
        fromDate: dateFilterDefaults.from,
        toDate: dateFilterDefaults.to
      }));
    }
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const [tempSearch, setTempSearch] = useState("");
  const [displayLimit, setDisplayLimit] = useState(100);

  const fetchStickers = useCallback(async () => {
    setLoading(true);
    try {
      const base = {
        sortBy: params.sortKey || undefined,
        order: params.sortDir,
        filters: {
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
        },
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const res = await boxService.getStickerManagementList({ ...base, page, limit });
        return { data: res?.data ?? [], total: res?.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Failed to load sticker data");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.fromDate, params.toDate]);

  useEffect(() => {
    fetchStickers();
  }, [fetchStickers]);

  const filteredRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    if (q) return applyClientSearch(allRows, tempSearch);
    return sortRowsByKey(allRows, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  const rows = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && rows.length < totalItems) {
      setDisplayLimit((n) => n + 100);
    }
  }, [loading, rows.length, totalItems]);

  const handleFilterApply = (data) => {
    setParams((prev) => ({
      ...prev,
      fromDate: data.fromDate,
      toDate: data.toDate,
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams({
      pageSize: 1000,
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "last_downloaded_at",
      sortDir: "desc",
    });
  };

  const onSort = (key) => {
    setDisplayLimit(100);
    setParams((p) => ({
      ...p,
      sortKey: key,
      sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
    }));
  };

  const HEADERS = [
    ["Sticker UID", "primary_label", (v) => (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded bg-blue-50 text-blue-600 flex items-center justify-center">
          <Sticker size={14} />
        </div>
        <span className="font-bold text-slate-900 uppercase text-[11px]">{v || "—"}</span>
      </div>
    ), { fixed: true, width: "180px" }],

    ["Packing No", "packing_number", (v) => <span className="text-[11px] font-semibold text-slate-700">{v || "—"}</span>, { width: "140px" }],

    ["Customer", "acc_name", (v) => <span className="text-[10px] font-bold text-slate-500 uppercase truncate block">{v || "—"}</span>, { width: "180px" }],

    ["Download Type", "last_download_type", (v, row) => {
      const n = row?.last_bulk_sticker_count != null && Number(row.last_bulk_sticker_count) > 0
        ? Number(row.last_bulk_sticker_count)
        : row?.event_sticker_count != null && Number(row.event_sticker_count) > 0 ? Number(row.event_sticker_count) : null;
      const bulkLabel = v === "bulk_pack" && n != null && Number(n) > 0 ? `Bulk (${Number(n)})` : v === "bulk_pack" ? "Bulk" : null;
      return (
        <span
          className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
            v === "bulk_pack"
              ? "bg-violet-50 text-violet-800 border-violet-200"
              : v === "single" || v === "bulk" ? "bg-slate-50 text-slate-600 border-slate-200" : "bg-slate-50/80 text-slate-400 border-slate-100"
          }`}
          title={v === "bulk_pack" ? "Print all — one log row for whole packing" : v || ""}
        >
          {bulkLabel ?? (v === "single" ? "Single" : v === "bulk" ? "Bulk*" : "—")}
        </span>
      );
    }, { align: "center"}],

    ["Download from", "download_source", (v) => (
      <span className="text-[10px] font-semibold text-slate-600 block truncate max-w-[200px]" title={labelStickerDownloadSource(v)}>
        {labelStickerDownloadSource(v)}
      </span>
    ), { width: "200px", sortable: true }],

    ["Downloaded By", "last_downloaded_by_name", (v) => (
      <span className="text-[10px] text-slate-500 font-semibold uppercase">{v || "—"}</span>
    ), { width: "160px" }],

    ["Downloaded At", "last_downloaded_at", (v) => (
      <span className="text-[10px] text-slate-600 font-medium">{v ? formatDateTime(v) : "Never"}</span>
    ), { width: "160px", sortable: true }],

  ];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-px h-6 bg-slate-300 mx-1" />
              <button 
                onClick={() => fetchStickers()} 
                className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all"
              >
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                <span className="hidden xs:inline">Refresh Data</span>
              </button>
            </div>

            <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
          </div>
        </div>

        <ListPageFilterStrip>
          <DateRangeFilter 
            key={`${params.fromDate}-${params.toDate}`}
            fromDate={params.fromDate} 
            toDate={params.toDate} 
            onApply={handleFilterApply} 
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Quick search logs..."
            searchLabel="Search (Box, Packing, Customer)"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col">
              <DataTable
                headers={HEADERS} 
                data={rows} 
                loading={loading}
                viewMode={viewMode} 
                showSelection={false} 
                getRowId={(item) => String(item.log_id ?? item.box_uid ?? "")}
                skeletonCount={params.pageSize}
                emptyIcon={Box} 
                emptyMessage="No sticker logs found"
                sortKey={params.sortKey} 
                sortDir={params.sortDir}
                onSort={onSort}
                onLoadMore={handleLoadMore}
                hasMore={rows.length < totalItems}
                totalItems={totalItems}
                cardConfig={{
                  titleKey: "primary_label",
                  tagsKeys: ["last_download_type"],
                  detailKeys: ["packing_number", "acc_name", "itemdcode", "last_downloaded_by_name"],
                  footerKey: "last_downloaded_at",
                  className: "rounded-none border border-slate-200" 
                }}
              />
          </div>
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {rows.length} of {totalItems} download log rows
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCcw, History, Layers, Eye } from "lucide-react";
import { toast } from "react-toastify";
import { useViewDateFilterDefaults } from "@/helpers/dateFilterDefaults";

import { boxTransactionLogService } from "@/services/boxTransactionLog";
import { useViewMode } from "@/hooks/useViewMode";
import DataTable from "@/components/ui/DataTable";
import DateRangeFilter from "@/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/components/common/ListPageFilterStrip";
import ViewToggle from "@/components/ui/ViewToggle";
import { useCanAccess } from "@/hooks/useCanAccess";
import BoxTransactionLogDetailModal from "@/components/log/BoxTransactionLogDetailModal";
import BoxStickerNosCell, { getBoxStickerEntries } from "@/components/log/BoxStickerNosCell";
import { filterBoxTransactionLogs } from "@/utils/boxTransactionLogSearch";
import { sortRowsByKey } from "@/helpers/clientListSearch";
import { formatDateTime } from "@/helpers/utilHelper";

const TYPE_COLORS = {
  packing_create: "bg-indigo-50 text-indigo-600 border-indigo-100",
  packing_delete: "bg-rose-50 text-rose-600 border-rose-100",
  inward_link: "bg-emerald-50 text-emerald-600 border-emerald-100",
  inward_unlink: "bg-amber-50 text-amber-600 border-amber-100",
  out_link: "bg-blue-50 text-blue-600 border-blue-100",
  out_unlink: "bg-orange-50 text-orange-600 border-orange-100",
  sa_stock_in: "bg-teal-50 text-teal-600 border-teal-100",
  sa_stock_out: "bg-purple-50 text-purple-600 border-purple-100",
  sa_revert: "bg-slate-50 text-slate-600 border-slate-100",
  sa_delete: "bg-rose-50 text-rose-600 border-rose-100",
  sa_qty_update: "bg-blue-50 text-blue-600 border-blue-100",
  box_soft_delete: "bg-slate-50 text-slate-600 border-slate-100",
  override_customer: "bg-violet-50 text-violet-600 border-violet-100",
};

export default function BoxTransactionLogPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("box_transaction_logs", "view"), [canAccess]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [typeLabels, setTypeLabels] = useState({});
  const [viewMode, handleViewMode] = useViewMode();

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    page: 1,
    pageSize: 500,
    fromDate: dateFilterDefaults.from,
    toDate: dateFilterDefaults.to,
    sortKey: "created_at",
    sortDir: "desc",
  });

  useEffect(() => {
    if (dateFilterDefaults.from || dateFilterDefaults.to) {
      setParams((prev) => ({
        ...prev,
        fromDate: dateFilterDefaults.from,
        toDate: dateFilterDefaults.to,
      }));
    }
  }, [dateFilterDefaults.from, dateFilterDefaults.to]);

  const [tempSearch, setTempSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [viewRow, setViewRow] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = useCallback((row) => {
    if (!row) return;
    setViewRow(row);
    setDetailOpen(true);
  }, []);

  const filteredItems = useMemo(() => {
    const filtered = filterBoxTransactionLogs(items, tempSearch, typeLabels);
    return sortRowsByKey(filtered, params.sortKey, params.sortDir);
  }, [items, tempSearch, typeLabels, params.sortKey, params.sortDir]);

  const selectedRecord = useMemo(
    () => filteredItems.find((r) => String(r.id) === String(selected)),
    [filteredItems, selected]
  );

  const hasActiveSearch = Boolean(String(tempSearch ?? "").trim());

  const fetchLogs = useCallback(
    async (isLoadMore = false) => {
      const append = isLoadMore === true;
      if (!append) setLoading(true);
      try {
        const currentPage = append ? params.page + 1 : 1;
        const apiParams = {
          page: currentPage,
          limit: params.pageSize,
          sortBy: params.sortKey || "created_at",
          order: params.sortDir.toUpperCase(),
          filters: {
            fromDate: params.fromDate ? `${params.fromDate} 00:00:00` : undefined,
            toDate: params.toDate ? `${params.toDate} 23:59:59` : undefined,
          },
        };

        const body = await boxTransactionLogService.getAll(apiParams);
        const newItems = body.data ?? [];

        if (body.typeLabels) setTypeLabels(body.typeLabels);

        const sortKey = params.sortKey || "created_at";
        const sortDir = params.sortDir || "desc";
        const sortedNew = sortRowsByKey(newItems, sortKey, sortDir);

        if (append) {
          setItems((prev) => sortRowsByKey([...prev, ...sortedNew], sortKey, sortDir));
          setParams((prev) => ({ ...prev, page: currentPage }));
        } else {
          setItems(sortedNew);
          setParams((prev) => ({ ...prev, page: 1 }));
          setSelected(null);
        }
        setTotalItems(body.total ?? 0);
      } catch (err) {
        toast.error(err?.message || "Failed to load box transaction logs");
      } finally {
        setLoading(false);
      }
    },
    [
      params.pageSize,
      params.sortKey,
      params.sortDir,
      params.fromDate,
      params.toDate,
      params.page,
    ]
  );

  useEffect(() => {
    fetchLogs(false);
  }, [params.pageSize, params.sortKey, params.sortDir, params.fromDate, params.toDate]);

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) fetchLogs(true);
  }, [loading, items.length, totalItems, fetchLogs]);

  const handleSearch = (data) => {
    setParams((prev) => ({
      ...prev,
      page: 1,
      fromDate: data.fromDate,
      toDate: data.toDate,
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams((prev) => ({
      ...prev,
      page: 1,
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "created_at",
      sortDir: "desc",
    }));
  };

  const labelForType = (t) => typeLabels[t] || t?.replace(/_/g, " ") || "—";

  const copyModuleEntity = useCallback((row) => {
    const parts = [
      row?.source_module?.replace(/_/g, " ") || "—",`REF: ${row?.source_id || "N/A"}`,
    ];
    // if (row?.packing_number) parts.push(`PKG: ${row.packing_number}`);
    return parts.join(" | ");
  }, []);

  const HEADERS = useMemo(
    () => [
      [ "#", "_row", (_v, _row, i) => i + 1, {
          fixed: true,
          width: "50px",
          align: "center",
          sortable: false,
          copyValue: (_row, _val, rowIndex) => String((rowIndex ?? 0) + 1),
        },
      ],

      [ "Type", "transaction_type", (v) => {
          const cls = TYPE_COLORS[v] || "bg-slate-50 text-slate-600 border-slate-100";
          return (
            <span className={`px-2 py-0.5 border text-[9px] font-bold ${cls}`} title={v}>
              {labelForType(v)}
            </span>
          );
        },
        {
          width: "168px",
          align: "center",
          copyValue: (row) => labelForType(row.transaction_type),
        },
      ],

      [ "Box Sticker No.", "box_no_uids_display", (_v, row) => <BoxStickerNosCell row={row} />, {
          width: "340px",
          wrap: true,
          copyValue: (row) => getBoxStickerEntries(row).map((e) => e.box_no_uid).join(", ") || "—",
        },
      ],

      [ "Box Count", "box_count", (v) => (
          <span className="tabular-nums font-bold text-[11px] text-slate-800">{v != null ? v : "—"}</span>
        ),
        {
          width: "56px",
          align: "center",
          copyValue: (row) => (row.box_count != null ? String(row.box_count) : "—"),
        },
      ],

      [ "Qty", "total_qty", (v) => (
          <span className="tabular-nums font-bold text-[11px] text-slate-800">{v != null ? v : "—"}</span>
        ),
        {
          width: "56px",
          align: "center",
          copyValue: (row) => (row.total_qty != null ? String(row.total_qty) : "—"),
        },
      ],

      [ "Module / Entity", "source_module", (v, row) => (
          <div className="flex flex-col leading-tight min-w-[140px]">
            <div className="flex items-center gap-1 text-slate-700">
              <Layers size={10} />
              <span className="font-bold capitalize text-[11px]">{v?.replace(/_/g, " ")}</span>
            </div>
            <span className="text-[9px] text-indigo-500 font-mono ml-3">REF: {row.source_id || "N/A"}</span>
          </div>
        ),
        {
          width: "180px",
          copyValue: (row) => copyModuleEntity(row),
        },
      ],

      ["Created By", "user_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
      ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ],
    [labelForType, copyModuleEntity]
  );

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!selectedRecord}
                title={selectedRecord ? "View selected log" : "Select a row first"}
                onClick={() => openDetail(selectedRecord)}
                className="h-8 px-3 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Eye size={14} className="shrink-0 text-indigo-600" aria-hidden />
                View
              </button>

              <div className="w-px h-6 bg-slate-200" />

              <button
                type="button"
                onClick={() => fetchLogs(false)}
                disabled={loading}
                className="h-8 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-600">
                    <RefreshCcw size={14} className="shrink-0 animate-spin text-indigo-600" aria-hidden />
                  </span>
                ) : (
                  <RefreshCcw size={14} className="shrink-0" aria-hidden />
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-8" />
            </div>
          </div>
        </div>

        <ListPageFilterStrip>
          <DateRangeFilter
            key={`${params.fromDate}-${params.toDate}`}
            fromDate={params.fromDate}
            toDate={params.toDate}
            onApply={handleSearch}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search..."
            searchLabel="Search"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS}
            data={filteredItems}
            loading={loading}
            allowCopy={true}
            viewMode={viewMode}
            onSort={(key) =>
              setParams((p) => ({
                ...p,
                sortKey: key,
                sortDir: p.sortKey === key && p.sortDir === "desc" ? "asc" : "desc",
                page: 1,
              }))
            }
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            showSelection
            selectedId={selected}
            onSelect={setSelected}
            idKey="id"
            emptyIcon={History}
            onLoadMore={handleLoadMore}
            hasMore={!hasActiveSearch && items.length < totalItems}
            totalItems={hasActiveSearch ? filteredItems.length : totalItems}
            cardConfig={{
              titleKey: "user_name",
              badgeIndices: [1],
              detailIndices: [2, 3, 4, 5],
              footerKey: "created_at",
              className: "rounded-none border border-slate-200 shadow-none",
            }}
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {hasActiveSearch
              ? `Showing ${filteredItems.length} match${filteredItems.length !== 1 ? "es" : ""} in ${items.length} loaded (${totalItems} total)`
              : `Showing ${items.length} of ${totalItems} box transaction logs`}
          </span>
        </div>
      </div>

      <BoxTransactionLogDetailModal
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setViewRow(null);
        }}
        row={viewRow}
        labelForType={labelForType}
      />
    </div>
  );
}

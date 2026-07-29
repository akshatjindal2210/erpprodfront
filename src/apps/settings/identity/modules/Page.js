"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Box, RefreshCcw, X } from "lucide-react";
import { toast } from "react-toastify";

import { moduleService } from "@/apps/settings/lib/services/moduleService";
import { useViewMode } from "@/platform/hooks/list/useViewMode";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/platform/utils/list/listSearch";

import ViewToggle from "@/ui/primitives/ViewToggle";
import DataTable from "@/ui/primitives/DataTable";
import DateRangeFilter from "@/ui/common/date/DateRangeFilter";
import ListPageFilterStrip from "@/ui/common/list/ListPageFilterStrip";
import { APP_TYPE_LABELS } from "@/config/moduleAppRegistry";

export default function ModulesPage() {
  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();

  const [params, setParams] = useState({
    pageSize: 500,
    status: "all",
    appType: "all",
    sortKey: null,
    sortDir: "asc",
  });

  const [tempSearch, setTempSearch] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(50);
  const [selected, setSelected] = useState(null);
  const [blockedMessage, setBlockedMessage] = useState("");

  const fetchModules = useCallback(async () => {
    setLoading(true);
    try {
      setBlockedMessage("");
      const { data } = await fetchAllListPages(
        async (page, limit) => {
          const body = await moduleService.getAll({
            page,
            limit,
            filters: {},
            sortBy: "sort_order",
            order: "ASC",
          });
          return { data: body?.data ?? [], total: body?.total ?? 0 };
        },
        Math.min(Math.max(1, params.pageSize), 1000),
        50000
      );
      setAllRows(data);
      setDisplayLimit(50);
    } catch (err) {
      const msg = err?.message || "";
      const denied =
        err?.status === 403 &&
        (msg.includes("Access Denied — module") || msg.toLowerCase().includes("deactivated"));
      if (denied) {
        setAllRows([]);
        setBlockedMessage(msg);
      } else {
        toast.error(err?.message || "Failed to load modules");
        setAllRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, [params.pageSize]);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const filteredRows = useMemo(() => {
    const isActive = (r) =>
      r?.is_active === true || r?.is_active === 1 || String(r?.is_active ?? "") === "1";
    let rows = [...allRows];
    if (params.status === "active") rows = rows.filter(isActive);
    else if (params.status === "inactive") rows = rows.filter((r) => !isActive(r));

    if (params.appType && params.appType !== "all") {
      const typeKey = String(params.appType).trim().toLowerCase();
      rows = rows.filter((r) => String(r.app_type ?? "").trim().toLowerCase() === typeKey);
    }

    const q = String(tempSearch || "").trim();
    let data = rows;
    if (q) {
      data = applyClientSearch(rows, tempSearch, { skipSort: !!params.sortKey });
    }
    if (params.sortKey == null || params.sortKey === "") {
      return data;
    }
    return sortRowsByKey(data, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir, params.status, params.appType]);

  const totalLoaded = allRows.length;

  const modules = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && modules.length < totalItems) {
      setDisplayLimit((n) => n + 50);
    }
  }, [loading, modules.length, totalItems]);

  const handleToggle = async (id) => {
    try {
      const response = await moduleService.toggleStatus(id);
      setAllRows((prev) => prev.map((m) => (m.id === id ? { ...m, ...response.data } : m)));
      toast.success("Status updated");
    } catch (err) {
      toast.error(err?.message || "Failed to update status");
    }
  };

  const handleFilterApply = (data) => {
    setParams((prev) => ({
      ...prev,
      status: data.status || "all",
      appType: data.appType || "all",
    }));
    setDisplayLimit(50);
    setSelected(null);
  };

  const handleReset = () => {
    setTempSearch("");
    setParams((prev) => ({ ...prev, status: "all", appType: "all" }));
    setDisplayLimit(50);
    setSelected(null);
  };

  const appTypeFilterOptions = useMemo(() => {
    const knownOrder = ["core", "ims", "task"];
    const types = [
      ...new Set(
        allRows
          .map((r) => String(r.app_type ?? "").trim().toLowerCase())
          .filter(Boolean)
      ),
    ];
    types.sort((a, b) => {
      const ia = knownOrder.indexOf(a);
      const ib = knownOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
    return [
      { label: "All Apps", value: "all" },
      ...types.map((t) => ({
        label: APP_TYPE_LABELS[t] ?? t.toUpperCase(),
        value: t,
      })),
    ];
  }, [allRows]);

  const extraFilters = useMemo(
    () => [
      {
        label: "App",
        key: "appType",
        value: params.appType,
        options: appTypeFilterOptions,
      },
      {
        label: "Status",
        key: "status",
        value: params.status,
        options: [
          { label: "All Status", value: "all" },
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
    ],
    [params.status, params.appType, appTypeFilterOptions]
  );

  const HEADERS = [
    /*
    [
      "Module Name",
      "name",
      (v) => (
        <div className="flex flex-col py-1">
          <span className="font-bold text-slate-800 text-[11px] md:text-xs uppercase tracking-tight">
            {v}
          </span>
        </div>
      ),
    ],
    */
    ["Module Label", "label", (v) => (
      <span className="font-bold text-slate-800 text-[11px] md:text-xs uppercase tracking-tight">{v}</span>
    )],
    [
      "App",
      "app_type",
      (v) => (
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {APP_TYPE_LABELS[v] ?? v ?? "—"}
        </span>
      ),
    ],
    [
      "Status",
      "is_active",
      (v, row) => (
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleToggle(row.id)}
            className={`relative inline-flex h-4 w-8 items-center rounded-full transition-all duration-200 ${
              v ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ${
                v ? "translate-x-4" : "translate-x-1"
              }`}
            />
          </button>
          <span
            className={`text-[9px] font-bold uppercase tracking-wider ${
              v ? "text-emerald-600" : "text-slate-400"
            }`}
          >
            {v ? "Active" : "Inactive"}
          </span>
        </div>
      ),
    ],
  ];

  const selectedRecord = filteredRows.find((m) => m.id === selected);

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden font-sans">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => fetchModules()}
                className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all shadow-none"
              >
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            <div className="flex items-center">
              <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
            </div>
          </div>

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase italic">
                Selected Module: {selectedRecord?.name}
              </span>
              <button
                onClick={() => setSelected(null)}
                className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase"
              >
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </div>

        <ListPageFilterStrip>
          <DateRangeFilter
            showDate={false}
            instantClientExtras
            extraFilters={extraFilters}
            onApply={handleFilterApply}
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Name or Label..."
            searchLabel="Quick filter"
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS}
            getRowId={(row) => row.id}
            data={modules}
            loading={loading}
            viewMode={viewMode}
            allowCopy={false}
            showSelection={false}
            skeletonCount={params.pageSize}
            emptyIcon={Box}
            emptyMessage={blockedMessage || "No modules found"}
            emptySubMessage={
              blockedMessage ? "No records are available for the current selection." : undefined
            }
            sortKey={params.sortKey}
            sortDir={params.sortDir}
            onSort={(key) => {
              setDisplayLimit(50);
              setParams((p) => ({
                ...p,
                sortKey: key,
                sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
              }));
            }}
            selectedId={selected}
            onSelect={setSelected}
            onLoadMore={handleLoadMore}
            hasMore={modules.length < totalItems}
            totalItems={totalItems}
            cardConfig={{
              titleKey: "name",
              tagsKeys: ["is_active"],
              detailKeys: ["label", "updated_by_name", "updated_at"],
              footerKey: "created_at",
              className: "rounded-none shadow-sm border border-slate-200 overflow-hidden",
            }}
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {String(tempSearch || "").trim()
              ? `${filteredRows.length} match · ${totalLoaded} loaded`
              : `Showing ${modules.length} of ${totalItems} Modules`}
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


"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCcw, Box, Edit3, Trash2, CheckCircle, X } from "lucide-react";
import { toast } from "react-toastify";
import { boxService } from "@/features/apps/ims/services/box";
import { useViewDateFilterDefaults } from "@/features/apps/ims/helpers/dateFilterDefaults";

// Components
import ActionButton from "@/core/components/ui/ActionButton";
import ViewToggle from "@/core/components/ui/ViewToggle";
import DeleteModal from "@/core/components/common/DeleteModal";
import DataTable from "@/core/components/ui/DataTable";
import BoxModal from "./BoxModal";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";

import { useViewMode } from "@/core/hooks/useViewMode";
import { formatDateTime } from "@/core/utils/utilHelper";

import { useCanAccess } from "@/core/hooks/useCanAccess";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/features/apps/ims/helpers/clientListSearch";

export default function BoxTablePage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("boxes", "view"), [canAccess]);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 1000,
    status: "all",
    fromDate: dateFilterDefaults.from, toDate: dateFilterDefaults.to, sortKey: "box_uid", sortDir: "desc"
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
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); 
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const fetchBoxes = useCallback(async () => {
    setLoading(true);
    try {
      const base = {
        sortBy: params.sortKey || undefined,
        order: params.sortDir.toUpperCase(),
        filters: {
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
        },
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await boxService.getAll({ ...base, page, limit });
        const list = body.data?.data ?? body.data ?? [];
        return { data: Array.isArray(list) ? list : [], total: body.data?.total ?? body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Failed to load box records");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.fromDate, params.toDate, params.status]);

  useEffect(() => {
    fetchBoxes();
  }, [fetchBoxes]);

  const filteredRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    if (q) return applyClientSearch(allRows, tempSearch);
    return sortRowsByKey(allRows, params.sortKey, params.sortDir);
  }, [allRows, tempSearch, params.sortKey, params.sortDir]);

  const items = useMemo(() => filteredRows.slice(0, displayLimit), [filteredRows, displayLimit]);
  const totalItems = filteredRows.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit((n) => n + 100);
    }
  }, [loading, items.length, totalItems]);

  const handleFilterApply = (data) => {
    setParams((prev) => ({
      ...prev,
      fromDate: data.fromDate,
      toDate: data.toDate,
      status: data.approvedStatus || prev.status,
    }));
  };

  const handleReset = () => {
    setTempSearch("");
    setParams({
      pageSize: 1000,
      status: "all",
      fromDate: dateFilterDefaults.from,
      toDate: dateFilterDefaults.to,
      sortKey: "box_uid",
      sortDir: "desc",
    });
  };

  const extraFilters = useMemo(() => [
    // { 
    //   label: "Status", key: "approvedStatus", value: params.status, 
    //   options: [
    //     { label: "All Status", value: "all" }, 
    //     { label: "Authorized", value: "approved" }, 
    //     { label: "Pending", value: "pending" }
    //   ] 
    // },
  ], [params.status]);

  const selectedRecord = filteredRows.find((u) => u.box_uid === selected);

  const HEADERS = [
    ["Box No", "box_no_uid", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "—"}</span>, { fixed: true, width: "120px" }],
    ["Packing No", "packing_number", (v) => <span className="font-semibold text-slate-700 text-[10px] uppercase">{v || "—"}</span>, { width: "120px" }],
    ["Qty", "qty", (v) => <span className="font-black text-emerald-600 text-[11px]">{v ?? "0"}</span>, { width: "70px", align: "center" }],
    // ["Customer", "acc_name", (v) => <span className="text-[10px] text-slate-500 italic whitespace-normal break-words line-clamp-2 block" title={v}>{v || "—"}</span>, { width: "150px" }],
    ["Location", "location_no", (v, row) => (
      <span className="text-[10px] font-bold text-slate-600 uppercase">
        {v || `${row?.rack_no || ""}${(row?.shelf_no || "").toString().toUpperCase()}` || "—"}
      </span>
    ), { width: "120px" }],
    ["Inward UID", "in_uid", (v) => <span className="text-[10px] text-slate-400">{v || "—"}</span>, { width: "120px" }],
    ["Outward UID", "out_uid", (v) => <span className="text-[10px] text-slate-400">{v || "—"}</span>, { width: "120px" }],
  ];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
              
              <button onClick={() => fetchBoxes()} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center transition-all">
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
          </div>

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">Selected: {selectedRecord?.box_no_uid}</span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </div>

        <ListPageFilterStrip>
          <DateRangeFilter 
            key={`${params.fromDate}-${params.toDate}`}
            fromDate={params.fromDate} 
            toDate={params.toDate} 
            extraFilters={extraFilters}
            onApply={handleFilterApply} 
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search box no, packing..."
            searchLabel="Search Box Records"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col">
            <DataTable
              headers={HEADERS} 
              data={items} 
              loading={loading}
              viewMode={viewMode} 
              sortKey={params.sortKey} 
              sortDir={params.sortDir}
              allowCopy={true}
              hotkeysDisabled={modalOpen}
              onSort={(key) => {
                setDisplayLimit(100);
                setParams((p) => ({
                  ...p,
                  sortKey: key,
                  sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                }));
              }}
              selectedId={selected} 
              onSelect={setSelected}
              getRowId={(item) => item.box_uid}
              emptyIcon={Box}
              onLoadMore={handleLoadMore}
              hasMore={items.length < totalItems}
              totalItems={totalItems}
              cardConfig={{
                titleKey: "box_no_uid", 
                badgeIndices: [2], 
                detailIndices: [3, 4, 5], 
                footerKey: "acc_name"
              }}
            />
          </div>
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Box Records
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      <BoxModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={() => { fetchBoxes(); setSelected(null); }} editData={editItem} mode={modalMode} />
      <DeleteModal item={deleteItem} onClose={() => setDeleteItem(null)} onSuccess={() => { fetchBoxes(); setSelected(null); }} service={boxService} entityLabel="Box Record" idKey="box_uid" moduleSlug="boxes" />
    </div>
  );
}


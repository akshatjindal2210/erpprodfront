"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, RefreshCw, Locate, Box, Edit3, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";
import { inventoryInwardService } from "@/services/inventoryInward";
import dayjs from "dayjs";
import { useViewDateFilterDefaults } from "@/helpers/dateFilterDefaults";

// Components
import InwardModal from "@/components/inventory-inward/InwardModal"; 
import DeleteModal from "@/components/common/DeleteModal";
import DateRangeFilter from "@/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/components/common/ListPageFilterStrip";
import { useViewMode } from "@/hooks/useViewMode";
import DataTable from "../ui/DataTable";
import ViewToggle from "../ui/ViewToggle";
import ActionButton from "../ui/ActionButton";
import LocationFinderDrawer from "../location/LocationFinderDrawer";

import { useCanAccess } from "@/hooks/useCanAccess";
import { useListDrawerHotkeys } from "@/hooks/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages, sortRowsByKey } from "@/helpers/clientListSearch";
import { formatDateTime } from "@/helpers/utilHelper";

export default function InwardPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("inventory_inwards", "view"), [canAccess]);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 1000,
    status: "all",
    fromDate: dateFilterDefaults.from, toDate: dateFilterDefaults.to, sortKey: "in_uid", sortDir: "desc"
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
  const [finderOpen, setFinderOpen] = useState(false);

  const fetchInwards = useCallback(async () => {
    setLoading(true);
    try {
      const base = {
        sortBy: params.sortKey || undefined,
        order: params.sortDir.toUpperCase(),
        filters: {
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
          ...(params.status !== "all" && { approved: params.status === "approved" }),
        },
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await inventoryInwardService.getAll({ ...base, page, limit });
        return { data: body.data ?? [], total: body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Failed to load inwards");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.fromDate, params.toDate, params.status]);

  useEffect(() => {
    fetchInwards();
  }, [fetchInwards]);

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
      sortKey: "in_uid",
      sortDir: "desc",
    });
  };

  const extraFilters = useMemo(() => [
    { 
      label: "Status", key: "approvedStatus", value: params.status, 
      options: [
        { label: "All Status", value: "all" }, 
        { label: "Approved", value: "approved" }, 
        { label: "Pending", value: "pending" }
      ] 
    },
  ], [params.status]);

  const selectedRecord = useMemo(() => filteredRows.find((i) => i.in_uid === selected), [filteredRows, selected]);

  const getSelectedRow = useCallback(
    () => filteredRows.find((i) => i.in_uid === selected),
    [filteredRows, selected]
  );

  const { openNewModal, openEditModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "inventory_inwards",
    modalOpen: modalOpen || finderOpen,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => {
      setEditItem(null);
      setModalMode("add");
      setModalOpen(true);
    }, []),
    openEdit: useCallback((row) => {
      setEditItem(row);
      setModalMode("edit");
      setModalOpen(true);
    }, []),
  });

  const HEADERS = [
    ["Inward UID", "in_uid", (v) => <span className="font-bold text-indigo-600 text-[10px]">{v}</span>, { fixed: true, width: "120px" }],
    ["Packing No", "packing_number", (v) => {
      const s = v != null ? String(v).trim() : "";
      const readable = s ? s.split(/\s*\|\s*/).map((x) => x.trim()).filter(Boolean).join(" · ") : "";
      return (
        <span className="font-bold text-slate-800 text-[10px] tracking-tight whitespace-normal break-words max-w-[min(340px,90vw)] inline-block align-top leading-snug" title={s || undefined}>
          {readable || "—"}
        </span>
      );
    }, { fixed: true, width: "200px" }],
    ["Remarks", "remarks", (v) => <span className="text-slate-500 text-[10px] truncate block">{v || "—"}</span>, { width: "200px" }],
    ["Status", "approved", (v) => (
      <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}>
        {v ? "● AUTHORIZED" : "○ PENDING"}
      </span>
    ), { width: "120px" }],
    ["Created By", "created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Created At", "created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Updated By", "updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px" }],
    ["Updated At", "updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Approved By", "approved_by_name", (v) => <span className="text-[10px] text-slate-500 uppercase">{v || "—"}</span>, { width: "110px" }],
    ["Approved At", "approved_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <button 
                onClick={() => setFinderOpen(true)} 
                className="h-9 px-4 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none"
              >
                <Locate size={14} className="text-indigo-600" />
                <span>Finder</span>
              </button>
              <ActionButton module="inventory_inwards" action="add" label="New" icon={Plus} onClick={openNewModal} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none" />
              <ActionButton module="inventory_inwards" action="edit" variant="outline" label="Edit" icon={Edit3} disabled={!selected} record={selectedRecord} onClick={openEditModal} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none" />
              <ActionButton module="inventory_inwards" action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selected} onClick={() => setDeleteItem(selectedRecord)} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none" />
              
              <div className="hidden sm:block w-px h-6 bg-slate-200 mx-1" />
              
              <button onClick={() => fetchInwards()} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center transition-all">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
          </div>

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">Selected: {selectedRecord?.packing_number}</span>
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
            searchPlaceholder="Search packing..."
            searchLabel="Search Packing No"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col">
            <DataTable headers={HEADERS} data={items} loading={loading} viewMode={viewMode}
              {...tableHotkeyProps}
              onSort={(key) => {
                setDisplayLimit(100);
                setParams((p) => ({
                  ...p,
                  sortKey: key,
                  sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                }));
              }}
              sortKey={params.sortKey}
              sortDir={params.sortDir}
              selectedId={selected}
              onSelect={setSelected}
              allowCopy={true}
              getRowId={(item) => item.in_uid}
              onLoadMore={handleLoadMore}
              hasMore={items.length < totalItems}
              totalItems={totalItems}
              cardConfig={{ 
                titleKey: "packing_number", 
                badgeIndices: [7], 
                detailIndices: [1, 2, 4], 
                footerKey: "created_at" 
              }}
            />
          </div>
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Inward Entries
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      <InwardModal open={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null); }} onSuccess={() => { fetchInwards(); setSelected(null); }} editData={editItem} mode={modalMode} />
      <DeleteModal item={deleteItem} onClose={() => setDeleteItem(null)} onSuccess={() => { fetchInwards(); setSelected(null); }} service={inventoryInwardService} entityLabel="Inward Entry" idKey="in_uid" moduleSlug="inventory_inwards" />
      {finderOpen && <LocationFinderDrawer open={finderOpen} onClose={() => setFinderOpen(false)} />}
    </div>
  );
}

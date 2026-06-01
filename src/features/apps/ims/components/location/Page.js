"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, MapPin, RefreshCcw, Printer, Edit3, Trash2, CheckCircle, X, Info, Layers } from "lucide-react";
import { toast } from "react-toastify";

import { formatDateTime } from "@/core/utils/utilHelper";
import { locationService } from "@/features/apps/ims/services/location";
import { useViewMode } from "@/core/hooks/useViewMode";
import dayjs from "dayjs";
import { useViewDateFilterDefaults } from "@/features/apps/ims/helpers/dateFilterDefaults";

// Components
import ActionButton from "@/core/components/ui/ActionButton";
import PrintActionButton from "@/core/components/ui/PrintActionButton";
import ViewToggle from "@/core/components/ui/ViewToggle";
import DeleteModal from "@/core/components/common/DeleteModal";
import DataTable from "@/core/components/ui/DataTable";
import LocationModal from "@/features/apps/ims/components/location/LocationModal";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import LocationQRDrawer from "./LocationQRDrawer";
import LocationBulkQRDrawer from "./LocationBulkQRDrawer";

import { useCanAccess } from "@/core/hooks/useCanAccess";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";
import { applyClientSearch, fetchAllListPages } from "@/features/apps/ims/helpers/clientListSearch";

export default function LocationMasterPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("location_master", "view"), [canAccess]);

  const [loading, setLoading] = useState(true);
  const [viewMode, handleViewMode] = useViewMode();

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);

  const [params, setParams] = useState({
    pageSize: 1000,
    status: "all",
    fromDate: null,
    toDate: null,
    sortKey: "location_id",
    sortDir: "desc",
  });

  useEffect(() => {
    setParams(prev => ({
      ...prev,
      fromDate: null,
      toDate: null
    }));
  }, []);

  const [tempSearch, setTempSearch] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [selected, setSelected] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("add"); 
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [bulkQrOpen, setBulkQrOpen] = useState(false);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const base = {
        sortBy: params.sortKey || "location_id",
        order: params.sortDir.toUpperCase(),
        filters: {
          ...(params.fromDate && { from_date: `${params.fromDate} 00:00:00` }),
          ...(params.toDate && { to_date: `${params.toDate} 23:59:59` }),
          ...(params.status !== "all" && { approved: params.status === "approved" }),
        },
      };
      const { data } = await fetchAllListPages(async (page, limit) => {
        const body = await locationService.getAll({ ...base, page, limit });
        const list = body.data?.data ?? body.data ?? [];
        return { data: Array.isArray(list) ? list : [], total: body.data?.total ?? body.total ?? 0 };
      }, params.pageSize);
      setAllRows(data);
      setDisplayLimit(100);
    } catch (err) {
      toast.error(err?.message || "Failed to load locations");
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, [params.pageSize, params.sortKey, params.sortDir, params.fromDate, params.toDate, params.status]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const filteredRows = useMemo(() => {
    const q = String(tempSearch || "").trim();
    if (q) return applyClientSearch(allRows, tempSearch);
    return [...allRows];
  }, [allRows, tempSearch]);

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
      sortKey: "location_id",
      sortDir: "desc",
    });
  };

  const extraFilters = useMemo(() => [
    { 
      label: "Status", key: "approvedStatus", value: params.status, 
      options: [
        { label: "All Status", value: "all" }, 
        { label: "Authorized", value: "approved" }, 
        { label: "Pending", value: "pending" }
      ] 
    },
  ], [params.status]);

  const selectedRecord = useMemo(() => filteredRows.find((u) => u.location_id === selected), [filteredRows, selected]);

  const getSelectedRow = useCallback(
    () => filteredRows.find((u) => u.location_id === selected),
    [filteredRows, selected]
  );

  const { openNewModal, openEditModal, openPrintModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "location_master",
    modalOpen: modalOpen || qrModalOpen || bulkQrOpen,
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
    openApprove: useCallback((row) => {
      setEditItem(row);
      setModalMode("approve");
      setModalOpen(true);
    }, []),
    canApproveSelection: useCallback(
      () => Boolean(selected && selectedRecord),
      [selected, selectedRecord]
    ),
    onApproveBlocked: useCallback(() => {
      toast.info("Select a row to open approve (Ctrl+A).");
    }, []),
    onPrint: useCallback((row) => {
      setQrData(row);
      setQrModalOpen(true);
    }, []),
    canPrintSelection: useCallback(
      () => Boolean(selected) && Boolean(selectedRecord?.approved),
      [selected, selectedRecord?.approved]
    ),
    printBlockedMessage: "Select an authorized location to print QR (Ctrl+Alt+P).",
    printModule: "location_master",
    printAction: "view",
  });

  const HEADERS = [
    ["Loc No", "location_no", (v, row) => (
      <div className="flex flex-col leading-tight py-1">
        <span className="font-mono text-indigo-600 font-bold text-[10px] uppercase">
          {v || `${row.rack_no || ""}${(row.shelf_no || "").toString().toUpperCase()}` || "—"}
        </span>
      </div>
    ), { width: "120px" }],
    ["Rack No", "rack_no", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{v || "—"}</span>, { width: "90px" }],
    ["Shelf No", "shelf_no", (v) => <span className="font-bold text-slate-800 uppercase text-[11px]">{(v || "—").toString().toUpperCase()}</span>, { width: "90px" }],
    [
      "Customer Name",
      "acc_code",
      (v, row) => (
        <div className="flex flex-col leading-tight min-w-0 max-w-full select-text">
          <span
            className="font-bold text-slate-900 text-[10px] uppercase whitespace-normal break-words leading-snug hyphens-auto"
            title={row.acc_name}
          >
            {row.acc_name || "N/A"}
          </span>
        </div>
      ),
      { width: "250px", wrap: true, copyValue: (row) => row.acc_name || "—" },
    ],
    ["Item Code", "item_code", (v, row) => (
      <div className="flex flex-col leading-tight min-w-[140px]">
        <span className="font-bold text-slate-900 text-[10px] truncate uppercase">{v || "N/A"}</span>
      </div>
    ), { width: "160px" }],
    ["Details", "location_description", (v) => <span className="text-[10px] text-slate-500 italic whitespace-normal break-words leading-tight">{v || "—"}</span>, { width: "180px", wrap: true }],
    ["Total Capacity", "total_capacity", (v) => <span className="font-black text-slate-700 text-[11px]">{v ?? 0}</span>, { align: "center", width: "120px" }],
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
              <ActionButton module="location_master" action="add" label="New" icon={Plus} onClick={openNewModal} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none" />
              <ActionButton module="location_master" action="edit" variant="outline" label="Edit" icon={Edit3} disabled={!selected} record={selectedRecord} onClick={openEditModal} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none" />
              <ActionButton module="location_master" action="authorize" variant="outline" label="Approve" icon={CheckCircle} disabled={!selected} onClick={() => { setEditItem(selectedRecord); setModalMode("approve"); setModalOpen(true); }} className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 text-emerald-600 shadow-none" />
              <ActionButton module="location_master" action="delete" variant="danger" label="Delete" icon={Trash2} disabled={!selected} onClick={() => setDeleteItem(selectedRecord)} className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none" />
              
              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
              
              <PrintActionButton module="location_master" variant="outline" label="Print QR" icon={Printer} disabled={!selected || !selectedRecord?.approved} onClick={openPrintModal} title="Print QR label (Ctrl+Alt+P / Ctrl+P in app)" className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none" />

              <ActionButton
                module="location_master"
                action="view"
                variant="outline"
                label="Bulk QR"
                icon={Layers}
                onClick={() => setBulkQrOpen(true)}
                title="Select multiple authorized locations — print or download QR labels (50×25 mm)"
                className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none"
              />

              <button onClick={() => fetchLocations()} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase transition-all shadow-none">
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                <span className="hidden xs:inline">Refresh</span>
              </button>
            </div>

            <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
          </div>

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 whitespace-normal break-words leading-snug text-left">
                <Info size={12} className="shrink-0" />
                <span>
                  Selected: {selectedRecord?.location_no || `${selectedRecord?.rack_no || ""}${(selectedRecord?.shelf_no || "").toString().toUpperCase()}` || "—"} | Rack: {selectedRecord?.rack_no || "—"} | Shelf: {(selectedRecord?.shelf_no || "—").toString().toUpperCase()}
                </span>
              </span>
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
            searchPlaceholder="Search rack, ledger, item..."
            searchLabel="Search Database"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
            <DataTable
              headers={HEADERS} data={items} loading={loading}
              viewMode={viewMode} allowCopy={true} {...tableHotkeyProps} showSelection={true}
              emptyIcon={MapPin} sortKey={params.sortKey ?? ""} sortDir={params.sortDir}
              onSort={(key) => {
                setDisplayLimit(100);
                setParams((p) => ({
                  ...p,
                  sortKey: key,
                  sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc",
                }));
              }}
              selectedId={selected} onSelect={setSelected}
              getRowId={(item) => item.location_id}
              onLoadMore={handleLoadMore}
              hasMore={items.length < totalItems}
              totalItems={totalItems}
              cardConfig={{
                titleKey: "location_no",
                badgeIndices: [11],
                detailIndices: [1, 2, 3, 4, 5, 6],
                footerKey: "created_at",
                className: "rounded-none border border-slate-200 shadow-none"
              }}
            />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Locations
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {modalOpen && (
        <LocationModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={() => { fetchLocations(); setSelected(null); }} editData={editItem} mode={modalMode} />
      )}
      
      {deleteItem && (
        <DeleteModal item={deleteItem} onClose={() => setDeleteItem(null)} onSuccess={() => { fetchLocations(); setSelected(null); }} service={locationService} entityLabel="Location" idKey="location_id" moduleSlug="location_master" />
      )}

      {qrModalOpen && (
        <LocationQRDrawer isOpen={qrModalOpen} onClose={() => { setQrModalOpen(false); setQrData(null); }} data={qrData} />
      )}

      <LocationBulkQRDrawer
        isOpen={bulkQrOpen}
        onClose={() => setBulkQrOpen(false)}
        locations={filteredRows}
        initialSelectedId={selectedRecord?.approved ? selected : null}
      />
    </div>
  );
}


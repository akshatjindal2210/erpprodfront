"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCcw, Package, Eye, Plus, X, Trash2, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { toastDataRefreshed } from "@/core/utils/toastNotify";
import dayjs from "dayjs";
import { useViewDateFilterDefaults } from "@/features/apps/ims/helpers/dateFilterDefaults";
import { formatDateTime } from "@/core/utils/utilHelper";

import { masterService } from "@/features/apps/ims/services/master";
import { boxService } from "@/features/apps/ims/services/box";
import { useViewMode } from "@/core/hooks/useViewMode";

// Components
import DataTable from "@/core/components/ui/DataTable";
import ViewToggle from "@/core/components/ui/ViewToggle";
import ActionButton from "@/core/components/ui/ActionButton";
import GlobalDetailModal from "@/core/components/common/GlobalDetailModal";
import { MasterDetailBody, MasterDetailHero, MasterDetailSection, MasterDetailGrid, MasterDetailKV, MasterDetailProse } from "./MasterDetailLayout";
import StickerCreationModel from "@/features/apps/ims/components/stickers/StickerCreationModel";
import StickerRemoveConfirmModal from "./StickerRemoveConfirmModal";
import DateRangeFilter from "@/core/components/common/DateRangeFilter";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";

import { useCanAccess } from "@/core/hooks/useCanAccess";
import { useListDrawerHotkeys } from "@/core/hooks/useListDrawerHotkeys";
import { applyClientSearch } from "@/features/apps/ims/helpers/clientListSearch";

export default function DailyProductionPage() {
  const canAccess = useCanAccess();
  const viewAccess = useMemo(() => canAccess("packing_entry", "view"), [canAccess]);

  const canRemoveGeneratedStickers = useMemo(
    () => canAccess("packing_entry", "delete").allowed,
    [canAccess]
  );

  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [viewMode, handleViewMode] = useViewMode();

  const dateFilterDefaults = useViewDateFilterDefaults(viewAccess);
  
  const [selected, setSelected] = useState(null); 
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isStickerModalOpen, setIsStickerModalOpen] = useState(false);
  const [removeStickersLoading, setRemoveStickersLoading] = useState(false);
  const [removeStickersConfirmOpen, setRemoveStickersConfirmOpen] = useState(false);

  const [params, setParams] = useState({
    stickerStatus: "pending",
    fromDate: dateFilterDefaults.from, toDate: dateFilterDefaults.to, sortKey: "", sortDir: "asc"
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

  const rowSelectionKey = (r) => `${r.doc_no}-${r.itemdcode}`;

  const fetchItems = useCallback(async (isManualRefresh = false) => {
    setLoading(true);
    try {
      const body = await masterService.getDailyProd({
        filters: {
          ...(params.fromDate ? { from_date: params.fromDate } : {}),
          ...(params.toDate ? { to_date: params.toDate } : {}),
        },
      });
      const list = body.data ?? [];
      setAllData(list);
      if (isManualRefresh) toastDataRefreshed();
      return list;
    } catch (err) {
      toast.error(err?.message || "Failed to load production data");
      setAllData([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [params.fromDate, params.toDate]);

  useEffect(() => { 
    fetchItems(); 
  }, [fetchItems]);

  const filteredData = useMemo(() => {
    let data = [...allData];

    if (params.fromDate) {
      const fromStart = dayjs(params.fromDate);
      data = data.filter((r) => {
        const d = dayjs(r.doc_dt);
        return fromStart.isValid() && d.isValid() && d.isAfter(fromStart.subtract(1, "day"));
      });
    }
    if (params.toDate) {
      const upper = dayjs(params.toDate).add(1, "day").startOf("day");
      data = data.filter((r) => {
        const d = dayjs(r.doc_dt);
        return upper.isValid() && d.isValid() && d.isBefore(upper);
      });
    }

    if (params.stickerStatus !== "all") {
      const isGenerated = params.stickerStatus === "generated";
      data = data.filter((r) => !!r.sticker_generated === isGenerated);
    }

    if (String(tempSearch || "").trim()) {
      data = applyClientSearch(data, tempSearch, {
        getParts: (r) => [r.doc_no, r.job_card_no, r.acc_name, r.item_code, r.item_desc],
      });
    } else if (params.sortKey) {
      data.sort((a, b) => {
        let valA = a[params.sortKey];
        let valB = b[params.sortKey];
        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();
        if (valA < valB) return params.sortDir === "asc" ? -1 : 1;
        if (valA > valB) return params.sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [allData, tempSearch, params.fromDate, params.toDate, params.stickerStatus, params.sortKey, params.sortDir]);

  const items = useMemo(() => filteredData.slice(0, displayLimit), [filteredData, displayLimit]);
  const totalItems = filteredData.length;

  const handleLoadMore = useCallback(() => {
    if (!loading && items.length < totalItems) {
      setDisplayLimit(prev => prev + 100);
    }
  }, [loading, items.length, totalItems]);

  const toggleSort = (key) => {
    setParams(p => ({
      ...p,
      sortKey: key,
      sortDir: p.sortKey === key && p.sortDir === "asc" ? "desc" : "asc"
    }));
    setDisplayLimit(100);
  };

  const handleReset = () => {
    setTempSearch("");
    setParams({
      stickerStatus: "pending",
      fromDate: dateFilterDefaults.from, toDate: dateFilterDefaults.to, sortKey: "", sortDir: "asc"
    });
    setSelected(null);
    setDisplayLimit(100);
  };

  const extraFilters = useMemo(() => [
    { 
      label: "Sticker Status", key: "stickerStatus", value: params.stickerStatus, 
      options: [
        { label: "All Status", value: "all" }, 
        { label: "Generated", value: "generated" }, 
        { label: "Pending", value: "pending" }
      ] 
    },
  ], [params.stickerStatus]);

  const selectedRecord = useMemo(() => 
    allData.find((u) => rowSelectionKey(u) === selected),
    [allData, selected]
  );

  const getSelectedRow = useCallback(
    () => allData.find((u) => rowSelectionKey(u) === selected),
    [allData, selected]
  );

  const { openNewModal, tableHotkeyProps } = useListDrawerHotkeys({
    module: "packing_entry",
    modalOpen: isStickerModalOpen || isDetailModalOpen,
    selectedId: selected,
    getSelectedRow,
    openAdd: useCallback(() => setIsStickerModalOpen(true), []),
    canOpenNew: useCallback(() => Boolean(selected), [selected]),
    newBlockedMessage: "Select a row in the list first — New Sticker opens only after a row is selected (Ctrl+Alt+N / Cmd+Option+N).",
  });

  const handleRemoveGeneratedStickersForRow = async () => {
    if (!canRemoveGeneratedStickers) {
      toast.error("You do not have permission to remove stickers. Delete permission is required.");
      return;
    }
    if (!selectedRecord?.doc_no || !selectedRecord?.sticker_generated) return;
    const docNo = selectedRecord.doc_no;
    const selectionKey = selected;
    if (!selectionKey) return;
    setRemoveStickersLoading(true);
    try {
      const res = await boxService.removeGeneratedStickers({ doc_no: docNo });
      if (!res?.success) throw new Error(res?.message || "Remove failed");
      toast.success(res.message || "Stickers removed.");
      setRemoveStickersConfirmOpen(false);
      const list = await fetchItems(false);
      const still = list.find((r) => rowSelectionKey(r) === selectionKey);
      if (still) setSelected(selectionKey);
      else setSelected(null);
    } catch (e) {
      toast.error(e.message || "Remove failed");
    } finally {
      setRemoveStickersLoading(false);
    }
  };

  const HEADERS = [
    ["Packing No", "doc_no", (v) => <span className="font-mono font-bold text-slate-700 text-[10px] uppercase">{v}</span>, { width: "100px", fixed: true }],
    ["Date", "doc_dt", (v) => <span className="text-slate-600 font-bold text-[10px] uppercase">{dayjs(v).format("DD/MM/YYYY")}</span>, { width: "100px" }],
    ["Job Card", "job_card_no", (v) => <span className="font-bold text-slate-700 text-[11px] uppercase tracking-tighter">{v}</span>, { width: "120px" }],
    ["Quantity", "total_qty", (v) => (
      <span className="font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100 text-[11px]">
        {parseFloat(v || 0).toLocaleString()}
      </span>
    ), { width: "100px",}],
    ["Customer", "acc_name", (v, row) => (
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-slate-800 font-bold text-[10px] uppercase whitespace-normal break-words leading-snug hyphens-auto" title={v}>{v || "Unknown"}</span>
      </div>
    ), { width: "250px", wrap: true }],
    ["Item Details", "item_code", (v, row) => (
      <div className="flex flex-col leading-tight">
        <span className="text-slate-700 font-medium text-[10px] uppercase truncate" title={v}>{v}</span>
      </div>
    )],
    ["Item Description", "item_desc", (v, row) => (
      <div className="flex flex-col leading-tight">
        <span className="text-slate-700 font-medium text-[10px] uppercase truncate" title={v}>{v}</span>
      </div>
    ), { width: "220px" }],
    ["Sticker Status", "sticker_generated", (v) => (
      <span
        className={`px-2 py-0.5 text-[9px] font-black uppercase border ${
          v ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
        }`}
      >
        {v ? "● GENERATED" : "○ PENDING"}
      </span>
    ), { width: "110px" }],
    ["Created By", "sticker_created_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px", copyValue: (row) => (row.sticker_generated ? formatDateTime(row.sticker_created_at) || "—" : "") }],
    ["Created At", "sticker_created_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
    ["Updated By", "sticker_updated_by_name", (v) => <span className="text-[10px] text-slate-500">{v || "—"}</span>, { width: "110px", copyValue: (row) => (row.sticker_generated ? row.sticker_updated_by_name || "—" : "")   }],
    ["Updated At", "sticker_updated_at", (v) => <span className="text-[10px] text-slate-400 font-medium">{formatDateTime(v)}</span>, { width: "150px" }],
  ];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden font-sans">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ActionButton 
                module="packing_entry" action="add" label="New Sticker" icon={Plus} 
                disabled={!selected}
                onClick={openNewModal}
                title="Select a row in the list first to open New Sticker. Table shortcut: Ctrl+Alt+N (Cmd+Option+N on Mac)."
                className="rounded-none h-9 text-[11px] font-bold uppercase px-4 shadow-none"
              />
              <ActionButton
                variant="outline" label="View Profile" icon={Eye}
                disabled={!selected}
                onClick={() => setIsDetailModalOpen(true)}
                className="rounded-none h-9 bg-white text-[11px] font-bold uppercase px-4 border-slate-300 shadow-none"
              />
              {canRemoveGeneratedStickers && selectedRecord?.sticker_generated ? (
                <button
                  type="button"
                  onClick={() => setRemoveStickersConfirmOpen(true)}
                  disabled={!selected || removeStickersLoading || loading}
                  className="rounded-none h-9 text-[11px] font-bold uppercase px-4 border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 flex items-center justify-center gap-2 shadow-none disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Delete production stickers for this packing (stock adjustment boxes stay)"
                >
                  {removeStickersLoading ? (
                    <Loader2 size={14} className="animate-spin shrink-0" aria-hidden />
                  ) : (
                    <Trash2 size={14} className="shrink-0" aria-hidden />
                  )}
                  Cancel stickers
                </button>
              ) : null}
              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />
              <button 
                type="button"
                onClick={() => fetchItems(true)} 
                disabled={loading}
                className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center gap-2 transition-all disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 size={14} className="shrink-0 animate-spin text-indigo-600" aria-hidden />
                ) : (
                  <RefreshCcw size={14} className="shrink-0" aria-hidden />
                )}
                <span className="hidden xs:inline text-[11px] font-semibold">Refresh</span>
              </button>
            </div>
            <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
          </div>

          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase italic">
                Selected Document: {selectedRecord?.doc_no} | Job: {selectedRecord?.job_card_no}
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
            onApply={(data) => {
              setParams(prev => ({ ...prev, fromDate: data.fromDate, toDate: data.toDate, stickerStatus: data.stickerStatus }));
              setDisplayLimit(100);
            }} 
            onReset={handleReset}
            searchValue={tempSearch}
            onSearchChange={setTempSearch}
            searchPlaceholder="Search Doc or Job Card..."
            searchLabel="Production Search"
            minDate={dateFilterDefaults.minDate}
            maxDate={dateFilterDefaults.maxDate}
          />
        </ListPageFilterStrip>

        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS} 
            data={items} 
            loading={loading}
            viewMode={viewMode}
            {...tableHotkeyProps}
            showSelection={true} 
            allowCopy={true}
            onSort={toggleSort}
            sortKey={params.sortKey} 
            sortDir={params.sortDir}
            getRowId={(row) => rowSelectionKey(row)}
            selectedId={selected} 
            onSelect={setSelected}
            emptyIcon={Package}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={{
              titleKey: "job_card_no",
              badgeIndices: [0, 2],
              detailIndices: [4, 5, 6],
              footerKey: "doc_dt",
            }}
          />
        </div>

        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Entries
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      <GlobalDetailModal open={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Production Details" icon={Package}>
        {selectedRecord && (
          <MasterDetailBody>
            <MasterDetailHero
              eyebrow="Daily production"
              icon={Package}
              title={selectedRecord.acc_name}
              badge={`Doc ${selectedRecord.doc_no} · ${dayjs(selectedRecord.doc_dt).format("DD/MM/YYYY")}`}
            />
            <MasterDetailGrid columns={2}>
              <MasterDetailSection label="Document no." tone="indigo">
                <span>{selectedRecord.doc_no}</span>
              </MasterDetailSection>
              <MasterDetailSection label="Entry date" tone="white">
                <span>{dayjs(selectedRecord.doc_dt).format("DD/MM/YYYY")}</span>
              </MasterDetailSection>
            </MasterDetailGrid>
            <MasterDetailSection label="Item code" tone="white">
              <span>{selectedRecord.item_code}</span>
            </MasterDetailSection>
            {selectedRecord.item_desc ? (
              <MasterDetailProse label="Item description" tone="slate">
                {selectedRecord.item_desc}
              </MasterDetailProse>
            ) : null}
            <MasterDetailKV
              label="Total qty"
              value={parseFloat(selectedRecord.total_qty || 0).toLocaleString()}
              valueClassName="text-emerald-700 text-base tabular-nums"
            />
            {selectedRecord.sticker_generated ? (
              <MasterDetailGrid columns={2}>
                <MasterDetailKV
                  label="Sticker created"
                  value={formatDateTime(selectedRecord.sticker_created_at) || "—"}
                />
                <MasterDetailKV
                  label="Created by"
                  value={selectedRecord.sticker_created_by_name || "—"}
                />
                <MasterDetailKV
                  label="Sticker updated"
                  value={formatDateTime(selectedRecord.sticker_updated_at) || "—"}
                />
                <MasterDetailKV
                  label="Updated by"
                  value={selectedRecord.sticker_updated_by_name || "—"}
                />
              </MasterDetailGrid>
            ) : null}
          </MasterDetailBody>
        )}
      </GlobalDetailModal>

      <StickerRemoveConfirmModal
        open={removeStickersConfirmOpen}
        docNo={selectedRecord?.doc_no}
        loading={removeStickersLoading}
        onClose={() => {
          if (!removeStickersLoading) setRemoveStickersConfirmOpen(false);
        }}
        onConfirm={() => void handleRemoveGeneratedStickersForRow()}
      />

      {isStickerModalOpen && selectedRecord && (
        <StickerCreationModel
          open={isStickerModalOpen} 
          data={selectedRecord}
          imsDateFilter={{ from_date: params.fromDate || undefined, to_date: params.toDate || undefined }}
          onClose={() => setIsStickerModalOpen(false)} 
          onSuccess={async () => {
            const key = selected;
            const list = await fetchItems(false);
            const still = key && list.find((r) => rowSelectionKey(r) === key);
            if (still) setSelected(key);
            else setSelected(null);
            setIsStickerModalOpen(false);
            toast.success("Sticker created successfully!");
          }}
        />
      )}
    </div>
  );
}


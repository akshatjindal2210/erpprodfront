"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { UserCheck, Eye, X, RefreshCcw } from "lucide-react";
import { toast } from "react-toastify";
import { toastDataRefreshed } from "@/core/utils/toastNotify";
import { masterService } from "@/features/apps/ims/services/master";

import { useViewMode } from "@/core/hooks/useViewMode";
import DataTable from "@/core/components/ui/DataTable";
import ViewToggle from "@/core/components/ui/ViewToggle";
import ActionButton from "@/core/components/ui/ActionButton";
import GlobalDetailModal from "@/core/components/common/GlobalDetailModal";
import ListPageFilterStrip from "@/core/components/common/ListPageFilterStrip";
import ListPageSearchField from "@/core/components/common/ListPageSearchField";
import { MasterDetailBody, MasterDetailHero, MasterDetailSection } from "./MasterDetailLayout";
import { bestTierForStrings } from "@/features/apps/ims/helpers/liveSearchRank";

export default function CustomerLedgerPage() {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [viewMode, handleViewMode] = useViewMode();

  // -- Filters --
  const [tempSearch, setTempSearch] = useState("");
  const [params, setParams] = useState({
    sortKey: "",
    sortDir: "asc"
  });

  // -- Selection + Modals --
  const [selected, setSelected] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ── Fetch Data ────────────────────────────────────────────────
  const fetchItems = useCallback(async (isManualRefresh = false) => {
    setLoading(true);
    try {
      const body = await masterService.getLedgers(); 
      const list = body.data ?? [];
      setAllData(Array.isArray(list) ? list : []);
      if (isManualRefresh) toastDataRefreshed();
    } catch (err) {
      toast.error(err?.message || "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchItems(); 
  }, [fetchItems]);

  const filteredData = useMemo(() => {
    let data = [...allData];
    if (tempSearch.trim()) {
      const s = tempSearch.toLowerCase();
      const q = tempSearch.trim();
      data = data.filter(
        (r) =>
          String(r.acc_name || "").toLowerCase().includes(s) ||
          String(r.acc_code || "").toLowerCase().includes(s) ||
          String(r.city || "").toLowerCase().includes(s)
      );
      data.sort((a, b) => {
        const ra = bestTierForStrings(q, [a.acc_name, String(a.acc_code ?? ""), a.city]);
        const rb = bestTierForStrings(q, [b.acc_name, String(b.acc_code ?? ""), b.city]);
        if (ra !== rb) return ra - rb;
        return String(a.acc_name ?? "").localeCompare(String(b.acc_name ?? ""), undefined, {
          sensitivity: "base"
        });
      });
    } else if (params.sortKey) {
      data.sort((a, b) => {
        let valA = a[params.sortKey];
        let valB = b[params.sortKey];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return params.sortDir === "asc" ? -1 : 1;
        if (valA > valB) return params.sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [allData, tempSearch, params.sortKey, params.sortDir]);

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

  const selectedRecord = useMemo(() => allData.find(u => u.acc_code === selected), [allData, selected]);

  // ── Headers Configuration ─────────────────────────────────────
  const HEADERS = [
    [ "Customer Name",  "acc_name", (v) => (
        <span
          className="font-bold text-slate-700 text-[11px] md:text-xs uppercase tracking-tight py-1 block whitespace-normal break-words hyphens-auto leading-snug"
          title={v && String(v).length > 60 ? v : undefined}
        >
          {v && v.trim() !== "" ? v : "—"}
        </span>
      ), { wrap: true }
    ],
  ];

  return (
    <div className="flex flex-col h-full md:h-[calc(100vh-140px)] w-full bg-slate-100 md:overflow-hidden font-sans">
      <div className="bg-white border border-slate-300 flex flex-col flex-1 min-h-0 rounded-none shadow-sm overflow-hidden">
        
        {/* --- TOP ACTION BAR --- */}
        <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            
            {/* Action Group */}
            <div className="flex items-center gap-2">
              {/* 
              <ActionButton 
                variant="outline" label="View Profile" icon={Eye}
                disabled={!selected}
                onClick={() => setIsModalOpen(true)}
                className="rounded-none h-9 text-[11px] font-bold uppercase tracking-wider px-4 border-slate-300 shrink-0 shadow-none"
              />
               */}
              
              <div className="hidden sm:block w-px h-6 bg-slate-300 mx-1" />

              <button onClick={() => fetchItems(true)} className="h-9 px-3 border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 rounded-none flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider transition-all shadow-none">
                <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
                <span className="hidden xs:inline">Refresh</span>
              </button>
            </div>

            {/* View Toggle */}
            <div className="flex items-center">
              <ViewToggle mode={viewMode} setMode={handleViewMode} className="h-9" />
            </div>
          </div>

          {/* Selection Banner */}
          {selected && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-50 border border-indigo-100 animate-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-indigo-600 uppercase italic leading-snug whitespace-normal break-words text-left">
                Customer: {selectedRecord?.acc_name} selected
              </span>
              <button onClick={() => setSelected(null)} className="text-indigo-400 hover:text-indigo-600 flex items-center gap-1 font-bold text-[10px] uppercase">
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </div>

        <ListPageFilterStrip className="space-y-2">
          <ListPageSearchField
            label="Customer search"
            placeholder="Customer Name"
            value={tempSearch}
            onChange={(v) => {
              setTempSearch(v);
              setDisplayLimit(100);
            }}
          />
        </ListPageFilterStrip>

        {/* --- DATA AREA --- */}
        <div className="flex-1 min-h-0 relative bg-white flex flex-col overflow-hidden">
          <DataTable
            headers={HEADERS}
            data={items}
            loading={loading}
            viewMode={viewMode}
            onSort={toggleSort}
            sortKey={params.sortKey}
            allowCopy={false}
            sortDir={params.sortDir}
            showSelection={false}
            selectedId={selected}
            onSelect={setSelected}
            getRowId={(row) => row.acc_code}
            emptyIcon={UserCheck}
            onLoadMore={handleLoadMore}
            hasMore={items.length < totalItems}
            totalItems={totalItems}
            cardConfig={{ 
              titleKey: "acc_name",
              className: "rounded-none border border-slate-200 shadow-none"
            }}
          />
        </div>

        {/* --- FOOTER INFO --- */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Showing {items.length} of {totalItems} Customers
          </span>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-bold text-slate-500 uppercase">Live Database</span>
          </div>
        </div>
      </div>

      {/* Profile Detail Modal */}
      <GlobalDetailModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Customer Profile"
        icon={UserCheck}
      >
        {selectedRecord && (
          <MasterDetailBody>
            <MasterDetailHero
              eyebrow="Customer ledger"
              icon={UserCheck}
              title={selectedRecord.acc_name}
            />
            <MasterDetailSection label="Account type" tone="white">
              <span>Customer</span>
            </MasterDetailSection>
          </MasterDetailBody>
        )}
      </GlobalDetailModal>
    </div>
  );
}

